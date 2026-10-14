CREATE TABLE "card_stock" (
	"event_id" text NOT NULL,
	"card_id" text NOT NULL,
	"left" integer NOT NULL,
	"sold_to_team_id" text,
	CONSTRAINT "card_stock_event_id_card_id_pk" PRIMARY KEY("event_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "commands" (
	"event_id" text NOT NULL,
	"key" text NOT NULL,
	"user_id" bigint,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commands_event_id_key_pk" PRIMARY KEY("event_id","key")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"template" jsonb NOT NULL,
	"current_day" integer DEFAULT 1 NOT NULL,
	"current_phase" text DEFAULT 'scoring' NOT NULL,
	"phase_ends_at" timestamp with time zone,
	"purchase_limit" integer,
	"rules_version" integer DEFAULT 1 NOT NULL,
	"rules_note" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"version" integer NOT NULL,
	"team_id" text,
	"kind" text NOT NULL,
	"amount" integer,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"event_id" text NOT NULL,
	"user_id" bigint NOT NULL,
	"team_id" text NOT NULL,
	"role" text NOT NULL,
	"display_name" text NOT NULL,
	"username" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"team_id" text NOT NULL,
	"card_id" text NOT NULL,
	"from_user_id" bigint NOT NULL,
	"from_name" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"monogram" text NOT NULL,
	"join_code" text NOT NULL,
	"currency" integer DEFAULT 0 NOT NULL,
	"track_position" integer DEFAULT 1 NOT NULL,
	"purchases_today" integer DEFAULT 0 NOT NULL,
	"equipped" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active_perk_id" text,
	"stat_modifiers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_stock" ADD CONSTRAINT "card_stock_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_event_idx" ON "ledger" USING btree ("event_id","id");--> statement-breakpoint
CREATE INDEX "ledger_team_idx" ON "ledger" USING btree ("team_id","id");--> statement-breakpoint
CREATE INDEX "members_team_idx" ON "members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "proposals_team_idx" ON "proposals" USING btree ("team_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_join_code_uq" ON "teams" USING btree ("join_code");--> statement-breakpoint
CREATE INDEX "teams_event_idx" ON "teams" USING btree ("event_id");