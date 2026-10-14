import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "../../db/client.js";
import { cardStock, events, ledger, members, proposals, teams } from "../../db/schema.js";

export type Reader = Db | Tx;

export async function loadEvent(db: Reader, eventId: string) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) throw new Error(`Event ${eventId} not found`);
  return event;
}

export async function loadEventGraph(
  db: Reader,
  eventId: string,
  feedTeamId: string | null,
  feedAll: boolean,
) {
  const [event, teamRows, memberRows, stockRows, proposalRows, feedRows] = await Promise.all([
    loadEvent(db, eventId),
    db.select().from(teams).where(eq(teams.eventId, eventId)).orderBy(teams.createdAt),
    db.select().from(members).where(eq(members.eventId, eventId)).orderBy(members.joinedAt),
    db.select().from(cardStock).where(eq(cardStock.eventId, eventId)),
    db
      .select()
      .from(proposals)
      .where(and(eq(proposals.eventId, eventId), eq(proposals.status, "open")))
      .orderBy(desc(proposals.createdAt)),
    feedAll || feedTeamId
      ? db
          .select()
          .from(ledger)
          .where(
            feedAll
              ? eq(ledger.eventId, eventId)
              : and(eq(ledger.eventId, eventId), inArray(ledger.teamId, [feedTeamId ?? ""])),
          )
          .orderBy(desc(ledger.id))
          .limit(150)
      : Promise.resolve([]),
  ]);
  return { event, teamRows, memberRows, stockRows, proposalRows, feedRows };
}

export async function findMember(db: Reader, eventId: string, userId: number) {
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.eventId, eventId), eq(members.userId, userId)));
  return member ?? null;
}

export async function activeEventId(db: Reader): Promise<string | null> {
  const [event] = await db.select({ id: events.id }).from(events).orderBy(desc(events.createdAt)).limit(1);
  return event?.id ?? null;
}
