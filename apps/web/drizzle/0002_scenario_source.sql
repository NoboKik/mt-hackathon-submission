ALTER TABLE "scenarios" ADD COLUMN "source" text DEFAULT 'curated' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;