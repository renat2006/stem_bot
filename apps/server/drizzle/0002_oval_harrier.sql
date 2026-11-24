ALTER TABLE "events" ADD COLUMN "round_state" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "round_state" jsonb DEFAULT '{}'::jsonb NOT NULL;