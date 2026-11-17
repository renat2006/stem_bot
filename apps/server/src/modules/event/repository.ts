import { and, desc, eq, inArray, lte } from "drizzle-orm";
import type { Db, Tx } from "../../db/client.js";
import {
  auctions,
  cardStock,
  events,
  ledger,
  marketListings,
  members,
  proposals,
  teams,
} from "../../db/schema.js";

export type Reader = Db | Tx;

export async function loadEvent(db: Reader, eventId: string) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) throw new Error(`Event ${eventId} not found`);
  return event;
}

export async function settleExpiredAuctions(db: Db, eventId: string, now = new Date()): Promise<boolean> {
  const expired = await db
    .select({ id: auctions.id })
    .from(auctions)
    .where(and(eq(auctions.eventId, eventId), eq(auctions.status, "open"), lte(auctions.endsAt, now)));

  if (expired.length === 0) return false;

  return db.transaction(async (tx) => {
    const [event] = await tx.select().from(events).where(eq(events.id, eventId)).for("update");
    if (!event) return false;
    const due = await tx
      .select()
      .from(auctions)
      .where(and(eq(auctions.eventId, eventId), eq(auctions.status, "open"), lte(auctions.endsAt, now)));
    if (due.length === 0) return false;

    let version = event.version;
    for (const lot of due) {
      version += 1;
      await tx.update(auctions).set({ status: "settled" }).where(eq(auctions.id, lot.id));
      if (lot.leaderTeamId) {
        const [winner] = await tx.select().from(teams).where(eq(teams.id, lot.leaderTeamId));
        if (winner) {
          const card = event.template.cards.find((c) => c.id === lot.cardId);
          const slotEmpty = card ? !winner.equipped[card.slotId] : false;
          const nextEquipped =
            card && slotEmpty ? { ...winner.equipped, [card.slotId]: card.id } : winner.equipped;
          const nextInventory = card && slotEmpty ? winner.inventory : [...winner.inventory, lot.cardId];
          const nextBadges = winner.badges.includes("Победитель торгов")
            ? winner.badges
            : [...winner.badges, "Победитель торгов"];
          await tx
            .update(teams)
            .set({
              heldCurrency: Math.max(0, winner.heldCurrency - lot.currentBid),
              equipped: nextEquipped,
              inventory: nextInventory,
              badges: nextBadges,
            })
            .where(eq(teams.id, winner.id));
          await tx.insert(ledger).values({
            eventId,
            version,
            teamId: winner.id,
            kind: "auction-won",
            amount: -lot.currentBid,
            data: { cardId: lot.cardId, bid: lot.currentBid },
          });
        }
      }
    }
    await tx.update(events).set({ version }).where(eq(events.id, eventId));
    return true;
  });
}

export async function loadEventGraph(
  db: Reader,
  eventId: string,
  feedTeamId: string | null,
  feedAll: boolean,
) {
  const [event, teamRows, memberRows, stockRows, proposalRows, listingRows, auctionRows, feedRows] =
    await Promise.all([
      loadEvent(db, eventId),
      db.select().from(teams).where(eq(teams.eventId, eventId)).orderBy(teams.createdAt),
      db.select().from(members).where(eq(members.eventId, eventId)).orderBy(members.joinedAt),
      db.select().from(cardStock).where(eq(cardStock.eventId, eventId)),
      db
        .select()
        .from(proposals)
        .where(and(eq(proposals.eventId, eventId), eq(proposals.status, "open")))
        .orderBy(desc(proposals.createdAt)),
      db
        .select()
        .from(marketListings)
        .where(and(eq(marketListings.eventId, eventId), eq(marketListings.status, "open")))
        .orderBy(desc(marketListings.createdAt)),
      db
        .select()
        .from(auctions)
        .where(eq(auctions.eventId, eventId))
        .orderBy(desc(auctions.createdAt))
        .limit(12),
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
  return {
    event,
    teamRows,
    memberRows,
    stockRows,
    proposalRows,
    listingRows,
    auctionRows,
    feedRows,
  };
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
