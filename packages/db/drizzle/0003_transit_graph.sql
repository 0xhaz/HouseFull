CREATE TABLE "transit_edges" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"city_id" text NOT NULL,
	"source" integer NOT NULL,
	"target" integer NOT NULL,
	"minutes" real NOT NULL,
	"kind" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transit_stations" ADD COLUMN "node_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "transit_edges" ADD CONSTRAINT "transit_edges_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transit_edges_city_idx" ON "transit_edges" USING btree ("city_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transit_stations_node_uq" ON "transit_stations" USING btree ("city_id","node_id");