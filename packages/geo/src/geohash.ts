import ngeohash from 'ngeohash';

/**
 * Qloo city heatmaps come back as geohash-6 cells (≈1.2km × 0.6km); country-wide
 * heatmaps as geohash-4 (≈39km × 20km). Confirmed by the probe, Oct 13.
 */
export const CELL_PRECISION = 6;
export const COUNTRY_CELL_PRECISION = 4;

export function encode(lat: number, lng: number, precision = CELL_PRECISION): string {
  return ngeohash.encode(lat, lng, precision);
}

/** Cell centroid as [lng, lat] (GeoJSON / WKT order). */
export function centroid(geohash: string): [number, number] {
  const { latitude, longitude } = ngeohash.decode(geohash);
  return [longitude, latitude];
}

/** WKT POINT for PostGIS snapping, longitude first. */
export function centroidWkt(geohash: string): string {
  const [lng, lat] = centroid(geohash);
  return `POINT(${lng} ${lat})`;
}

/** Re-bucket finer cells to a coarser precision (used where data is thin, e.g. NOLA/LA). */
export function coarsen<T extends { geohash: string; affinity: number }>(
  cells: T[],
  precision: number,
) {
  const groups = new Map<string, { sum: number; n: number }>();
  for (const c of cells) {
    const key = c.geohash.slice(0, precision);
    const g = groups.get(key) ?? { sum: 0, n: 0 };
    g.sum += c.affinity;
    g.n += 1;
    groups.set(key, g);
  }
  return [...groups].map(([geohash, g]) => ({ geohash, affinity: g.sum / g.n }));
}
