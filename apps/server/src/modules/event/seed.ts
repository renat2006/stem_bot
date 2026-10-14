import { randomInt, randomUUID } from "node:crypto";
import { type GameTemplate, NEUROFAUNA_TEMPLATE } from "@stem/shared";
import { eq } from "drizzle-orm";
import type { Db, Tx } from "../../db/client.js";
import { cardStock, events, teams } from "../../db/schema.js";
import { activeEventId } from "./repository.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEMO_TEAMS = ["Химера-01", "Тайга-04", "Альфа-07", "Кракен-02"];

export function generateJoinCode() {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

export function monogramFor(name: string, index: number) {
  const letter = name.trim().charAt(0).toUpperCase() || "К";
  return `${letter}${index + 1}`;
}

export function newTeamValues(eventId: string, name: string, index: number, template: GameTemplate) {
  return {
    id: `team-${randomUUID()}`,
    eventId,
    name,
    monogram: monogramFor(name, index),
    joinCode: generateJoinCode(),
    equipped: Object.fromEntries(template.slots.map((s) => [s.id, null])),
  };
}

export async function resetEventContent(tx: Tx, eventId: string, template: GameTemplate, demoTeams: boolean) {
  await tx.delete(teams).where(eq(teams.eventId, eventId));
  await tx.delete(cardStock).where(eq(cardStock.eventId, eventId));
  if (template.cards.length > 0) {
    await tx
      .insert(cardStock)
      .values(template.cards.map((card) => ({ eventId, cardId: card.id, left: card.stock })));
  }
  if (demoTeams) {
    await tx
      .insert(teams)
      .values(DEMO_TEAMS.map((name, index) => newTeamValues(eventId, name, index, template)));
  }
}

export async function ensureActiveEvent(db: Db, demoTeams: boolean): Promise<string> {
  const existing = await activeEventId(db);
  if (existing) return existing;
  const template = NEUROFAUNA_TEMPLATE;
  const eventId = `evt-${randomUUID()}`;
  await db.transaction(async (tx) => {
    await tx.insert(events).values({
      id: eventId,
      title: template.title,
      template,
      purchaseLimit: template.dailyPurchaseLimit,
      rulesNote: `Версия 1 · Старт смены «${template.title}»`,
    });
    await resetEventContent(tx, eventId, template, demoTeams);
  });
  return eventId;
}
