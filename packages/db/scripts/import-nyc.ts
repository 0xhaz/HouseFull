/**
 * NYC data for F7 (disruptions) and F8 (getting home):
 *   - subway stations + the routes serving them (MTA static GTFS)
 *   - permitted events, concert-relevant types only (tvpp-9vvx)
 *   - NYPD complaints as category + time + point only (5uac-w243)
 *
 *   pnpm import:nyc            # all
 *   pnpm import:nyc stations   # one part
 */
import { strFromU8, unzipSync } from 'fflate';
import { connect, parseCsv, socrata } from './lib.ts';

const sql = connect();
const only = process.argv[2];

const toMinutes = (t: string) => {
  // GTFS times can pass 24:00:00 for after-midnight service.
  const [h, m, sec] = t.split(':').map(Number);
  return (h as number) * 60 + (m as number) + (sec as number) / 60;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
};

/** Walking: 80 m/min with a 1.3 detour factor; transfers add 3 min for stairs and platforms. */
export const WALK_M_PER_MIN = 80;
export const WALK_DETOUR = 1.3;
export const TRANSFER_PENALTY_MIN = 3;
/** After-show window for late service: 22:30–01:30 (GTFS minutes past midnight of the service day). */
const LATE_FROM = 22 * 60 + 30;
const LATE_TO = 25 * 60 + 30;
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;

async function stations() {
  const res = await fetch('https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip');
  if (!res.ok) throw new Error(`GTFS download failed: ${res.status}`);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()), {
    filter: (f) => ['stops.txt', 'trips.txt', 'stop_times.txt', 'calendar.txt'].includes(f.name),
  });
  const read = (name: string) => {
    const f = files[name];
    if (!f) throw new Error(`GTFS zip has no ${name}`);
    return parseCsv(strFromU8(f));
  };

  const stops = read('stops.txt');
  const parentOf = new Map(
    stops.map((s) => [s.stop_id as string, s.parent_station || (s.stop_id as string)]),
  );
  const routeOfTrip = new Map(
    read('trips.txt').map((t) => [t.trip_id as string, t.route_id as string]),
  );
  // F8 late service: which day types each trip runs on, and its direction.
  const trips = read('trips.txt');
  const dirOfTrip = new Map(trips.map((t) => [t.trip_id as string, t.direction_id ?? '0']));
  const daysOfService = new Map(
    read('calendar.txt').map((c) => {
      const days: string[] = [];
      if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].some((d) => c[d] === '1'))
        days.push('weekday');
      if (c.saturday === '1') days.push('saturday');
      if (c.sunday === '1') days.push('sunday');
      return [c.service_id as string, days];
    }),
  );
  const daysOfTrip = new Map(
    trips.map((t) => [t.trip_id as string, daysOfService.get(t.service_id as string) ?? []]),
  );

  // Group stop_times by trip, then walk consecutive stops.
  const byTrip = new Map<string, Record<string, string>[]>();
  for (const st of read('stop_times.txt')) {
    const list = byTrip.get(st.trip_id as string);
    if (list) list.push(st);
    else byTrip.set(st.trip_id as string, [st]);
  }
  const routes = new Map<string, Set<string>>();
  const rides = new Map<string, number[]>();
  const late = new Map<string, { n: number; last: number }>();
  for (const [tripId, list] of byTrip) {
    list.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
    const route = routeOfTrip.get(tripId);
    for (let i = 0; i < list.length; i++) {
      const cur = list[i] as Record<string, string>;
      const parent = parentOf.get(cur.stop_id as string);
      if (!parent) continue;
      const dep = toMinutes(cur.departure_time as string);
      if (route && dep >= LATE_FROM && dep < LATE_TO) {
        for (const day of daysOfTrip.get(tripId) ?? []) {
          const key = `${parent}|${route}|${day}|${dirOfTrip.get(tripId)}`;
          const cur2 = late.get(key);
          if (cur2) {
            cur2.n += 1;
            cur2.last = Math.max(cur2.last, dep);
          } else late.set(key, { n: 1, last: dep });
        }
      }
      if (route) {
        if (!routes.has(parent)) routes.set(parent, new Set());
        routes.get(parent)?.add(route);
      }
      const next = list[i + 1];
      const nextParent = next && parentOf.get(next.stop_id as string);
      if (!next || !nextParent || nextParent === parent) continue;
      const minutes =
        toMinutes(next.arrival_time as string) - toMinutes(cur.departure_time as string);
      if (minutes <= 0 || minutes > 30) continue;
      const key = `${parent}>${nextParent}`;
      const xs = rides.get(key);
      if (xs) xs.push(minutes);
      else rides.set(key, [minutes]);
    }
  }

  const parents = stops.filter((s) => s.location_type === '1');
  const nodeOf = new Map(parents.map((s, i) => [s.stop_id as string, i + 1]));
  const edges = [...rides].flatMap(([key, xs]) => {
    const [a, b] = key.split('>') as [string, string];
    const source = nodeOf.get(a);
    const target = nodeOf.get(b);
    return source && target ? [{ source, target, minutes: median(xs) }] : [];
  });

  await sql.begin(async (tx) => {
    await tx`DELETE FROM transit_edges WHERE city_id = 'nyc'`;
    await tx`DELETE FROM transit_stations WHERE city_id = 'nyc'`;
    await tx`
      INSERT INTO transit_stations (city_id, gtfs_stop_id, node_id, name, routes, geom)
      SELECT 'nyc', s.id, s.node, s.name, string_to_array(s.routes, ','), ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)
      FROM unnest(${parents.map((s) => s.stop_id as string)}::text[],
                  ${parents.map((s) => nodeOf.get(s.stop_id as string) as number)}::int[],
                  ${parents.map((s) => s.stop_name as string)}::text[],
                  ${parents.map((s) => [...(routes.get(s.stop_id as string) ?? [])].sort().join(','))}::text[],
                  ${parents.map((s) => Number(s.stop_lon))}::float8[],
                  ${parents.map((s) => Number(s.stop_lat))}::float8[])
           AS s(id, node, name, routes, lng, lat)`;
    await tx`
      INSERT INTO transit_edges (city_id, source, target, minutes, kind)
      SELECT 'nyc', e.source, e.target, e.minutes, 'ride'
      FROM unnest(${edges.map((e) => e.source)}::int[], ${edges.map((e) => e.target)}::int[],
                  ${edges.map((e) => e.minutes)}::float8[]) AS e(source, target, minutes)`;
    // Walking transfers between nearby stations (MTA complexes often have one parent per line).
    await tx`
      INSERT INTO transit_edges (city_id, source, target, minutes, kind)
      SELECT 'nyc', a.node_id, b.node_id,
             ST_Distance(a.geom::geography, b.geom::geography) * ${WALK_DETOUR} / ${WALK_M_PER_MIN} + ${TRANSFER_PENALTY_MIN},
             'transfer'
      FROM transit_stations a
      JOIN transit_stations b ON a.city_id = b.city_id AND a.node_id <> b.node_id
       AND ST_DWithin(a.geom::geography, b.geom::geography, 250)
      WHERE a.city_id = 'nyc'`;
  });
  // Per station × route × day: average over directions of departures in the window.
  const svc = new Map<string, { trips: number[]; last: number }>();
  for (const [key, v] of late) {
    const [station, route, day] = key.split('|') as [string, string, string];
    const k = `${station}|${route}|${day}`;
    const e = svc.get(k) ?? { trips: [], last: 0 };
    e.trips.push(v.n);
    e.last = Math.max(e.last, v.last);
    svc.set(k, e);
  }
  const svcRows = [...svc].map(([k, v]) => {
    const [station, route, day] = k.split('|') as [string, string, string];
    const perDir = v.trips.reduce((a, b) => a + b, 0) / v.trips.length;
    return {
      station,
      route,
      day,
      trips: Math.round(perDir),
      headway: (LATE_TO - LATE_FROM) / perDir,
      last: hhmm(v.last),
    };
  });
  await sql`DELETE FROM station_service WHERE city_id = 'nyc'`;
  for (let i = 0; i < svcRows.length; i += 2000) {
    const chunk = svcRows.slice(i, i + 2000);
    await sql`
      INSERT INTO station_service (city_id, gtfs_stop_id, route, day_type, trips, headway_min, last_departure)
      SELECT 'nyc', s.station, s.route, s.day, s.trips, s.headway, s.last
      FROM unnest(${chunk.map((r) => r.station)}::text[], ${chunk.map((r) => r.route)}::text[],
                  ${chunk.map((r) => r.day)}::text[], ${chunk.map((r) => r.trips)}::int[],
                  ${chunk.map((r) => r.headway)}::float8[], ${chunk.map((r) => r.last)}::text[])
           AS s(station, route, day, trips, headway, last)`;
  }
  console.log(`late service: ${svcRows.length} station × route × day rows`);

  const [counts] = await sql`SELECT count(*) FILTER (WHERE kind = 'ride')::int AS rides,
                                    count(*) FILTER (WHERE kind = 'transfer')::int AS transfers
                             FROM transit_edges WHERE city_id = 'nyc'`;
  console.log(
    `stations: ${parents.length}; graph: ${counts?.rides} ride edges, ${counts?.transfers} transfer edges`,
  );
}

/** Concert-relevant permit types; ~88% of rows are youth/adult sport and are skipped. */
const EVENT_TYPES = [
  'Special Event',
  'Street Festival',
  'Single Block Festival',
  'Plaza Event',
  'Parade',
];

async function events() {
  const typeList = EVENT_TYPES.map((t) => `'${t}'`).join(',');
  let n = 0;
  await sql`DELETE FROM city_events WHERE city_id = 'nyc' AND source = 'tvpp-9vvx'`;
  for await (const page of socrata('tvpp-9vvx', {
    $where: `event_type in (${typeList}) AND end_date_time >= '${new Date(Date.now() - 86_400_000).toISOString().slice(0, 19)}'`,
    $order: 'event_id',
  })) {
    // Source timestamps have no zone: they are New York local time.
    await sql`
      INSERT INTO city_events (city_id, source, source_id, title, type, starts_at, ends_at, location, borough, community_board, raw)
      SELECT 'nyc', 'tvpp-9vvx', e.id, e.title, e.type,
             e.starts::timestamp AT TIME ZONE 'America/New_York',
             e.ends::timestamp AT TIME ZONE 'America/New_York',
             e.location, e.borough, e.cb, e.raw::jsonb
      FROM unnest(${page.map((r) => `${r.event_id}:${r.start_date_time}:${r.event_location ?? ''}`)}::text[],
                  ${page.map((r) => r.event_name ?? '')}::text[],
                  ${page.map((r) => r.event_type ?? '')}::text[],
                  ${page.map((r) => r.start_date_time as string)}::text[],
                  ${page.map((r) => r.end_date_time as string)}::text[],
                  ${page.map((r) => r.event_location ?? null)}::text[],
                  ${page.map((r) => r.event_borough ?? null)}::text[],
                  ${page.map((r) => (r.community_board ?? '').replace(/,$/, '') || null)}::text[],
                  ${page.map((r) => JSON.stringify(r))}::text[])
           AS e(id, title, type, starts, ends, location, borough, cb, raw)
      ON CONFLICT (source, source_id) DO NOTHING`;
    n += page.length;
  }
  console.log(`events: ${n} rows (no coordinates; geocoded in Phase 6)`);
}

/** Decision #17: two buckets shown to promoters. Everything else is not imported. */
export const PERSON = [
  'ASSAULT 3 & RELATED OFFENSES',
  'FELONY ASSAULT',
  'ROBBERY',
  'RAPE',
  'SEX CRIMES',
  'MURDER & NON-NEGL. MANSLAUGHTER',
  'KIDNAPPING & RELATED OFFENSES',
  'OFFENSES AGAINST THE PERSON',
  'JOSTLING',
  'FRAUDULENT ACCOSTING',
];
export const PROPERTY = [
  'PETIT LARCENY',
  'GRAND LARCENY',
  'GRAND LARCENY OF MOTOR VEHICLE',
  'PETIT LARCENY OF MOTOR VEHICLE',
  'BURGLARY',
  'CRIMINAL MISCHIEF & RELATED OF',
  'OTHER OFFENSES RELATED TO THEFT',
  'THEFT-FRAUD',
  'POSSESSION OF STOLEN PROPERTY',
  'UNAUTHORIZED USE OF A VEHICLE',
  'ARSON',
];

async function incidents() {
  const list = [...PERSON, ...PROPERTY].map((c) => `'${c.replaceAll("'", "''")}'`).join(',');
  let n = 0;
  await sql`DELETE FROM incidents WHERE city_id = 'nyc'`;
  for await (const page of socrata('5uac-w243', {
    $select: 'cmplnt_num,ofns_desc,cmplnt_fr_dt,cmplnt_fr_tm,latitude,longitude',
    // Some complaint dates are typos (year 1016), so bound the complaint date itself, not just the report date.
    $where: `ofns_desc in (${list}) AND latitude IS NOT NULL AND rpt_dt >= '2025-01-01' AND cmplnt_fr_dt >= '2024-01-01'`,
    $order: 'cmplnt_num',
  })) {
    const rows = page.filter((r) => r.cmplnt_fr_dt && Number(r.latitude) !== 0);
    await sql`
      INSERT INTO incidents (city_id, source_id, bucket, category, occurred_at, geom)
      SELECT 'nyc', i.id, CASE WHEN i.cat = ANY(${PERSON}::text[]) THEN 'person' ELSE 'property' END, i.cat,
             (left(i.d, 10) || ' ' || coalesce(nullif(i.t, ''), '00:00:00'))::timestamp AT TIME ZONE 'America/New_York',
             ST_SetSRID(ST_MakePoint(i.lng, i.lat), 4326)
      FROM unnest(${rows.map((r) => r.cmplnt_num as string)}::text[],
                  ${rows.map((r) => r.ofns_desc as string)}::text[],
                  ${rows.map((r) => r.cmplnt_fr_dt as string)}::text[],
                  ${rows.map((r) => r.cmplnt_fr_tm ?? '')}::text[],
                  ${rows.map((r) => Number(r.longitude))}::float8[],
                  ${rows.map((r) => Number(r.latitude))}::float8[])
           AS i(id, cat, d, t, lng, lat)`;
    n += rows.length;
    process.stdout.write(`\rincidents: ${n}`);
  }
  console.log(`\rincidents: ${n} rows (person + property buckets)`);
}

try {
  if (!only || only === 'stations') await stations();
  if (!only || only === 'events') await events();
  if (!only || only === 'incidents') await incidents();
} finally {
  await sql.end();
}
