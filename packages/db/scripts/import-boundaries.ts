/**
 * Imports neighborhood boundaries for the three launch cities into `neighborhoods`
 * and sets each city's outline. Sources and licences: data/boundaries/SOURCES.md.
 *
 *   pnpm import:boundaries
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

type Feature = { properties: Record<string, unknown>; geometry: unknown };
type Source = {
  city: 'nyc' | 'nola' | 'la';
  cityName: string;
  url: string;
  map: (p: Record<string, unknown>) => { sourceId: string; name: string; residential: boolean };
};

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const SOURCES: Source[] = [
  {
    city: 'nyc',
    cityName: 'New York',
    url: 'https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson?$limit=1000',
    // ntatype 0 = residential; 5–9 = Rikers, special areas, cemeteries, airports, parks.
    map: (p) => ({
      sourceId: String(p.nta2020),
      name: String(p.ntaname),
      residential: p.ntatype === '0',
    }),
  },
  {
    city: 'nola',
    cityName: 'New Orleans',
    url: 'https://data.nola.gov/resource/exvn-jeh2.geojson?$limit=1000',
    map: (p) => ({
      sourceId: String(p.neigh_id ?? p.objectid),
      name: titleCase(String(p.gnocdc_lab)),
      residential: true,
    }),
  },
  {
    city: 'la',
    cityName: 'Los Angeles',
    url: 'https://maps.lacity.org/lahub/rest/services/Boundaries/MapServer/18/query?where=1=1&outFields=NC_ID,NAME&outSR=4326&f=geojson',
    map: (p) => ({
      sourceId: String(p.NC_ID),
      name: titleCase(String(p.NAME).replace(/\s+NC$/, '')),
      residential: true,
    }),
  },
];

const CACHE = join(import.meta.dirname, '../../../data/boundaries/cache');
mkdirSync(CACHE, { recursive: true });

async function load(src: Source): Promise<Feature[]> {
  const file = join(CACHE, `${src.city}.geojson`);
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    const res = await fetch(src.url);
    if (!res.ok) throw new Error(`${src.city}: ${res.status} from ${src.url}`);
    text = await res.text();
    writeFileSync(file, text);
  }
  const fc = JSON.parse(text) as { features?: Feature[] };
  if (!fc.features?.length) throw new Error(`${src.city}: no features`);
  return fc.features;
}

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54522/postgres';
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  for (const src of SOURCES) {
    const features = await load(src);
    await sql.begin(async (tx) => {
      await tx`INSERT INTO cities (id, name) VALUES (${src.city}, ${src.cityName})
               ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`;
      await tx`DELETE FROM neighborhoods WHERE city_id = ${src.city}`;
      for (const f of features) {
        const m = src.map(f.properties);
        // MakeValid + CollectionExtract(…, 3) keeps only polygons from any repaired geometry.
        await tx`
          INSERT INTO neighborhoods (id, city_id, source_id, name, residential, geom)
          VALUES (
            ${`${src.city}:${m.sourceId}`}, ${src.city}, ${m.sourceId}, ${m.name}, ${m.residential},
            ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(f.geometry)}), 4326)), 3))
          )`;
      }
      await tx`UPDATE cities SET polygon = (
                 SELECT ST_Multi(ST_Union(geom)) FROM neighborhoods WHERE city_id = ${src.city}
               ) WHERE id = ${src.city}`;
    });
    const [row] =
      await sql`SELECT count(*)::int AS n, count(*) FILTER (WHERE residential)::int AS res,
                                   round(ST_Area(polygon::geography) / 1e6)::int AS km2
                            FROM neighborhoods JOIN cities ON cities.id = city_id
                            WHERE city_id = ${src.city} GROUP BY polygon`;
    console.log(
      `${src.city}: ${row?.n} neighborhoods (${row?.res} residential), city area ≈ ${row?.km2} km²`,
    );
  }
} finally {
  await sql.end();
}
