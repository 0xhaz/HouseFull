import { type Db, fixtures, qlooCache, qlooCalls } from '@housefull/db';
import {
  type CacheStore,
  type FixtureStore,
  MemoryBudget,
  QlooClient,
  type TraceSink,
  UpstashBudget,
  UpstashCache,
} from '@housefull/qloo-client';
import { Global, Inject, Logger, Module } from '@nestjs/common';
import { Redis } from '@upstash/redis';
import { and, eq, gt } from 'drizzle-orm';
import { DB } from '../db/db.module.js';
import { RunEventLog } from './run-events.js';

export const QLOO = Symbol('QLOO');
export const InjectQloo = () => Inject(QLOO);

/** Postgres-backed cache for local dev and as a fallback when Upstash isn't configured. */
function pgCache(db: Db): CacheStore {
  return {
    async get(key) {
      const [row] = await db
        .select({ value: qlooCache.value })
        .from(qlooCache)
        .where(and(eq(qlooCache.key, key), gt(qlooCache.expiresAt, new Date())));
      return row?.value;
    },
    async set(key, value, ttlSeconds) {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      await db
        .insert(qlooCache)
        .values({ key, value, expiresAt })
        .onConflictDoUpdate({ target: qlooCache.key, set: { value, expiresAt } });
    },
  };
}

function pgFixtures(db: Db): FixtureStore {
  return {
    async get(key) {
      const [row] = await db
        .select({ response: fixtures.response })
        .from(fixtures)
        .where(eq(fixtures.key, key));
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
}

@Global()
@Module({
  providers: [
    RunEventLog,
    {
      provide: QLOO,
      inject: [DB, RunEventLog],
      useFactory: (db: Db, log: RunEventLog) => {
        const logger = new Logger('Qloo');
        const daily = Number(process.env.QLOO_DAILY_BUDGET || 1500);
        const perIp = Number(process.env.QLOO_PER_IP_DAILY || 300);
        const redis =
          process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
            ? Redis.fromEnv()
            : undefined;

        const trace: TraceSink = {
          async record(call) {
            if (call.runId) {
              log.append(call.runId, {
                type: 'qloo',
                callId: call.id,
                endpoint: call.endpoint,
                filterType: call.params['filter.type'],
                status: call.status,
                ms: call.ms,
                source: call.source,
              });
            }
            // Params and a trimmed digest only: never the full response, never the key.
            await db
              .insert(qlooCalls)
              .values({ ...call, createdAt: new Date(call.createdAt) })
              .catch((e: Error) => logger.warn(`qloo_calls insert failed: ${e.message}`));
          },
        };

        const demoMode = process.env.DEMO_MODE === 'true' || !process.env.QLOO_API_KEY;
        if (!process.env.QLOO_API_KEY)
          logger.warn('QLOO_API_KEY not set: serving recorded fixtures only');
        logger.log(
          `cache=${redis ? 'upstash' : 'postgres'} budget=${daily}/day demoMode=${demoMode}`,
        );
        return new QlooClient({
          apiKey: process.env.QLOO_API_KEY || undefined,
          baseUrl: process.env.QLOO_API_URL || undefined,
          demoMode,
          // Record every live response so presets keep working in demo mode.
          recordFixtures: process.env.QLOO_RECORD_FIXTURES !== 'false',
          cache: redis ? new UpstashCache(redis) : pgCache(db),
          budget: redis ? new UpstashBudget(redis, daily, perIp) : new MemoryBudget(daily, perIp),
          fixtures: pgFixtures(db),
          trace,
        });
      },
    },
  ],
  exports: [QLOO, RunEventLog],
})
export class QlooModule {}
