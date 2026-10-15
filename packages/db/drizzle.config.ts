import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54522/postgres',
  },
  // PostGIS / pgRouting / Supabase own these; never let drizzle-kit touch them.
  schemaFilter: ['public'],
  tablesFilter: ['!spatial_ref_sys', '!ways*', '!osm_*', '!configuration', '!pointsofinterest'],
});
