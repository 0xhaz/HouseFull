import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export * from './schema.js';
export { schema };

export type Db = ReturnType<typeof createDb>;

/** One pool per process. `prepare: false` keeps it compatible with Supabase's transaction pooler. */
export function createDb(url = process.env.DATABASE_URL || undefined, opts: { max?: number } = {}) {
  if (!url) throw new Error('DATABASE_URL is not set');
  const client = postgres(url, { max: opts.max ?? 10, prepare: false });
  return Object.assign(drizzle(client, { schema }), { $client: client });
}
export * from './geo.js';
export * from './safety.js';
