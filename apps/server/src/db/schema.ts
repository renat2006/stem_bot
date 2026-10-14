import type { GameTemplate } from "@stem/shared";
import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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
    trackPosition: integer("track_position").notNull().default(1),
    purchasesToday: integer("purchases_today").notNull().default(0),
    equipped: jsonb("equipped").$type<Record<string, string | null>>().notNull().default({}),
    activePerkId: text("active_perk_id"),
    statModifiers: jsonb("stat_modifiers").$type<Record<string, number>>().notNull().default({}),
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
    fromUserId: telegramId("from_user_id").notNull(),
    fromName: text("from_name").notNull(),
    status: text("status").$type<"open" | "accepted" | "dismissed">().notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [index("proposals_team_idx").on(t.teamId, t.status)],
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
