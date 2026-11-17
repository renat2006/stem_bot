CREATE TABLE "auctions" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"card_id" text NOT NULL,
	"starting_price" integer NOT NULL,
	"current_bid" integer DEFAULT 0 NOT NULL,
	"leader_team_id" text,
	"bid_count" integer DEFAULT 0 NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"theme" text NOT NULL,
	"cards" jsonb NOT NULL,
	"balance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_listings" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"seller_team_id" text NOT NULL,
	"card_id" text NOT NULL,
	"price" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"buyer_team_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "bot_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "listing_id" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "held_currency" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "inventory" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "badges" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_drafts" ADD CONSTRAINT "market_drafts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_seller_team_id_teams_id_fk" FOREIGN KEY ("seller_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auctions_event_idx" ON "auctions" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "market_drafts_event_idx" ON "market_drafts" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "listings_event_idx" ON "market_listings" USING btree ("event_id","status");