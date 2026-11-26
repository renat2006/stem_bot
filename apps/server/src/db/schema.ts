import type { CardItem, GameTemplate, RoundLiveMode, TeamRoundState } from "@stem/shared";
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export interface AdminComposeDraft {
  target: string;
  silent: boolean;
  text?: string;
  updatedAt: string;
}

export interface EventRoundRuntime {
  mode?: RoundLiveMode;
  secretConditionId?: string | null;
  revealedConditionId?: string | null;
  blindEndsAt?: string | null;
  lastRewardBatch?: Array<{ teamId: string; prevCurrency: number }> | null;
  adminCompose?: Record<string, AdminComposeDraft> | null;
}

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const telegramId = (name: string) => bigint(name, { mode: "number" });

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  template: jsonb("template").$type<GameTemplate>().notNull(),
  currentDay: integer("current_day").notNull().default(1),
  currentPhase: text("current_phase")
    .$type<"scoring" | "market" | "turn" | "summary">()
    .notNull()
    .default("scoring"),
  phaseEndsAt: timestamp("phase_ends_at", { withTimezone: true }),
  purchaseLimit: integer("purchase_limit"),
  rulesVersion: integer("rules_version").notNull().default(1),
  rulesNote: text("rules_note").notNull().default(""),
  roundState: jsonb("round_state").$type<EventRoundRuntime>().notNull().default({}),
  version: integer("version").notNull().default(1),
  createdAt: createdAt(),
});

export const teams = pgTable(
  "teams",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    monogram: text("monogram").notNull(),
    joinCode: text("join_code").notNull(),
    currency: integer("currency").notNull().default(0),
    heldCurrency: integer("held_currency").notNull().default(0),
    boardPosition: integer("board_position").notNull().default(1),
    trackPosition: integer("track_position").notNull().default(1),
    purchasesToday: integer("purchases_today").notNull().default(0),
    equipped: jsonb("equipped").$type<Record<string, string | null>>().notNull().default({}),
    inventory: jsonb("inventory").$type<string[]>().notNull().default([]),
    badges: jsonb("badges").$type<string[]>().notNull().default([]),
    activePerkId: text("active_perk_id"),
    statModifiers: jsonb("stat_modifiers").$type<Record<string, number>>().notNull().default({}),
    roundState: jsonb("round_state").$type<Partial<TeamRoundState>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("teams_join_code_uq").on(t.joinCode), index("teams_event_idx").on(t.eventId)],
);

export const members = pgTable(
  "members",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: telegramId("user_id").notNull(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    role: text("role").$type<"captain" | "member">().notNull(),
    displayName: text("display_name").notNull(),
    username: text("username"),
    botBlocked: boolean("bot_blocked").notNull().default(false),
    joinedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] }), index("members_team_idx").on(t.teamId)],
);

export const cardStock = pgTable(
  "card_stock",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    cardId: text("card_id").notNull(),
    left: integer("left").notNull(),
    soldToTeamId: text("sold_to_team_id"),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.cardId] })],
);

export const proposals = pgTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    cardId: text("card_id").notNull(),
    listingId: text("listing_id"),
    fromUserId: telegramId("from_user_id").notNull(),
    fromName: text("from_name").notNull(),
    status: text("status").$type<"open" | "accepted" | "dismissed">().notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [index("proposals_team_idx").on(t.teamId, t.status)],
);

export const marketListings = pgTable(
  "market_listings",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sellerTeamId: text("seller_team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    cardId: text("card_id").notNull(),
    price: integer("price").notNull(),
    status: text("status").$type<"open" | "sold" | "cancelled">().notNull().default("open"),
    buyerTeamId: text("buyer_team_id"),
    createdAt: createdAt(),
  },
  (t) => [index("listings_event_idx").on(t.eventId, t.status)],
);

export const auctions = pgTable(
  "auctions",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    cardId: text("card_id").notNull(),
    startingPrice: integer("starting_price").notNull(),
    currentBid: integer("current_bid").notNull().default(0),
    leaderTeamId: text("leader_team_id"),
    bidCount: integer("bid_count").notNull().default(0),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").$type<"open" | "settled" | "cancelled">().notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [index("auctions_event_idx").on(t.eventId, t.status)],
);

export const marketDrafts = pgTable(
  "market_drafts",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    theme: text("theme").notNull(),
    cards: jsonb("cards").$type<CardItem[]>().notNull(),
    balance: jsonb("balance").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
    createdBy: telegramId("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("market_drafts_event_idx").on(t.eventId, t.status)],
);

export const ledger = pgTable(
  "ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    teamId: text("team_id"),
    kind: text("kind").notNull(),
    amount: integer("amount"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    actorUserId: telegramId("actor_user_id"),
    createdAt: createdAt(),
  },
  (t) => [index("ledger_event_idx").on(t.eventId, t.id), index("ledger_team_idx").on(t.teamId, t.id)],
);

export const commands = pgTable(
  "commands",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    userId: telegramId("user_id"),
    result: jsonb("result").$type<unknown>(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.key] })],
);

export type EventRow = typeof events.$inferSelect;
export type TeamRow = typeof teams.$inferSelect;
export type MemberRow = typeof members.$inferSelect;
export type ListingRow = typeof marketListings.$inferSelect;
export type AuctionRow = typeof auctions.$inferSelect;
export type MarketDraftRow = typeof marketDrafts.$inferSelect;
