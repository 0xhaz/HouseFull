-- PostGIS for all geometry; pgRouting for F5 / F8 walking routes.
-- Supabase keeps extensions in the `extensions` schema, which is on the default search_path.
CREATE SCHEMA IF NOT EXISTS extensions;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgrouting WITH SCHEMA extensions;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
--> statement-breakpoint
-- Supabase already has `extensions` on the search_path; plain Postgres (CI) needs it set.
DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET search_path = "$user", public, extensions', current_database()); END $$;
--> statement-breakpoint
SET search_path = "$user", public, extensions;
