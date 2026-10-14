import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { cardStock, ledger, members, proposals, teams } from "../../db/schema.js";
import { DomainError } from "../../shared/errors.js";
import { requireCaptain, requireMember } from "../event/access.js";
import { type MutationContext, type MutationOptions, mutateEvent } from "../event/mutation.js";
import { isMarketOpen } from "../event/snapshot.js";

const UNDO_WINDOW_MS = 2 * 60_000;

function requireOpenMarket(ctx: MutationContext) {
  if (!isMarketOpen(ctx.event)) throw new DomainError("Рынок сейчас закрыт");
}

export function joinTeam(options: MutationOptions, input: { code: string; displayName: string }) {
  return mutateEvent(options, async (ctx) => {
    const code = input.code.trim().toUpperCase();
    const [team] = await ctx.tx
      .select()
      .from(teams)
      .where(and(eq(teams.eventId, ctx.event.id), eq(teams.joinCode, code)));
    if (!team) throw new DomainError("Команда с таким кодом не найдена", 404);

    const [existing] = await ctx.tx
      .select()
      .from(members)
      .where(and(eq(members.eventId, ctx.event.id), eq(members.userId, ctx.actor.userId)));
    if (existing) {
      if (existing.teamId === team.id) return { teamId: team.id, role: existing.role };
      throw new DomainError("Вы уже в другой команде. Попросите ведущего перевести вас", 409);
    }

    const [captain] = await ctx.tx
      .select({ userId: members.userId })
      .from(members)
      .where(and(eq(members.teamId, team.id), eq(members.role, "captain")));
    const role = captain ? "member" : "captain";
    const displayName = input.displayName.trim() || ctx.actor.displayName;
    await ctx.tx.insert(members).values({
      eventId: ctx.event.id,
      userId: ctx.actor.userId,
      teamId: team.id,
      role,
      displayName,
      username: ctx.actor.username,
    });
    ctx.log({ teamId: team.id, kind: "join", data: { displayName, role } });
    return { teamId: team.id, role };
  });
}

async function purchase(ctx: MutationContext, teamId: string, cardId: string) {
  requireOpenMarket(ctx);
  const template = ctx.event.template;
  const [team] = await ctx.tx.select().from(teams).where(eq(teams.id, teamId));
  if (!team) throw new DomainError("Команда не найдена", 404);
  const card = template.cards.find((c) => c.id === cardId);
  if (!card) throw new DomainError("Карта не найдена", 404);
  if (card.dayAvailable > ctx.event.currentDay)
    throw new DomainError(`Карта откроется в День ${card.dayAvailable}`);
  if (team.equipped[card.slotId] === card.id) throw new DomainError("Эта карта уже в сборке");
  const limit = ctx.event.purchaseLimit;
  if (limit !== null && team.purchasesToday >= limit)
    throw new DomainError(`Лимит покупок исчерпан (${limit})`);

  const [stock] = await ctx.tx
    .select()
    .from(cardStock)
    .where(and(eq(cardStock.eventId, ctx.event.id), eq(cardStock.cardId, card.id)));
  if (!stock || stock.left <= 0) throw new DomainError("Карту уже раскупили", 409);
  if (team.currency < card.price) throw new DomainError(`Недостаточно валюты (${template.currencyName})`);

  const prevCardId = team.equipped[card.slotId] ?? null;
  await ctx.tx
    .update(teams)
    .set({
      currency: team.currency - card.price,
      purchasesToday: team.purchasesToday + 1,
      equipped: { ...team.equipped, [card.slotId]: card.id },
    })
    .where(eq(teams.id, team.id));
  await ctx.tx
    .update(cardStock)
    .set({ left: stock.left - 1, soldToTeamId: stock.left - 1 === 0 ? team.id : stock.soldToTeamId })
    .where(and(eq(cardStock.eventId, ctx.event.id), eq(cardStock.cardId, card.id)));
  await ctx.tx
    .update(proposals)
    .set({ status: "accepted" })
    .where(and(eq(proposals.teamId, team.id), eq(proposals.cardId, card.id), eq(proposals.status, "open")));
  ctx.log({
    teamId: team.id,
    kind: "purchase",
    amount: -card.price,
    data: { cardId: card.id, prevCardId, prevSoldTo: stock.soldToTeamId },
  });
  return { cardId: card.id };
}

export function buyCard(options: MutationOptions, cardId: string) {
  return mutateEvent(options, async (ctx) => {
    const { team } = await requireCaptain(ctx.tx, ctx.event.id, ctx.actor);
    return purchase(ctx, team.id, cardId);
  });
}

export function undoLastPurchase(options: MutationOptions) {
  return mutateEvent(options, async (ctx) => {
    const { team } = await requireCaptain(ctx.tx, ctx.event.id, ctx.actor);
    requireOpenMarket(ctx);
    const [last] = await ctx.tx
      .select()
      .from(ledger)
      .where(and(eq(ledger.teamId, team.id), inArray(ledger.kind, ["purchase", "undo"])))
      .orderBy(desc(ledger.id))
      .limit(1);
    if (last?.kind !== "purchase") throw new DomainError("Нет покупки для отмены");
    if (Date.now() - last.createdAt.getTime() > UNDO_WINDOW_MS) {
      throw new DomainError("Отменить покупку можно в течение 2 минут");
    }
    const cardId = String(last.data.cardId);
    const card = ctx.event.template.cards.find((c) => c.id === cardId);
    if (!card) throw new DomainError("Карта не найдена", 404);
    const price = -(last.amount ?? 0);
    const prevCardId = (last.data.prevCardId as string | null) ?? null;

    await ctx.tx
      .update(teams)
      .set({
        currency: team.currency + price,
        purchasesToday: Math.max(0, team.purchasesToday - 1),
        equipped: { ...team.equipped, [card.slotId]: prevCardId },
      })
      .where(eq(teams.id, team.id));
    const [stock] = await ctx.tx
      .select()
      .from(cardStock)
      .where(and(eq(cardStock.eventId, ctx.event.id), eq(cardStock.cardId, cardId)));
    if (stock) {
      await ctx.tx
        .update(cardStock)
        .set({ left: stock.left + 1, soldToTeamId: (last.data.prevSoldTo as string | null) ?? null })
        .where(and(eq(cardStock.eventId, ctx.event.id), eq(cardStock.cardId, cardId)));
    }
    ctx.log({ teamId: team.id, kind: "undo", amount: price, data: { cardId, purchaseId: last.id } });
    return { cardId };
  });
}

export function proposeCard(options: MutationOptions, cardId: string) {
  return mutateEvent(options, async (ctx) => {
    const { team, member } = await requireMember(ctx.tx, ctx.event.id, ctx.actor);
    const card = ctx.event.template.cards.find((c) => c.id === cardId);
    if (!card) throw new DomainError("Карта не найдена", 404);
    const [open] = await ctx.tx
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.teamId, team.id), eq(proposals.cardId, cardId), eq(proposals.status, "open")));
    if (open) return { proposalId: open.id };
    const id = `prop-${randomUUID()}`;
    await ctx.tx.insert(proposals).values({
      id,
      eventId: ctx.event.id,
      teamId: team.id,
      cardId,
      fromUserId: ctx.actor.userId,
      fromName: member.displayName,
    });
    ctx.log({ teamId: team.id, kind: "proposal", data: { cardId, fromName: member.displayName } });
    return { proposalId: id };
  });
}

export function resolveProposal(options: MutationOptions, proposalId: string, accept: boolean) {
  return mutateEvent(options, async (ctx) => {
    const { team } = await requireCaptain(ctx.tx, ctx.event.id, ctx.actor);
    const [proposal] = await ctx.tx
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, proposalId), eq(proposals.teamId, team.id)));
    if (proposal?.status !== "open") throw new DomainError("Предложение уже обработано", 409);
    if (accept) return purchase(ctx, team.id, proposal.cardId);
    await ctx.tx.update(proposals).set({ status: "dismissed" }).where(eq(proposals.id, proposalId));
    return { cardId: proposal.cardId };
  });
}

export function buyPerk(options: MutationOptions, perkId: string) {
  return mutateEvent(options, async (ctx) => {
    const { team } = await requireCaptain(ctx.tx, ctx.event.id, ctx.actor);
    requireOpenMarket(ctx);
    const perk = ctx.event.template.perks.find((p) => p.id === perkId);
    if (!perk) throw new DomainError("Свойство не найдено", 404);
    if (perk.dayAvailable > ctx.event.currentDay)
      throw new DomainError(`Свойство откроется в День ${perk.dayAvailable}`);
    if (team.activePerkId === perk.id) throw new DomainError("Это свойство уже активно");
    if (team.currency < perk.price)
      throw new DomainError(`Недостаточно валюты (${ctx.event.template.currencyName})`);
    await ctx.tx
      .update(teams)
      .set({ currency: team.currency - perk.price, activePerkId: perk.id })
      .where(eq(teams.id, team.id));
    ctx.log({ teamId: team.id, kind: "perk", amount: -perk.price, data: { perkId, perkName: perk.name } });
    return { perkId };
  });
}
