CREATE TABLE "baseline_cells" (
	"city_id" text NOT NULL,
	"geohash" text NOT NULL,
	"affinity" real NOT NULL,
	"built_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "baseline_cells_city_id_geohash_pk" PRIMARY KEY("city_id","geohash")
);
--> statement-breakpoint
CREATE TABLE "brief_versions" (
	"run_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"brief" jsonb NOT NULL,
	"change_note" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brief_versions_run_id_version_pk" PRIMARY KEY("run_id","version")
);
--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"brief_version" integer NOT NULL,
	"by_segment" jsonb NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"polygon" geometry(MultiPolygon, 4326),
	"baseline_built_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "city_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" text NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"location" text,
	"borough" text,
	"community_board" text,
	"geom" geometry(Geometry, 4326),
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "fixtures" (
	"key" text PRIMARY KEY NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foot_edges" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"city_id" text NOT NULL,
	"source" integer NOT NULL,
	"target" integer NOT NULL,
	"length_m" real NOT NULL,
	"lit" boolean,
	"highway" text,
	"late_open_count" integer DEFAULT 0 NOT NULL,
	"geom" geometry(LineString, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" text NOT NULL,
	"source_id" text NOT NULL,
	"bucket" text NOT NULL,
	"category" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"geom" geometry(Point, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interest_map" (
	"qloo_tag_id" text NOT NULL,
	"platform" text NOT NULL,
	"interest_name" text NOT NULL,
	CONSTRAINT "interest_map_qloo_tag_id_platform_pk" PRIMARY KEY("qloo_tag_id","platform")
);
--> statement-breakpoint
CREATE TABLE "link_clicks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"day" date NOT NULL,
	"dedupe_hash" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "neighborhoods" (
	"id" text PRIMARY KEY NOT NULL,
	"city_id" text NOT NULL,
	"source_id" text NOT NULL,
	"name" text NOT NULL,
	"residential" boolean DEFAULT true NOT NULL,
	"geom" geometry(MultiPolygon, 4326) NOT NULL,
	"population" integer
);
--> statement-breakpoint
CREATE TABLE "qloo_calls" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid,
	"endpoint" text NOT NULL,
	"params" jsonb NOT NULL,
	"status" integer NOT NULL,
	"ms" integer NOT NULL,
	"source" text NOT NULL,
	"cached" boolean NOT NULL,
	"response_digest" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"input" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"brief" jsonb,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "season_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"show_run_ids" uuid[] NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signup_destinations" (
	"venue_id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"webhook_url_encrypted" text,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signup_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"email_encrypted" text NOT NULL,
	"consent_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"heard_via" text,
	"also_likes" text[] DEFAULT '{}'::text[] NOT NULL,
	"would_return" boolean,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"venue_id" uuid,
	"options" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_links" (
	"code" text PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"segment_id" text NOT NULL,
	"channel" text NOT NULL,
	"destination" text NOT NULL,
	"target_url" text NOT NULL,
	"promo_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transit_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" text NOT NULL,
	"gtfs_stop_id" text NOT NULL,
	"name" text NOT NULL,
	"routes" text[] NOT NULL,
	"geom" geometry(Point, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" text NOT NULL,
	"name" text NOT NULL,
	"geom" geometry(Point, 4326) NOT NULL,
	"capacity" integer,
	"ticketmaster_id" text,
	CONSTRAINT "venues_ticketmaster_id_unique" UNIQUE("ticketmaster_id")
);
--> statement-breakpoint
ALTER TABLE "baseline_cells" ADD CONSTRAINT "baseline_cells_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_versions" ADD CONSTRAINT "brief_versions_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_events" ADD CONSTRAINT "city_events_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foot_edges" ADD CONSTRAINT "foot_edges_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_clicks" ADD CONSTRAINT "link_clicks_code_tracking_links_code_fk" FOREIGN KEY ("code") REFERENCES "public"."tracking_links"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qloo_calls" ADD CONSTRAINT "qloo_calls_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_runs" ADD CONSTRAINT "season_runs_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_destinations" ADD CONSTRAINT "signup_destinations_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_links" ADD CONSTRAINT "tracking_links_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transit_stations" ADD CONSTRAINT "transit_stations_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "city_events_time_idx" ON "city_events" USING btree ("city_id","starts_at");--> statement-breakpoint
CREATE INDEX "city_events_geom_idx" ON "city_events" USING gist ("geom");--> statement-breakpoint
CREATE UNIQUE INDEX "city_events_source_uq" ON "city_events" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "foot_edges_geom_idx" ON "foot_edges" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "incidents_geom_idx" ON "incidents" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "incidents_time_idx" ON "incidents" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "link_clicks_code_day_idx" ON "link_clicks" USING btree ("code","day");--> statement-breakpoint
CREATE INDEX "neighborhoods_geom_idx" ON "neighborhoods" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "neighborhoods_city_idx" ON "neighborhoods" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "qloo_calls_run_idx" ON "qloo_calls" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "signup_queue_expires_idx" ON "signup_queue" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "survey_responses_survey_idx" ON "survey_responses" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX "transit_stations_geom_idx" ON "transit_stations" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "venues_geom_idx" ON "venues" USING gist ("geom");