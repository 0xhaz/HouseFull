import type { Db } from './index.js';

export type Snapped = {
  geohash: string;
  neighborhoodId: string;
  name: string;
  /** Share of the cell's area inside this neighborhood (0–1]. */
  share: number;
};

// These use the postgres.js client directly: it binds JS arrays as Postgres arrays,
// while drizzle's sql`` template expands them into tuples.

/**
 * Area-weighted snapping: each geohash cell is split across the residential
 * neighborhoods it overlaps. City heatmap cells (geohash-6, ~0.7 km²) are coarse
 * next to NYC neighborhoods (~3 km²), so centroid snapping left most areas with
 * one or two cells. Slivers under 2% are dropped; water, parks and airports drop out.
 */
export async function snapToNeighborhoods(
  db: Db,
  cityId: string,
  geohashes: string[],
): Promise<Snapped[]> {
  if (geohashes.length === 0) return [];
  const sql = db.$client;
  const rows = await sql<
    { geohash: string; neighborhood_id: string; name: string; share: number }[]
  >`
    WITH c AS (
      SELECT g AS geohash, ST_SetSRID(ST_GeomFromGeoHash(g), 4326) AS cell
      FROM unnest(${geohashes}::text[]) AS g
    )
    SELECT c.geohash, n.id AS neighborhood_id, n.name,
           ST_Area(ST_Intersection(n.geom, c.cell)::geography) / ST_Area(c.cell::geography) AS share
    FROM c
    JOIN neighborhoods n ON n.city_id = ${cityId} AND n.residential AND ST_Intersects(n.geom, c.cell)`;
  return rows
    .map((r) => ({
      geohash: r.geohash,
      neighborhoodId: r.neighborhood_id,
      name: r.name,
      share: Number(r.share),
    }))
    .filter((r) => r.share >= 0.02);
}

/** Straight-line km from each neighborhood's interior point to a venue (until GTFS travel times land). */
export async function neighborhoodDistancesKm(db: Db, cityId: string, lng: number, lat: number) {
  const sql = db.$client;
  const rows = await sql<{ id: string; km: number }[]>`
    SELECT id,
           ST_Distance(ST_PointOnSurface(geom)::geography,
                       ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000 AS km
    FROM neighborhoods WHERE city_id = ${cityId} AND residential`;
  return new Map(rows.map((r) => [r.id, Number(r.km)]));
}

export type AccessResult = {
  mode: 'transit' | 'drive';
  /** 'gtfs' = routed on the station graph; 'distance' = straight-line estimate. */
  method: 'gtfs' | 'distance';
  minutes: Map<string, number>;
};

const WALK_M_PER_MIN = 80;
const WALK_DETOUR = 1.3;
/** Average wait for a train (≈ half a typical evening headway). */
const WAIT_MIN = 4;
/** Beyond ~1 km people take a bus to the subway: 6 min wait + 4 min/km (≈15 km/h). */
const FIRST_MILE_WALK_M = 1000;
const BUS_WAIT_MIN = 6;
const BUS_MIN_PER_KM = 4;

/**
 * Minutes from each residential neighborhood to the venue.
 * NYC: walk to one of the 4 nearest stations → wait → ride (pgRouting on
 * `transit_edges`) → walk from one of the 4 stations nearest the venue; or walk
 * directly when that's faster. Cities without a graph fall back to a distance
 * estimate (LA as driving, per the architecture's travel-time decision).
 */
export async function accessMinutes(
  db: Db,
  cityId: string,
  lng: number,
  lat: number,
): Promise<AccessResult> {
  if (!/^[a-z]+$/.test(cityId)) throw new Error(`Bad city id: ${cityId}`);
  const mode = cityId === 'la' ? 'drive' : 'transit';
  const sql = db.$client;
  const [graph] = await sql<
    { n: number }[]
  >`SELECT count(*)::int AS n FROM transit_edges WHERE city_id = ${cityId}`;

  if (!graph?.n) {
    const km = await neighborhoodDistancesKm(db, cityId, lng, lat);
    // Rough door-to-door: drive 8 min + 2.4 min/km (≈25 km/h with parking); transit 10 min + 3 min/km.
    const est = mode === 'drive' ? (d: number) => 8 + 2.4 * d : (d: number) => 10 + 3 * d;
    return { mode, method: 'distance', minutes: new Map([...km].map(([id, d]) => [id, est(d)])) };
  }

  const edgesSql = `SELECT id, source, target, minutes AS cost FROM transit_edges WHERE city_id = '${cityId}'`;
  const rows = await sql<{ id: string; minutes: number }[]>`
    WITH venue AS (SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) AS g),
    ends AS (
      SELECT s.node_id, ST_Distance(s.geom::geography, venue.g::geography) * ${WALK_DETOUR} / ${WALK_M_PER_MIN} AS walk_out
      FROM transit_stations s, venue WHERE s.city_id = ${cityId}
      ORDER BY s.geom <-> venue.g LIMIT 4
    ),
    ride AS (
      SELECT start_vid AS node_id, end_vid, agg_cost FROM pgr_dijkstraCost(
        ${edgesSql},
        (SELECT array_agg(node_id) FROM transit_stations WHERE city_id = ${cityId}),
        (SELECT array_agg(node_id) FROM ends), directed := true)
      UNION ALL SELECT node_id, node_id, 0 FROM ends
    ),
    to_venue AS (
      SELECT r.node_id, min(r.agg_cost + e.walk_out) AS minutes
      FROM ride r JOIN ends e ON e.node_id = r.end_vid GROUP BY r.node_id
    ),
    hoods AS (
      SELECT id, ST_PointOnSurface(geom) AS p FROM neighborhoods WHERE city_id = ${cityId} AND residential
    )
    SELECT h.id,
           LEAST(
             ST_Distance(h.p::geography, venue.g::geography) * ${WALK_DETOUR} / ${WALK_M_PER_MIN},
             min(st.walk_in + ${WAIT_MIN} + tv.minutes)
           ) AS minutes
    FROM hoods h CROSS JOIN venue
    CROSS JOIN LATERAL (
      SELECT s.node_id,
             CASE WHEN d.m <= ${FIRST_MILE_WALK_M}::float8 THEN d.m * ${WALK_DETOUR}::float8 / ${WALK_M_PER_MIN}::float8
                  ELSE ${FIRST_MILE_WALK_M}::float8 * ${WALK_DETOUR}::float8 / ${WALK_M_PER_MIN}::float8 + ${BUS_WAIT_MIN}::float8
                       + (d.m - ${FIRST_MILE_WALK_M}::float8) / 1000 * ${BUS_MIN_PER_KM}::float8 END AS walk_in
      FROM transit_stations s
      CROSS JOIN LATERAL (SELECT ST_Distance(s.geom::geography, h.p::geography) AS m) d
      WHERE s.city_id = ${cityId}
      ORDER BY s.geom <-> h.p LIMIT 4
    ) st
    JOIN to_venue tv ON tv.node_id = st.node_id
    GROUP BY h.id, h.p, venue.g`;
  const minutes = new Map(rows.map((r) => [r.id, Number(r.minutes)]));
  // Areas the graph doesn't reach (e.g. Staten Island: its railway is a separate feed) use the estimate.
  const km = await neighborhoodDistancesKm(db, cityId, lng, lat);
  for (const [id, d] of km) if (!minutes.has(id)) minutes.set(id, 10 + 3 * d);
  return { mode, method: 'gtfs', minutes };
}

export type CityEventRow = {
  id: string;
  sourceId: string;
  title: string;
  type: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  borough: string | null;
  lng: number | null;
  lat: number | null;
};

/** Permitted events overlapping a time window (F7). */
export async function cityEventsInWindow(
  db: Db,
  cityId: string,
  start: Date,
  end: Date,
): Promise<CityEventRow[]> {
  const sql = db.$client;
  const rows = await sql<
    Array<{
      id: string;
      source_id: string;
      title: string;
      type: string;
      starts_at: Date;
      ends_at: Date;
      location: string | null;
      borough: string | null;
      lng: number | null;
      lat: number | null;
    }>
  >`
    SELECT id, source_id, title, type, starts_at, ends_at, location, borough,
           ST_X(ST_Centroid(geom)) AS lng, ST_Y(ST_Centroid(geom)) AS lat
    FROM city_events
    WHERE city_id = ${cityId}
      AND starts_at < ${end.toISOString()}::timestamptz AND ends_at > ${start.toISOString()}::timestamptz
    ORDER BY starts_at
    LIMIT 200`;
  return rows.map((r) => ({
    id: r.id,
    sourceId: r.source_id,
    title: r.title,
    type: r.type,
    // Raw queries can return timestamps as strings; normalize.
    startsAt: new Date(r.starts_at),
    endsAt: new Date(r.ends_at),
    location: r.location,
    borough: r.borough,
    lng: r.lng === null ? null : Number(r.lng),
    lat: r.lat === null ? null : Number(r.lat),
  }));
}

/** Caches a geocoded event point so each permit is geocoded once. */
export async function setCityEventPoint(db: Db, id: string, lng: number, lat: number) {
  const sql = db.$client;
  await sql`UPDATE city_events SET geom = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) WHERE id = ${id}`;
}

/** Routes at stations within `radiusM` of a point (or the nearest station if none is that close). */
export async function routesNearPoint(
  db: Db,
  cityId: string,
  lng: number,
  lat: number,
  radiusM = 800,
) {
  const sql = db.$client;
  const rows = await sql<Array<{ name: string; routes: string[]; m: number }>>`
    SELECT name, routes, ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) AS m
    FROM transit_stations WHERE city_id = ${cityId}
    ORDER BY geom <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) LIMIT 6`;
  const near = rows.filter((r) => r.m <= radiusM);
  return (near.length ? near : rows.slice(0, 1)).map((r) => ({
    name: r.name,
    routes: r.routes,
    meters: Math.round(r.m),
  }));
}

/** Routes at the two stations nearest each named neighborhood. */
export async function routesForNeighborhoods(db: Db, cityId: string, names: string[]) {
  if (names.length === 0) return new Map<string, string[]>();
  const sql = db.$client;
  const rows = await sql<Array<{ name: string; routes: string[] }>>`
    SELECT n.name, array_agg(DISTINCT r) AS routes
    FROM neighborhoods n
    CROSS JOIN LATERAL (
      SELECT s.routes FROM transit_stations s WHERE s.city_id = n.city_id
      ORDER BY s.geom <-> ST_PointOnSurface(n.geom) LIMIT 2
    ) s
    CROSS JOIN LATERAL unnest(s.routes) AS r
    WHERE n.city_id = ${cityId} AND n.name = ANY(${names}::text[])
    GROUP BY n.name`;
  return new Map(rows.map((r) => [r.name, r.routes]));
}

/** A representative point inside each named neighborhood (for ad drop pins). */
export async function neighborhoodPoints(db: Db, cityId: string, names: string[]) {
  if (names.length === 0) return new Map<string, { lng: number; lat: number }>();
  const sql = db.$client;
  const rows = await sql<Array<{ name: string; lng: number; lat: number }>>`
    SELECT name, ST_X(ST_PointOnSurface(geom)) AS lng, ST_Y(ST_PointOnSurface(geom)) AS lat
    FROM neighborhoods WHERE city_id = ${cityId} AND name = ANY(${names}::text[])`;
  return new Map(rows.map((r) => [r.name, { lng: Number(r.lng), lat: Number(r.lat) }]));
}
