CREATE TABLE "outreach" (
	"workspace_id" uuid NOT NULL,
	"entity_id" text NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_workspace_id_entity_id_pk" PRIMARY KEY("workspace_id","entity_id")
);
--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;