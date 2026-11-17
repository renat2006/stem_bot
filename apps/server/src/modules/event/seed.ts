import { randomInt, randomUUID } from "node:crypto";
import { type GameTemplate, ROVER_SPRINT_TEMPLATE } from "@stem/shared";
import { eq } from "drizzle-orm";
import type { Db, Tx } from "../../db/client.js";
import { auctions, cardStock, events, marketListings, teams } from "../../db/schema.js";
import { activeEventId } from "./repository.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEMO_TEAMS_BY_KEY: Record<string, string[]> = {
  rovers: ["Марс-01", "Кратер-04", "Титан-07", "Вектор-02"],
  neurofauna: ["Химера-01", "Тайга-04", "Альфа-07", "Кракен-02"],
  startup: ["КвантЛаб", "НейроПэй", "СинтезИИ", "ПульсТех"],
  airship: ["Зефир-01", "Стратос-03", "Борей-05", "Орион-08"],
};

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
    inventory: [] as string[],
    badges: [] as string[],
  };
}

export async function resetEventContent(
  tx: Tx,
  eventId: string,
  template: GameTemplate,
  demoTeams: boolean | number,
) {
  await tx.delete(auctions).where(eq(auctions.eventId, eventId));
  await tx.delete(marketListings).where(eq(marketListings.eventId, eventId));
  await tx.delete(teams).where(eq(teams.eventId, eventId));
  await tx.delete(cardStock).where(eq(cardStock.eventId, eventId));
  if (template.cards.length > 0) {
    await tx
      .insert(cardStock)
      .values(template.cards.map((card) => ({ eventId, cardId: card.id, left: card.stock })));
  }
  const count = typeof demoTeams === "number" ? demoTeams : demoTeams ? 4 : 0;
  if (count > 0) {
    const baseNames = DEMO_TEAMS_BY_KEY[template.eventKey] ?? DEMO_TEAMS_BY_KEY.rovers ?? [];
    const names = Array.from(
      { length: count },
      (_, idx) => baseNames[idx] ?? `Команда-${String(idx + 1).padStart(2, "0")}`,
    );
    await tx.insert(teams).values(names.map((name, index) => newTeamValues(eventId, name, index, template)));
  }
}

export async function ensureActiveEvent(db: Db, demoTeams: boolean): Promise<string> {
  const existing = await activeEventId(db);
  if (existing) return existing;
  const template = ROVER_SPRINT_TEMPLATE;
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
