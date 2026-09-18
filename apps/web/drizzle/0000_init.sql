CREATE TABLE "scenarios" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"difficulty" integer NOT NULL,
	"json" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scenario_id" text NOT NULL,
	"seed" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"current_node" text NOT NULL,
	"node_started_at" timestamp with time zone NOT NULL,
	"loyalty" integer NOT NULL,
	"safety" integer NOT NULL,
	"outcome" text,
	"score" integer,
	"score_breakdown" jsonb,
	"competency_deltas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"path" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"position" text NOT NULL,
	"depot" text NOT NULL,
	"avatar" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_scenario_idx" ON "sessions" USING btree ("user_id","scenario_id");