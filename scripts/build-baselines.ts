/**
 * Builds the nightlife baseline heatmap per city (architecture §5.3, decision #6)
 * and stores it in `baseline_cells`. Responses are also recorded in the private
 * `fixtures` table so demo mode can replay them. Kept for 7 days.
 *
 *   pnpm baselines            # all cities
 *   pnpm baselines nyc        # one city
 */
import { baselineCells, cities, createDb, fixtures } from '@housefull/db';
import { type FixtureStore, QlooClient, UpstashCache } from '@housefull/qloo-client';
import { Redis } from '@upstash/redis';
import { eq, sql } from 'drizzle-orm';

/** Resolved via /v2/tags in the probe (Oct 13): live music venue, bar, nightclub. */
export const NIGHTLIFE_TAGS = [
  'urn:tag:genre:place:live_music_venue',
  'urn:tag:genre:place:restaurant:bar',
  'urn:tag:dining_option:qloo:nightclub',
];

const db = createDb(
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54522/postgres',
  { max: 2 },
);

const pgFixtures: FixtureStore = {
  async get(key) {
    const [row] = await db.select().from(fixtures).where(eq(fixtures.key, key));
    return row?.response;
  },
  async set(key, value) {
    await db
      .insert(fixtures)
      .values({ key, response: value })
      .onConflictDoUpdate({
        target: fixtures.key,
        set: { response: value, createdAt: new Date() },
      });
  },
};

const redisConfigured = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
const qloo = new QlooClient({
  apiKey: process.env.QLOO_API_KEY,
  baseUrl: process.env.QLOO_API_URL || undefined,
  demoMode: process.env.DEMO_MODE === 'true',
  fixtures: pgFixtures,
  recordFixtures: true,
  ...(redisConfigured ? { cache: new UpstashCache(Redis.fromEnv()) } : {}),
});

const only = process.argv[2];
const targets = await db
  .select({ id: cities.id, bbox: sql<string>`ST_AsText(ST_Envelope(${cities.polygon}))` })
  .from(cities)
  .where(only ? eq(cities.id, only) : sql`true`);
if (targets.length === 0) throw new Error('No cities found: run `pnpm import:boundaries` first');

try {
  for (const city of targets) {
    // Bounding box, not the outline: a short WKT fits in a GET URL, and cells
    // outside the city drop out when they're snapped to neighborhoods.
    const res = await qloo.insights(
      {
        filterType: 'urn:heatmap',
        signal: { tags: NIGHTLIFE_TAGS, tagsOperator: 'union' },
        filter: { location: city.bbox },
      },
      { baseline: true },
    );
    const cells = res.data.results.heatmap ?? [];
    if (cells.length === 0) throw new Error(`${city.id}: baseline heatmap is empty`);
    await db.transaction(async (tx) => {
      await tx.delete(baselineCells).where(eq(baselineCells.cityId, city.id));
      for (let i = 0; i < cells.length; i += 1000) {
        await tx.insert(baselineCells).values(
          cells.slice(i, i + 1000).map((c) => ({
            cityId: city.id,
            geohash: c.location.geohash,
            affinity: c.query.affinity,
            popularity: c.query.popularity,
          })),
        );
      }
      await tx.update(cities).set({ baselineBuiltAt: new Date() }).where(eq(cities.id, city.id));
    });
    console.log(
      `${city.id}: ${cells.length} baseline cells (${res.meta.source}, ${res.meta.ms}ms)`,
    );
  }
} finally {
  await db.$client.end();
}
