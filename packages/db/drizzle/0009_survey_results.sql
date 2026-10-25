ALTER TABLE "surveys" DROP CONSTRAINT "surveys_run_id_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "survey_responses" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD COLUMN "sample" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_run_id_unique" UNIQUE("run_id");