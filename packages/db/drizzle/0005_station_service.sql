CREATE TABLE "station_service" (
	"city_id" text NOT NULL,
	"gtfs_stop_id" text NOT NULL,
	"route" text NOT NULL,
	"day_type" text NOT NULL,
	"trips" integer NOT NULL,
	"headway_min" real NOT NULL,
	"last_departure" text NOT NULL,
	CONSTRAINT "station_service_city_id_gtfs_stop_id_route_day_type_pk" PRIMARY KEY("city_id","gtfs_stop_id","route","day_type")
);
--> statement-breakpoint
ALTER TABLE "station_service" ADD CONSTRAINT "station_service_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;