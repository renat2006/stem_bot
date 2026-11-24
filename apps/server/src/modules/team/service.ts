import { randomUUID } from "node:crypto";
import {
  assignMemberLevers,
  computeUnlockedActionTags,
  evaluateAuctionBid,
  evaluateDiagnosisVerdict,
  evaluateProbeObservation,
  resolveDiagnosisDay,
  resolveMissionDay,
  TeamRoundStateSchema,
  validateP2PPrice,
} from "@stem/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auctions, cardStock, ledger, marketListings, members, proposals, teams } from "../../db/schema.js";
import { config } from "../../shared/config.js";
import { DomainError } from "../../shared/errors.js";
import { requireCaptain, requireMember } from "../event/access.js";
import { type MutationContext, type MutationOptions, mutateEvent } from "../event/mutation.js";
import { isMarketOpen, normalizeTemplate as parseTemplate } from "../event/snapshot.js";

const UNDO_WINDOW_MS = 2 * 60_000;

function requireOpenMarket(ctx: MutationContext) {
  if (!isMarketOpen(ctx.event)) throw new DomainError("Рынок сейчас закрыт");
}

function removeOnce(list: string[], item: string): { next: string[]; removed: boolean } {
  const idx = list.indexOf(item);
  if (idx === -1) return { next: list, removed: false };
  return { next: [...list.slice(0, idx), ...list.slice(idx + 1)], removed: true };
}

function withBadge(badges: string[], badge: string): string[] {
  return badges.includes(badge) ? badges : [...badges, badge];
}

export function joinTeam(
  options: MutationOptions,
  input: { code?: string; teamId?: string; displayName: string },
) {
  return mutateEvent(options, async (ctx) => {
    let team: typeof teams.$inferSelect | undefined;
    if (input.teamId && !input.code) {
      if (config.isProduction) {
        throw new DomainError("Вход возможен только по коду команды", 403);
      }
      [team] = await ctx.tx
        .select()
        .from(teams)
        .where(and(eq(teams.eventId, ctx.event.id), eq(teams.id, input.teamId)));
    } else {
      const code = (input.code ?? "").trim().toUpperCase();
      [team] = await ctx.tx
        .select()
        .from(teams)
        .where(and(eq(teams.eventId, ctx.event.id), eq(teams.joinCode, code)));
    }
    if (!team) throw new DomainError("Команда с таким кодом не найдена", 404);

    const [existing] = await ctx.tx
      .select()
      .from(members)
      .where(and(eq(members.eventId, ctx.event.id), eq(members.userId, ctx.actor.userId)));
    if (existing) {
      if (existing.teamId === team.id) return { teamId: team.id, role: existing.role };
      throw new DomainError("Вы уже состоите в другой команде. Обратитесь к ведущему смены", 409);
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
  const template = parseTemplate(ctx.event.template);
  const [team] = await ctx.tx.select().from(teams).where(eq(teams.id, teamId));
  if (!team) throw new DomainError("Команда не найдена", 404);
  const card = template.cards.find((c) => c.id === cardId);
  if (!card) throw new DomainError("Деталь не найдена", 404);
  if (card.dayAvailable > ctx.event.currentDay)
    throw new DomainError(`Деталь откроется в День ${card.dayAvailable}`);
  if (team.equipped[card.slotId] === card.id) throw new DomainError("Эта деталь уже установлена");
  const limit = ctx.event.purchaseLimit;
  if (limit !== null && team.purchasesToday >= limit)
    throw new DomainError(`Лимит покупок на сегодня исчерпан (${limit})`);

  const [stock] = await ctx.tx
    .select()
    .from(cardStock)
    .where(and(eq(cardStock.eventId, ctx.event.id), eq(cardStock.cardId, card.id)));
  if (!stock || stock.left <= 0) throw new DomainError("Эту деталь уже разобрали", 409);
  if (team.currency < card.price)
    throw new DomainError(`Не хватает ${card.price - team.currency} ${template.currencyName}`);

  const prevCardId = team.equipped[card.slotId] ?? null;
  const keepInInventory = template.features.slotInventory && prevCardId !== null;
  const nextEquipped = { ...team.equipped, [card.slotId]: card.id };
  const nextInventory = keepInInventory ? [...team.inventory, prevCardId] : team.inventory;
  const allSlotsFilled = template.slots.every((s) => Boolean(nextEquipped[s.id]));
  const nextBadges = allSlotsFilled ? withBadge(team.badges, "Полная сборка") : team.badges;

  await ctx.tx
    .update(teams)
    .set({
      currency: team.currency - card.price,
      purchasesToday: team.purchasesToday + 1,
      equipped: nextEquipped,
      inventory: nextInventory,
      badges: nextBadges,
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
    data: { cardId: card.id, prevCardId, storedPrev: keepInInventory, prevSoldTo: stock.soldToTeamId },
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
    const template = parseTemplate(ctx.event.template);
    if (!template.features.undoPurchase) {
      throw new DomainError("Отмена покупок отключена в правилах этой смены", 403);
    }
    const { team } = await requireCaptain(ctx.tx, ctx.event.id, ctx.actor);
    requireOpenMarket(ctx);
    const [last] = await ctx.tx
      .select()
      .from(ledger)
      .where(and(eq(ledger.teamId, team.id), inArray(ledger.kind, ["purchase", "undo"])))
      .orderBy(desc(ledger.id))
      .limit(1);
    if (last?.kind !== "purchase") throw new DomainError("Нет свежей покупки для отмены");
    if (Date.now() - last.createdAt.getTime() > UNDO_WINDOW_MS) {
      throw new DomainError("Отменить покупку можно только в первые 2 минуты");
    }
    const cardId = String(last.data.cardId);
    const card = template.cards.find((c) => c.id === cardId);
    if (!card) throw new DomainError("Деталь не найдена", 404);
    if (team.equipped[card.slotId] !== cardId) {
      throw new DomainError("Слот уже был изменён после покупки — отмена недоступна", 409);
    }

    const price = -(last.amount ?? 0);
    const prevCardId = (last.data.prevCardId as string | null) ?? null;
    const storedPrev = Boolean(last.data.storedPrev);
    let nextInventory = team.inventory;
    if (storedPrev && prevCardId) {
      const removed = removeOnce(team.inventory, prevCardId);
      if (!removed.removed) {
        throw new DomainError("Снятая деталь уже выставлена на биржу — отмена недоступна", 409);
      }
      nextInventory = removed.next;
    }

    await ctx.tx
      .update(teams)
      .set({
        currency: team.currency + price,
        purchasesToday: Math.max(0, team.purchasesToday - 1),
        equipped: { ...team.equipped, [card.slotId]: prevCardId },
        inventory: nextInventory,
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

export function equipFromInventory(
  options: MutationOptions,
  input: { slotId: string; cardId: string | null },
) {
  return mutateEvent(options, async (ctx) => {
    const template = parseTemplate(ctx.event.template);
    if (!template.features.slotInventory) {
      throw new DomainError("Склад деталей отключён на этой смене", 403);
    }
    if (ctx.event.currentPhase === "turn") {
      throw new DomainError("Во время выезда на трассу менять узлы нельзя");
    }
    const { team } = await requireCaptain(ctx.tx, ctx.event.id, ctx.actor);
    const slotExists = template.slots.some((s) => s.id === input.slotId);
    if (!slotExists) throw new DomainError("Категория узла не найдена", 404);

    const currentInSlot = team.equipped[input.slotId] ?? null;
    if (input.cardId === null) {
      if (!currentInSlot) return { slotId: input.slotId, cardId: null };
      await ctx.tx
        .update(teams)
        .set({
          equipped: { ...team.equipped, [input.slotId]: null },
          inventory: [...team.inventory, currentInSlot],
        })
        .where(eq(teams.id, team.id));
      ctx.log({ teamId: team.id, kind: "equip-swap", data: { slotId: input.slotId, cardId: null } });
      return { slotId: input.slotId, cardId: null };
    }

    const card = template.cards.find((c) => c.id === input.cardId);
    if (!card || card.slotId !== input.slotId) {
      throw new DomainError("Эта деталь не подходит к выбранному узлу", 400);
    }
    const extracted = removeOnce(team.inventory, card.id);
    if (!extracted.removed) {
      throw new DomainError("Этой детали нет на складе команды", 404);
    }
    const nextInventory = currentInSlot ? [...extracted.next, currentInSlot] : extracted.next;
    await ctx.tx
      .update(teams)
      .set({
        equipped: { ...team.equipped, [input.slotId]: card.id },
        inventory: nextInventory,
      })
      .where(eq(teams.id, team.id));
    ctx.log({ teamId: team.id, kind: "equip-swap", data: { slotId: input.slotId, cardId: card.id } });
    return { slotId: input.slotId, cardId: card.id };
  });
}

export function createP2PListing(
  options: MutationOptions,
  input: { cardId: string; price: number; fromEquippedSlot?: string },
) {
  return mutateEvent(options, async (ctx) => {
    const template = parseTemplate(ctx.event.template);
    if (!template.features.p2pMarket) {
      throw new DomainError("Биржа между командами сейчас отключена", 403);
    }
    const { team } = await requireCaptain(ctx.tx, ctx.event.id, ctx.actor);
    const card = template.cards.find((c) => c.id === input.cardId);
    if (!card) throw new DomainError("Деталь не найдена", 404);

    const priceCheck = validateP2PPrice(card, input.price, template.features, template.currencyName);
    if (!priceCheck.ok) throw new DomainError(priceCheck.reason ?? "Недопустимая цена лота", 400);

    const activeFromSeller = await ctx.tx
      .select({ id: marketListings.id })
      .from(marketListings)
      .where(
        and(
          eq(marketListings.eventId, ctx.event.id),
          eq(marketListings.sellerTeamId, team.id),
          eq(marketListings.status, "open"),
        ),
      );
    if (activeFromSeller.length >= 4) {
      throw new DomainError("Одновременно можно держать не более 4 открытых лотов на бирже");
    }

    let nextInventory = team.inventory;
    let nextEquipped = team.equipped;

    const fromInv = removeOnce(team.inventory, card.id);
    if (fromInv.removed) {
      nextInventory = fromInv.next;
    } else if (input.fromEquippedSlot && team.equipped[input.fromEquippedSlot] === card.id) {
      nextEquipped = { ...team.equipped, [input.fromEquippedSlot]: null };
    } else if (team.equipped[card.slotId] === card.id) {
      nextEquipped = { ...team.equipped, [card.slotId]: null };
    } else {
      throw new DomainError("У команды нет свободной копии этой детали для продажи", 404);
    }

    const listingId = `lot-${randomUUID()}`;
    await ctx.tx
      .update(teams)
      .set({ equipped: nextEquipped, inventory: nextInventory })
      .where(eq(teams.id, team.id));
    await ctx.tx.insert(marketListings).values({
      id: listingId,
      eventId: ctx.event.id,
      sellerTeamId: team.id,
      cardId: card.id,
      price: input.price,
      status: "open",
    });
    ctx.log({ teamId: team.id, kind: "p2p-list", data: { listingId, cardId: card.id, price: input.price } });
    return { listingId };
  });
}

export function cancelP2PListing(options: MutationOptions, listingId: string) {
  return mutateEvent(options, async (ctx) => {
    const { team } = await requireCaptain(ctx.tx, ctx.event.id, ctx.actor);
    const [listing] = await ctx.tx
      .select()
      .from(marketListings)
      .where(and(eq(marketListings.id, listingId), eq(marketListings.eventId, ctx.event.id)));
    if (listing?.status !== "open") throw new DomainError("Лот уже закрыт", 409);
    if (listing.sellerTeamId !== team.id) throw new DomainError("Можно снять только лот своей команды", 403);

    await ctx.tx.update(marketListings).set({ status: "cancelled" }).where(eq(marketListings.id, listing.id));
    await ctx.tx
      .update(teams)
      .set({ inventory: [...team.inventory, listing.cardId] })
      .where(eq(teams.id, team.id));
    ctx.log({ teamId: team.id, kind: "p2p-cancel", data: { listingId, cardId: listing.cardId } });
    return { listingId };
  });
}

async function executeBuyP2P(ctx: MutationContext, buyerTeamId: string, listingId: string) {
  requireOpenMarket(ctx);
  const template = parseTemplate(ctx.event.template);
  if (!template.features.p2pMarket) {
    throw new DomainError("Биржа между командами сейчас отключена", 403);
  }
  const [listing] = await ctx.tx
    .select()
    .from(marketListings)
    .where(and(eq(marketListings.id, listingId), eq(marketListings.eventId, ctx.event.id)));
  if (listing?.status !== "open") {
    throw new DomainError("Лот уже купили или сняли с продажи", 409);
  }
  if (listing.sellerTeamId === buyerTeamId) {
    throw new DomainError("Нельзя выкупить собственный лот", 400);
  }

  const [buyer] = await ctx.tx.select().from(teams).where(eq(teams.id, buyerTeamId));
  const [seller] = await ctx.tx.select().from(teams).where(eq(teams.id, listing.sellerTeamId));
  if (!buyer || !seller) throw new DomainError("Команда не найдена", 404);

  if (
    template.features.p2pCountsTowardLimit &&
    ctx.event.purchaseLimit !== null &&
    buyer.purchasesToday >= ctx.event.purchaseLimit
  ) {
    throw new DomainError(`Лимит покупок исчерпан (${ctx.event.purchaseLimit})`);
  }
  if (buyer.currency < listing.price) {
    throw new DomainError(`Не хватает ${listing.price - buyer.currency} ${template.currencyName}`);
  }

  const card = template.cards.find((c) => c.id === listing.cardId);
  if (!card) throw new DomainError("Деталь не найдена", 404);
  const priceCheck = validateP2PPrice(card, listing.price, template.features, template.currencyName);
  const sellerGain =
    priceCheck.sellerReceives ||
    Math.max(1, listing.price - Math.floor((listing.price * template.features.p2pFeePercent) / 100));

  const prevInSlot = buyer.equipped[card.slotId] ?? null;
  const shouldEquipNow = prevInSlot !== card.id;
  const nextBuyerEquipped = shouldEquipNow ? { ...buyer.equipped, [card.slotId]: card.id } : buyer.equipped;
  const nextBuyerInventory = !shouldEquipNow
    ? [...buyer.inventory, card.id]
    : prevInSlot && template.features.slotInventory
      ? [...buyer.inventory, prevInSlot]
      : buyer.inventory;

  await ctx.tx
    .update(marketListings)
    .set({ status: "sold", buyerTeamId: buyer.id })
    .where(eq(marketListings.id, listing.id));
  await ctx.tx
    .update(teams)
    .set({
      currency: buyer.currency - listing.price,
      purchasesToday: template.features.p2pCountsTowardLimit
        ? buyer.purchasesToday + 1
        : buyer.purchasesToday,
      equipped: nextBuyerEquipped,
      inventory: nextBuyerInventory,
      badges: withBadge(buyer.badges, "Инженерный трейд"),
    })
    .where(eq(teams.id, buyer.id));
  await ctx.tx
    .update(teams)
    .set({
      currency: seller.currency + sellerGain,
      badges: withBadge(seller.badges, "Инженерный трейд"),
    })
    .where(eq(teams.id, seller.id));
  await ctx.tx
    .update(proposals)
    .set({ status: "accepted" })
    .where(
      and(eq(proposals.teamId, buyer.id), eq(proposals.listingId, listing.id), eq(proposals.status, "open")),
    );

  ctx.log({
    teamId: buyer.id,
    kind: "p2p-buy",
    amount: -listing.price,
    data: { listingId: listing.id, cardId: card.id, sellerName: seller.name },
  });
  ctx.log({
    teamId: seller.id,
    kind: "p2p-sold",
    amount: sellerGain,
    data: { listingId: listing.id, cardId: card.id, buyerName: buyer.name },
  });
  ctx.alert({
    target: "team",
    teamId: seller.id,
    text: `🤝 Сделка на бирже! Команда «${buyer.name}» купила у вас деталь «${card.name}» (+${sellerGain} ${template.currencyIcon} ${template.currencyName}).`,
  });

  return { listingId: listing.id, cardId: card.id };
}

export function buyP2PListing(options: MutationOptions, listingId: string) {
  return mutateEvent(options, async (ctx) => {
    const { team } = await requireCaptain(ctx.tx, ctx.event.id, ctx.actor);
    return executeBuyP2P(ctx, team.id, listingId);
  });
}

export function placeAuctionBid(options: MutationOptions, input: { auctionId: string; amount: number }) {
  return mutateEvent(options, async (ctx) => {
    const template = parseTemplate(ctx.event.template);
    if (!template.features.auctions) {
      throw new DomainError("Аукционы сейчас отключены", 403);
    }
    const { team } = await requireCaptain(ctx.tx, ctx.event.id, ctx.actor);
    const [lot] = await ctx.tx
      .select()
      .from(auctions)
      .where(and(eq(auctions.id, input.auctionId), eq(auctions.eventId, ctx.event.id)));
    if (!lot) throw new DomainError("Лот аукциона не найден", 404);

    const check = evaluateAuctionBid({
      auction: {
        status: lot.status,
        startingPrice: lot.startingPrice,
        currentBid: lot.currentBid,
        leaderTeamId: lot.leaderTeamId,
        endsAt: lot.endsAt.toISOString(),
      },
      bidderTeam: { id: team.id, currency: team.currency },
      amount: input.amount,
      nowMs: Date.now(),
      currencyName: template.currencyName,
    });
    if (!check.ok) throw new DomainError(check.reason ?? "Ставка отклонена", 400);

    if (check.refundTeamId && check.refundAmount > 0) {
      const [prevLeader] = await ctx.tx.select().from(teams).where(eq(teams.id, check.refundTeamId));
      if (prevLeader) {
        await ctx.tx
          .update(teams)
          .set({
            currency: prevLeader.currency + check.refundAmount,
            heldCurrency: Math.max(0, prevLeader.heldCurrency - check.refundAmount),
          })
          .where(eq(teams.id, prevLeader.id));
        const cardName = template.cards.find((c) => c.id === lot.cardId)?.name ?? lot.cardId;
        ctx.alert({
          target: "team",
          teamId: prevLeader.id,
          text: `🔥 Вашу ставку на «${cardName}» перебила команда «${team.name}» (${input.amount} ${template.currencyIcon})! Зарезервированные ${check.refundAmount} ${template.currencyIcon} возвращены на счёт.`,
        });
      }
    }

    await ctx.tx
      .update(teams)
      .set({
        currency: team.currency - input.amount,
        heldCurrency: team.heldCurrency + input.amount,
      })
      .where(eq(teams.id, team.id));

    await ctx.tx
      .update(auctions)
      .set({
        currentBid: input.amount,
        leaderTeamId: team.id,
        bidCount: lot.bidCount + 1,
        endsAt: new Date(check.nextEndsAtMs),
      })
      .where(eq(auctions.id, lot.id));

    ctx.log({
      teamId: team.id,
      kind: "auction-bid",
      data: { auctionId: lot.id, cardId: lot.cardId, amount: input.amount, extended: check.extended },
    });
    return { auctionId: lot.id, currentBid: input.amount, extended: check.extended };
  });
}

export function proposeCard(options: MutationOptions, input: { cardId: string; listingId?: string }) {
  return mutateEvent(options, async (ctx) => {
    const template = parseTemplate(ctx.event.template);
    if (!template.features.teamProposals) {
      throw new DomainError("Предложения капитану отключены", 403);
    }
    const { team, member } = await requireMember(ctx.tx, ctx.event.id, ctx.actor);
    const card = template.cards.find((c) => c.id === input.cardId);
    if (!card) throw new DomainError("Деталь не найдена", 404);
    const [open] = await ctx.tx
      .select({ id: proposals.id })
      .from(proposals)
      .where(
        and(eq(proposals.teamId, team.id), eq(proposals.cardId, input.cardId), eq(proposals.status, "open")),
      );
    if (open) return { proposalId: open.id };
    const id = `prop-${randomUUID()}`;
    await ctx.tx.insert(proposals).values({
      id,
      eventId: ctx.event.id,
      teamId: team.id,
      cardId: input.cardId,
      listingId: input.listingId ?? null,
      fromUserId: ctx.actor.userId,
      fromName: member.displayName,
    });
    ctx.log({
      teamId: team.id,
      kind: "proposal",
      data: { cardId: input.cardId, listingId: input.listingId ?? null, fromName: member.displayName },
    });
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
    if (accept) {
      if (proposal.listingId) {
        return executeBuyP2P(ctx, team.id, proposal.listingId);
      }
      return purchase(ctx, team.id, proposal.cardId);
    }
    await ctx.tx.update(proposals).set({ status: "dismissed" }).where(eq(proposals.id, proposalId));
    return { cardId: proposal.cardId };
  });
}

export function buyPerk(options: MutationOptions, perkId: string) {
  return mutateEvent(options, async (ctx) => {
    const template = parseTemplate(ctx.event.template);
    if (!template.features.perks) {
      throw new DomainError("Особые модули отключены в этой смене", 403);
    }
    const { team } = await requireCaptain(ctx.tx, ctx.event.id, ctx.actor);
    requireOpenMarket(ctx);
    const perk = template.perks.find((p) => p.id === perkId);
    if (!perk) throw new DomainError("Модуль не найден", 404);
    if (perk.dayAvailable > ctx.event.currentDay)
      throw new DomainError(`Модуль откроется в День ${perk.dayAvailable}`);
    if (team.activePerkId === perk.id) throw new DomainError("Этот модуль уже активирован");
    if (team.currency < perk.price)
      throw new DomainError(`Не хватает ${perk.price - team.currency} ${template.currencyName}`);
    await ctx.tx
      .update(teams)
      .set({ currency: team.currency - perk.price, activePerkId: perk.id })
      .where(eq(teams.id, team.id));
    ctx.log({ teamId: team.id, kind: "perk", amount: -perk.price, data: { perkId, perkName: perk.name } });
    return { perkId };
  });
}

export function submitProgramOrder(
  options: MutationOptions,
  input: { leverIndex: number; value: string | boolean },
) {
  return mutateEvent(options, async (ctx) => {
    const template = parseTemplate(ctx.event.template);
    const { team, member } = await requireMember(ctx.tx, ctx.event.id, ctx.actor);
    const teamMembers = await ctx.tx.select().from(members).where(eq(members.teamId, team.id));
    const myIdx = Math.max(
      0,
      teamMembers.findIndex((m) => m.userId === member.userId),
    );
    const allowedLevers = assignMemberLevers(myIdx, teamMembers.length, ctx.event.currentDay);
    if (!allowedLevers.includes(input.leverIndex)) {
      throw new DomainError("Этим рычагом управляет другой участник вашей команды", 403);
    }

    const prevState = TeamRoundStateSchema.parse(team.roundState ?? {});
    const nextOrders = { ...prevState.orders };

    if (input.leverIndex === 0) {
      const routeId = String(input.value);
      const missionDay = resolveMissionDay(template, ctx.event.currentDay);
      const route = missionDay.routesA.find((r) => r.id === routeId);
      if (!route) throw new DomainError("Выбранный маршрут недоступен", 400);
      if (route.requiredTag && template.features.actionTags) {
        const equipped = Object.fromEntries(template.slots.map((s) => [s.id, team.equipped[s.id] ?? null]));
        const unlocked = computeUnlockedActionTags(equipped, template);
        if (!unlocked.has(route.requiredTag)) {
          throw new DomainError(
            `Для маршрута требуется деталь с тегом «${route.tagCardName ?? route.requiredTag}»`,
            400,
          );
        }
      }
      nextOrders.routeId = routeId;
    } else if (input.leverIndex === 1 || input.leverIndex === 2) {
      const pace = String(input.value);
      if (pace !== "normal" && pace !== "fast" && pace !== "pause") {
        throw new DomainError("Недопустимый режим темпа", 400);
      }
      if (pace === "pause" && !template.features.powerCircuit) {
        throw new DomainError("Пауза охлаждения доступна только при включённом контуре нагрузки", 400);
      }
      if (input.leverIndex === 1) nextOrders.paceA = pace;
      else nextOrders.paceB = pace;
    } else if (input.leverIndex === 3) {
      nextOrders.extraCargo = input.value === true || input.value === "true";
    } else if (input.leverIndex === 4) {
      const target = String(input.value);
      if (target !== "A" && target !== "B")
        throw new DomainError("Резерв можно направить только в A или B", 400);
      nextOrders.reserveTarget = target;
    }

    const readySet = new Set(prevState.readySlots);
    readySet.add(input.leverIndex);
    const nextPinged = prevState.pingedSlots.filter((s) => s !== input.leverIndex);
    const nextState = {
      ...prevState,
      orders: nextOrders,
      readySlots: [...readySet].sort((a, b) => a - b),
      pingedSlots: nextPinged,
    };

    await ctx.tx.update(teams).set({ roundState: nextState }).where(eq(teams.id, team.id));
    ctx.log({
      teamId: team.id,
      kind: "program-order",
      data: { leverIndex: input.leverIndex, memberName: member.displayName },
    });
    return { orders: nextOrders, readySlots: nextState.readySlots };
  });
}

export function pingTeamSlot(options: MutationOptions, input: { slotIndex: number }) {
  return mutateEvent(options, async (ctx) => {
    const { team, member } = await requireMember(ctx.tx, ctx.event.id, ctx.actor);
    const prevState = TeamRoundStateSchema.parse(team.roundState ?? {});
    const pingSet = new Set(prevState.pingedSlots);
    pingSet.add(input.slotIndex);
    const nextState = { ...prevState, pingedSlots: [...pingSet] };
    await ctx.tx.update(teams).set({ roundState: nextState }).where(eq(teams.id, team.id));
    ctx.log({
      teamId: team.id,
      kind: "program-ping",
      data: { slotIndex: input.slotIndex, fromName: member.displayName },
    });
    return { pingedSlots: nextState.pingedSlots };
  });
}

export function runDiagnosisProbe(options: MutationOptions, input: { probeId: string }) {
  return mutateEvent(options, async (ctx) => {
    const template = parseTemplate(ctx.event.template);
    const { team } = await requireMember(ctx.tx, ctx.event.id, ctx.actor);
    const prevState = TeamRoundStateSchema.parse(team.roundState ?? {});
    if (prevState.diagnosisSubmitted) {
      throw new DomainError("Диагноз команды уже зафиксирован в этом раунде", 409);
    }
    const diagDay = resolveDiagnosisDay(template, ctx.event.currentDay, false);
    const probe = diagDay.probes.find((p) => p.id === input.probeId);
    if (!probe) throw new DomainError("Выбранный замер не найден", 404);
    if (prevState.usedProbes.includes(probe.id)) {
      return {
        usedProbes: prevState.usedProbes,
        probeObservations: prevState.probeObservations,
      };
    }
    if (prevState.usedProbes.length >= diagDay.maxProbes) {
      throw new DomainError(`Лимит приборных замеров исчерпан (${diagDay.maxProbes})`, 400);
    }

    const nextUsed = [...prevState.usedProbes, probe.id];
    const evalRes = evaluateProbeObservation(diagDay, nextUsed);
    const nextState = {
      ...prevState,
      usedProbes: nextUsed,
      probeObservations: evalRes.observations,
      eliminatedHypotheses: evalRes.eliminatedHypotheses,
    };

    await ctx.tx.update(teams).set({ roundState: nextState }).where(eq(teams.id, team.id));
    ctx.log({
      teamId: team.id,
      kind: "diagnosis-probe",
      data: { probeId: probe.id, probeLabel: probe.label },
    });
    return {
      usedProbes: nextUsed,
      probeObservations: evalRes.observations,
      eliminatedHypotheses: evalRes.eliminatedHypotheses,
    };
  });
}

export function submitDiagnosisVerdict(options: MutationOptions, input: { hypothesisId: string }) {
  return mutateEvent(options, async (ctx) => {
    const template = parseTemplate(ctx.event.template);
    const { team } = await requireMember(ctx.tx, ctx.event.id, ctx.actor);
    const prevState = TeamRoundStateSchema.parse(team.roundState ?? {});
    if (prevState.diagnosisSubmitted) {
      throw new DomainError("Вердикт диагностики уже отправлен", 409);
    }
    const diagDay = resolveDiagnosisDay(template, ctx.event.currentDay, false);
    const exists = diagDay.hypotheses.some((h) => h.id === input.hypothesisId);
    if (!exists) throw new DomainError("Гипотеза не найдена", 404);

    const verdict = evaluateDiagnosisVerdict({
      day: diagDay,
      hypothesisId: input.hypothesisId,
      usedProbesCount: prevState.usedProbes.length,
    });

    const nextTrack = Math.min(template.trackMax, team.trackPosition + verdict.points);
    const nextBadges =
      verdict.correct && prevState.usedProbes.length <= 1 && template.features.openMilestones !== false
        ? withBadge(team.badges, "Точный диагноз")
        : team.badges;

    const nextState = {
      ...prevState,
      selectedHypothesisId: input.hypothesisId,
      diagnosisSubmitted: true,
      lastRoundPoints: verdict.points,
      seasonPoints: prevState.seasonPoints + verdict.points,
    };

    await ctx.tx
      .update(teams)
      .set({
        trackPosition: nextTrack,
        badges: nextBadges,
        roundState: nextState,
      })
      .where(eq(teams.id, team.id));

    ctx.log({
      teamId: team.id,
      kind: "diagnosis-verdict",
      amount: verdict.points,
      data: {
        correct: verdict.correct,
        points: verdict.points,
        currencyDelta: 0,
        probesUsed: prevState.usedProbes.length,
      },
    });
    return verdict;
  });
}

export function saveTransferNote(options: MutationOptions, input: { note: string }) {
  return mutateEvent(options, async (ctx) => {
    const { team } = await requireMember(ctx.tx, ctx.event.id, ctx.actor);
    const prevState = TeamRoundStateSchema.parse(team.roundState ?? {});
    const cleanNote = input.note.trim();
    const nextState = { ...prevState, transferNote: cleanNote };
    await ctx.tx.update(teams).set({ roundState: nextState }).where(eq(teams.id, team.id));
    ctx.log({
      teamId: team.id,
      kind: "transfer-note",
      data: { note: cleanNote },
    });
    return { transferNote: cleanNote };
  });
}
