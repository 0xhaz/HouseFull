/**
 * Visitor source cities (architecture step 4b, decision #5 Option A): one
 * country-wide Qloo heatmap (geohash-4 cells), aggregated around each large
 * US metro and divided by Qloo's own per-cell popularity, so a metro ranks high
 * because the segment over-indexes there, not because it's big.
 */

export type Metro = { name: string; lat: number; lng: number };

/** 25 largest US metros by population (approximate centers). */
export const US_METROS: Metro[] = [
  { name: 'New York', lat: 40.71, lng: -74.01 },
  { name: 'Los Angeles', lat: 34.05, lng: -118.24 },
  { name: 'Chicago', lat: 41.88, lng: -87.63 },
  { name: 'Dallas–Fort Worth', lat: 32.78, lng: -96.8 },
  { name: 'Houston', lat: 29.76, lng: -95.37 },
  { name: 'Atlanta', lat: 33.75, lng: -84.39 },
  { name: 'Washington, DC', lat: 38.9, lng: -77.04 },
  { name: 'Philadelphia', lat: 39.95, lng: -75.17 },
  { name: 'Miami', lat: 25.76, lng: -80.19 },
  { name: 'Phoenix', lat: 33.45, lng: -112.07 },
  { name: 'Boston', lat: 42.36, lng: -71.06 },
  { name: 'San Francisco Bay Area', lat: 37.77, lng: -122.42 },
  { name: 'Detroit', lat: 42.33, lng: -83.05 },
  { name: 'Seattle', lat: 47.61, lng: -122.33 },
  { name: 'Minneapolis–St. Paul', lat: 44.98, lng: -93.27 },
  { name: 'Tampa', lat: 27.95, lng: -82.46 },
  { name: 'San Diego', lat: 32.72, lng: -117.16 },
  { name: 'Denver', lat: 39.74, lng: -104.99 },
  { name: 'Baltimore', lat: 39.29, lng: -76.61 },
  { name: 'St. Louis', lat: 38.63, lng: -90.2 },
  { name: 'Orlando', lat: 28.54, lng: -81.38 },
  { name: 'Charlotte', lat: 35.23, lng: -80.84 },
  { name: 'Austin', lat: 30.27, lng: -97.74 },
  { name: 'Nashville', lat: 36.16, lng: -86.78 },
  { name: 'Portland, OR', lat: 45.52, lng: -122.68 },
];

export type CountryCell = { lat: number; lng: number; affinity: number; popularity: number };

export type MetroLift = { metro: string; score: number; cells: number };

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * score = (mean affinity + ε) / (mean popularity + ε) over cells within `radiusKm`.
 * Metros with fewer than `minCells` cells are left out rather than guessed.
 */
export function metroLift(
  cells: CountryCell[],
  metros: Metro[] = US_METROS,
  radiusKm = 40,
  minCells = 3,
  eps = 0.05,
): MetroLift[] {
  const out: MetroLift[] = [];
  for (const m of metros) {
    let aff = 0;
    let pop = 0;
    let n = 0;
    for (const c of cells) {
      if (haversineKm(m, c) > radiusKm) continue;
      aff += c.affinity;
      pop += c.popularity;
      n += 1;
    }
    if (n < minCells) continue;
    out.push({ metro: m.name, score: (aff / n + eps) / (pop / n + eps), cells: n });
  }
  return out.sort((a, b) => b.score - a.score);
}
