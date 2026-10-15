import type { Db } from './index.js';

/**
 * F8 queries. Incident data is shown to promoters as plain counts only, compared
 * with similar nightlife areas, and never feeds audience ranking.
 */

/** Show hours for incident context: 21:00–02:59 local. */
const SHOW_HOURS = [21, 22, 23, 0, 1, 2];

export type IncidentCounts = { person: number; property: number };

/** Incidents within `radiusM` of a point during show hours over the last 12 months of data. */
export async function incidentsNear(
  db: Db,
  cityId: string,
  lng: number,
  lat: number,
  radiusM = 300,
): Promise<IncidentCounts> {
  const sql = db.$client;
  const [row] = await sql<Array<{ person: number; property: number }>>`
    WITH latest AS (SELECT max(occurred_at) AS t FROM incidents WHERE city_id = ${cityId})
    SELECT count(*) FILTER (WHERE bucket = 'person')::int AS person,
           count(*) FILTER (WHERE bucket = 'property')::int AS property
    FROM incidents, latest
    WHERE city_id = ${cityId}
      AND occurred_at > latest.t - interval '12 months'
      AND extract(hour FROM occurred_at AT TIME ZONE 'America/New_York') = ANY(${SHOW_HOURS}::int[])
      AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusM})`;
  return { person: row?.person ?? 0, property: row?.property ?? 0 };
}

/**
 * Peer comparison (decision #17): sample cells in the same nightlife-baseline
 * decile as the venue and take the median of their incident counts.
 */
export async function peerIncidentMedian(
  db: Db,
  cityId: string,
  lng: number,
  lat: number,
  samples = 25,
) {
  const sql = db.$client;
  const cells = await sql<Array<{ lng: number; lat: number }>>`
    WITH ranked AS (
      SELECT geohash, ntile(10) OVER (ORDER BY affinity) AS decile,
             ST_SetSRID(ST_GeomFromGeoHash(geohash), 4326) AS cell
      FROM baseline_cells WHERE city_id = ${cityId}
    ),
    venue AS (
      SELECT decile FROM ranked
      WHERE ST_Contains(cell, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)) LIMIT 1
    )
    SELECT ST_X(ST_Centroid(r.cell)) AS lng, ST_Y(ST_Centroid(r.cell)) AS lat
    FROM ranked r, venue v, cities c
    WHERE r.decile = v.decile AND c.id = ${cityId}
      AND ST_Contains(c.polygon, ST_Centroid(r.cell))
      AND NOT ST_Contains(r.cell, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
    ORDER BY md5(r.geohash) LIMIT ${samples}`;
  if (cells.length < 5) return undefined;
  const counts = await Promise.all(
    cells.map((c) => incidentsNear(db, cityId, Number(c.lng), Number(c.lat))),
  );
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)] as number;
  };
  return {
    person: median(counts.map((c) => c.person)),
    property: median(counts.map((c) => c.property)),
    peers: cells.length,
  };
}

export type LateStation = {
  name: string;
  gtfsStopId: string;
  meters: number;
  lng: number;
  lat: number;
  routes: Array<{ route: string; headwayMin: number }>;
};

/** Stations within `radiusM` (or the nearest 3) with after-show headways for the show's day type. */
export async function lateStations(
  db: Db,
  cityId: string,
  lng: number,
  lat: number,
  dayType: string,
  radiusM = 1000,
) {
  const sql = db.$client;
  const rows = await sql<
    Array<{
      name: string;
      gtfs_stop_id: string;
      m: number;
      lng: number;
      lat: number;
      routes: Array<{ route: string; headway: number }> | null;
    }>
  >`
    WITH near AS (
      SELECT gtfs_stop_id, name, geom,
             ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) AS m
      FROM transit_stations WHERE city_id = ${cityId}
      ORDER BY geom <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) LIMIT 8
    )
    SELECT n.name, n.gtfs_stop_id, n.m, ST_X(n.geom) AS lng, ST_Y(n.geom) AS lat,
           (SELECT json_agg(json_build_object('route', s.route, 'headway', s.headway_min) ORDER BY s.headway_min)
            FROM station_service s
            WHERE s.city_id = ${cityId} AND s.gtfs_stop_id = n.gtfs_stop_id AND s.day_type = ${dayType}) AS routes
    FROM near n ORDER BY n.m`;
  const near = rows.filter((r) => r.m <= radiusM);
  return (near.length >= 2 ? near : rows.slice(0, 3)).map(
    (r): LateStation => ({
      name: r.name,
      gtfsStopId: r.gtfs_stop_id,
      meters: Math.round(r.m),
      lng: Number(r.lng),
      lat: Number(r.lat),
      routes: (r.routes ?? []).map((x) => ({
        route: x.route,
        headwayMin: Math.round(x.headway * 10) / 10,
      })),
    }),
  );
}

export type WalkRoute = {
  geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
  meters: number;
  shortestMeters: number;
  /** True when the weighted route was too long and the shortest walk is used instead. */
  fellBackToShortest: boolean;
  litPct: number | null;
  mainStreetPct: number;
  incidentsPerKm: number;
};

/** Decision #16: route weights; lighting is dropped when < 30% of edges are tagged. */
export const ROUTE_WEIGHTS = { incidents: 0.5, active: 0.3, lit: 0.2 } as const;
const MAX_DETOUR = 1.25;
const MAIN = [
  'primary',
  'primary_link',
  'secondary',
  'secondary_link',
  'tertiary',
  'tertiary_link',
];

/**
 * Suggested late-night walk from the venue to a station with pgRouting on the
 * OSM foot network: cost = length × (1 + a·incidentDensity − b·mainStreet − c·lit),
 * capped at 25% longer than the shortest path (else the shortest is returned).
 */
export async function lateNightWalk(
  db: Db,
  cityId: string,
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
): Promise<WalkRoute | undefined> {
  if (!/^[a-z]+$/.test(cityId)) throw new Error(`Bad city id: ${cityId}`);
  const sql = db.$client;
  const pad = 0.006; // ~600 m around the straight line
  const [w, e] = [Math.min(from.lng, to.lng) - pad, Math.max(from.lng, to.lng) + pad];
  const [s, n] = [Math.min(from.lat, to.lat) - pad, Math.max(from.lat, to.lat) + pad];
  const box = `ST_MakeEnvelope(${w}, ${s}, ${e}, ${n}, 4326)`;

  const [cov] = await sql<Array<{ lit_pct: number | null; edges: number }>>`
    SELECT count(*)::int AS edges, 100.0 * count(*) FILTER (WHERE lit IS NOT NULL) / nullif(count(*), 0) AS lit_pct
    FROM foot_edges WHERE city_id = ${cityId} AND geom && ${sql.unsafe(box)}`;
  if (!cov?.edges) return undefined;
  const useLit = (cov.lit_pct ?? 0) >= 30;
  const c = useLit ? ROUTE_WEIGHTS.lit : 0;

  // Edge features inside the box; incidents in show hours within 40 m, per km.
  const edgesFeatures = `
    WITH latest AS (SELECT max(occurred_at) AS t FROM incidents WHERE city_id = '${cityId}'),
    e AS (
      SELECT f.id, f.source, f.target, f.length_m, f.lit, f.highway, f.geom,
             (SELECT count(*) FROM incidents i, latest
               WHERE i.city_id = '${cityId}' AND i.occurred_at > latest.t - interval '12 months'
                 AND extract(hour FROM i.occurred_at AT TIME ZONE 'America/New_York') IN (21,22,23,0,1,2)
                 -- Geometry (degrees) so the GIST index is used; 0.0004° ≈ 40 m at NYC's latitude.
                 AND ST_DWithin(i.geom, f.geom, 0.0004)) AS inc
      FROM foot_edges f WHERE f.city_id = '${cityId}' AND f.geom && ${box}
    ),
    norm AS (SELECT e.*, inc / greatest(length_m / 1000.0, 0.05) AS inc_km FROM e),
    scaled AS (SELECT norm.*, inc_km / nullif(max(inc_km) OVER (), 0) AS inc_n FROM norm)`;
  const weighted = `${edgesFeatures}
    SELECT id, source, target,
           length_m * greatest(0.5, 1 + ${ROUTE_WEIGHTS.incidents} * coalesce(inc_n, 0)
                              - ${ROUTE_WEIGHTS.active} * (highway = ANY('{${MAIN.join(',')}}'))::int
                              - ${c} * coalesce(lit, false)::int) AS cost,
           length_m * greatest(0.5, 1 + ${ROUTE_WEIGHTS.incidents} * coalesce(inc_n, 0)
                              - ${ROUTE_WEIGHTS.active} * (highway = ANY('{${MAIN.join(',')}}'))::int
                              - ${c} * coalesce(lit, false)::int) AS reverse_cost
    FROM scaled`;
  const shortest = `SELECT id, source, target, length_m AS cost, length_m AS reverse_cost
    FROM foot_edges WHERE city_id = '${cityId}' AND geom && ${box}`;

  const vertex = async (p: { lng: number; lat: number }) => {
    const [v] = await sql<Array<{ v: number }>>`
      SELECT CASE WHEN ST_Distance(ST_StartPoint(geom), pt) < ST_Distance(ST_EndPoint(geom), pt) THEN source ELSE target END AS v
      FROM foot_edges, (SELECT ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326) AS pt) q
      WHERE city_id = ${cityId} AND geom && ${sql.unsafe(box)}
      ORDER BY geom <-> pt LIMIT 1`;
    return v?.v;
  };
  const [a, b] = await Promise.all([vertex(from), vertex(to)]);
  if (a === undefined || b === undefined) return undefined;

  const path = async (edgesSql: string) =>
    sql<
      Array<{ seq: number; edge: number }>
    >`SELECT seq, edge FROM pgr_dijkstra(${edgesSql}, ${a}::bigint, ${b}::bigint, directed := false) WHERE edge > 0 ORDER BY seq`;
  const [best, base] = await Promise.all([path(weighted), path(shortest)]);
  if (base.length === 0) return undefined;
  const lengthOf = async (ids: number[]) =>
    Number(
      (
        await sql<
          Array<{ m: number }>
        >`SELECT coalesce(sum(length_m), 0) AS m FROM foot_edges WHERE id = ANY(${ids}::bigint[])`
      )[0]?.m ?? 0,
    );
  const shortestM = await lengthOf(base.map((r) => r.edge));
  let ids = best.map((r) => r.edge);
  let meters = ids.length ? await lengthOf(ids) : Number.POSITIVE_INFINITY;
  const fell = meters > shortestM * MAX_DETOUR;
  if (fell) {
    ids = base.map((r) => r.edge);
    meters = shortestM;
  }

  const [stats] = await sql<
    Array<{
      coords: Array<[number, number]>;
      lit_pct: number | null;
      main_pct: number;
      inc: number;
    }>
  >`
    WITH p AS (SELECT f.*, ord FROM unnest(${ids}::bigint[]) WITH ORDINALITY AS u(id, ord) JOIN foot_edges f ON f.id = u.id),
    pts AS (
      SELECT (ST_DumpPoints(geom)).geom AS g, ord, (ST_DumpPoints(geom)).path[1] AS k FROM p
    ),
    latest AS (SELECT max(occurred_at) AS t FROM incidents WHERE city_id = ${cityId})
    SELECT
      (SELECT json_agg(json_build_array(round(ST_X(g)::numeric, 6), round(ST_Y(g)::numeric, 6)) ORDER BY ord, k) FROM pts) AS coords,
      (SELECT 100.0 * sum(length_m) FILTER (WHERE lit) / nullif(sum(length_m) FILTER (WHERE lit IS NOT NULL), 0) FROM p) AS lit_pct,
      (SELECT 100.0 * sum(length_m) FILTER (WHERE highway = ANY(${MAIN}::text[])) / nullif(sum(length_m), 0) FROM p) AS main_pct,
      (SELECT count(*) FROM incidents i, latest
        WHERE i.city_id = ${cityId} AND i.occurred_at > latest.t - interval '12 months'
          AND extract(hour FROM i.occurred_at AT TIME ZONE 'America/New_York') = ANY(${SHOW_HOURS}::int[])
          AND EXISTS (SELECT 1 FROM p WHERE ST_DWithin(i.geom, p.geom, 0.0004))) AS inc`;
  return {
    geometry: {
      type: 'LineString',
      coordinates: (stats?.coords ?? []).map(([x, y]) => [Number(x), Number(y)]),
    },
    meters: Math.round(meters),
    shortestMeters: Math.round(shortestM),
    fellBackToShortest: fell,
    litPct:
      useLit && stats?.lit_pct !== null && stats?.lit_pct !== undefined
        ? Math.round(Number(stats.lit_pct))
        : null,
    mainStreetPct: Math.round(Number(stats?.main_pct ?? 0)),
    incidentsPerKm: Math.round((Number(stats?.inc ?? 0) / Math.max(meters / 1000, 0.1)) * 10) / 10,
  };
}
