import { randomInt, randomUUID } from "node:crypto";
import {
  analyzeGeneratedMarket,
  type CardItem,
  computeEffectiveMissionStats,
  computeEquippedCircuitLoad,
  type DayScheduleItem,
  DEFAULT_TEMPLATES,
  defaultPowerCircuit,
  evaluateMissionOutcome,
  evaluateOpenMilestones,
  type FeatureFlags,
  type LoreBriefing,
  type MarketGenerationInput,
  type QuickFixKind,
  ROVER_SPRINT_TEMPLATE,
  resolveBoardTurn,
  resolveDayEngine,
  resolveLexicon,
  resolveMissionDay,
  type ShiftPhase,
  type ShiftWizardInput,
  slugifyCardName,
  TeamRoundStateSchema,
  type TemplateLexicon,
  usesPhysicalBoard,
  validateGeneratedMarket,
  validateParetoStrategies,
} from "@stem/shared";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import {
  auctions,
  cardStock,
  events,
  ledger,
  marketDrafts,
  members,
  proposals,
  teams,
} from "../../db/schema.js";
import { DomainError } from "../../shared/errors.js";
import { currentEventId } from "../../shared/route-context.js";
import { runtime } from "../../shared/runtime.js";
import { generateLoreWithAi, generateMarketCardsWithAi } from "../ai/service.js";
import { requireTeam } from "../event/access.js";
import { type MutationOptions, mutateEvent } from "../event/mutation.js";
import { newTeamValues, resetEventContent } from "../event/seed.js";
import { normalizeTemplate, toTeam } from "../event/snapshot.js";

export function rewardTeams(
  options: MutationOptions,
  input: { teamIds: string[]; amount: number; reason: string; comment?: string },
) {
  return mutateEvent(options, async (ctx) => {
    const template = normalizeTemplate(ctx.event.template);
    const snap: Array<{ teamId: string; prevCurrency: number }> = [];
    for (const teamId of new Set(input.teamIds)) {
      const team = await requireTeam(ctx.tx, ctx.event.id, teamId);
      snap.push({ teamId: team.id, prevCurrency: team.currency });
      const next = Math.max(0, team.currency + input.amount);
      const diff = next - team.currency;
      await ctx.tx.update(teams).set({ currency: next }).where(eq(teams.id, team.id));
      ctx.log({
        teamId: team.id,
        kind: "reward",
        amount: diff,
        data: { reason: input.reason, comment: input.comment ?? null },
      });
      if (diff !== 0) {
        const sign = diff > 0 ? `+${diff}` : `${diff}`;
        ctx.alert({
          target: "team",
          teamId: team.id,
          text: `${template.currencyIcon} ${sign} ${template.currencyName}: ${input.reason}${input.comment ? ` (${input.comment})` : ""}`,
        });
      }
    }
    await ctx.tx
      .update(events)
      .set({
        roundState: {
          ...(ctx.event.roundState ?? {}),
          lastRewardBatch: snap,
        },
      })
      .where(eq(events.id, ctx.event.id));
    return { teams: input.teamIds.length };
  });
}

export function undoLastRewardBatch(options: MutationOptions) {
  return mutateEvent(options, async (ctx) => {
    const batch = ctx.event.roundState?.lastRewardBatch;
    if (!batch || batch.length === 0) {
      throw new DomainError("Нет последнего группового начисления для отмены", 409);
    }
    for (const item of batch) {
      await ctx.tx
        .update(teams)
        .set({ currency: item.prevCurrency })
        .where(and(eq(teams.eventId, ctx.event.id), eq(teams.id, item.teamId)));
    }
    await ctx.tx
      .update(events)
      .set({
        roundState: {
          ...(ctx.event.roundState ?? {}),
          lastRewardBatch: null,
        },
      })
      .where(eq(events.id, ctx.event.id));
    ctx.log({ kind: "reward-undo", data: { count: batch.length } });
    return { restored: batch.length };
  });
}

export function adjustTrack(
  options: MutationOptions,
  input: { teamId: string; delta: number; reason?: string },
) {
  return mutateEvent(options, async (ctx) => {
    const team = await requireTeam(ctx.tx, ctx.event.id, input.teamId);
    const next = Math.min(ctx.event.template.trackMax, Math.max(1, team.trackPosition + input.delta));
    await ctx.tx.update(teams).set({ trackPosition: next }).where(eq(teams.id, team.id));
    ctx.log({
      teamId: team.id,
      kind: "track",
      amount: next - team.trackPosition,
      data: { reason: input.reason ?? null },
    });
    return { trackPosition: next };
  });
}

export function setPhase(options: MutationOptions, input: { phase: ShiftPhase; minutes?: number | null }) {
  return mutateEvent(options, async (ctx) => {
    const template = normalizeTemplate(ctx.event.template);
    const phaseEndsAt = input.minutes ? new Date(Date.now() + input.minutes * 60_000) : null;
    await ctx.tx
      .update(events)
      .set({ currentPhase: input.phase, phaseEndsAt })
      .where(eq(events.id, ctx.event.id));
    ctx.log({ kind: "phase", data: { phase: input.phase, minutes: input.minutes ?? null } });
    if (input.phase === "market") {
      ctx.alert({
        target: "all-teams",
        text: `🛒 Рынок открыт${input.minutes ? ` на ${input.minutes} мин` : ""}! Самое время собрать «${template.objectName}» перед выездом.`,
      });
    }
    return { phase: input.phase, phaseEndsAt: phaseEndsAt?.toISOString() ?? null };
  });
}

export function updateSettings(options: MutationOptions, input: { purchaseLimit: number | null }) {
  return mutateEvent(options, async (ctx) => {
    await ctx.tx
      .update(events)
      .set({ purchaseLimit: input.purchaseLimit })
      .where(eq(events.id, ctx.event.id));
    ctx.log({ kind: "settings", data: { purchaseLimit: input.purchaseLimit } });
    return { purchaseLimit: input.purchaseLimit };
  });
}

export function nextDay(options: MutationOptions, expectedDay?: number) {
  return mutateEvent(options, async (ctx) => {
    const template = normalizeTemplate(ctx.event.template);
    if (expectedDay !== undefined && expectedDay !== ctx.event.currentDay)
      throw new DomainError("День уже сменился. Проверьте текущий этап.", 409);
    const day = ctx.event.currentDay + 1;
    if (day > template.totalDays) throw new DomainError("Это был финальный день смены");
    await ctx.tx
      .update(events)
      .set({
        currentDay: day,
        currentPhase: "scoring",
        phaseEndsAt: null,
        roundState: {
          mode: "idle",
          secretConditionId: null,
          revealedConditionId: null,
          blindEndsAt: null,
          lastRewardBatch: null,
        },
      })
      .where(eq(events.id, ctx.event.id));
    const teamRows = await ctx.tx.select().from(teams).where(eq(teams.eventId, ctx.event.id));
    for (const row of teamRows) {
      const prev = TeamRoundStateSchema.parse(row.roundState ?? {});
      await ctx.tx
        .update(teams)
        .set({
          purchasesToday: 0,
          roundState: {
            ...prev,
            readySlots: [],
            pingedSlots: [],
            usedProbes: [],
            probeObservations: {},
            eliminatedHypotheses: {},
            selectedHypothesisId: null,
            diagnosisSubmitted: false,
            lastRoundPoints: 0,
            transferNote: "",
          },
        })
        .where(eq(teams.id, row.id));
    }
    ctx.log({ kind: "day", data: { day } });

    const briefing = template.dayBriefings.find((b) => b.day === day);
    if (template.features.storyBriefings && briefing) {
      ctx.alert({
        target: "all-teams",
        text: `📡 ${briefing.title}\n\n${briefing.story}${briefing.challengeTitle ? `\n\n🎯 Ориентир дня: ${briefing.challengeTitle}` : ""}`,
      });
    }
    return { day };
  });
}

export function applyTurn(
  options: MutationOptions,
  input?: { expectedDay?: number; buyoffTeamIds?: string[]; boardPositions?: Record<string, number> },
) {
  return mutateEvent(options, async (ctx) => {
    const day = ctx.event.currentDay;
    if (input?.expectedDay !== undefined && input.expectedDay !== day)
      throw new DomainError("День уже сменился. Проверьте текущий этап.", 409);
    const [shiftStart] = await ctx.tx
      .select({ version: ledger.version })
      .from(ledger)
      .where(and(eq(ledger.eventId, ctx.event.id), inArray(ledger.kind, ["shift-created", "reset"])))
      .orderBy(desc(ledger.id))
      .limit(1);
    const [done] = await ctx.tx
      .select({ id: ledger.id })
      .from(ledger)
      .where(
        and(
          eq(ledger.eventId, ctx.event.id),
          eq(ledger.kind, "step"),
          gt(ledger.version, shiftStart?.version ?? 0),
          sql`${ledger.data}->>'day' = ${String(day)}`,
        ),
      )
      .limit(1);
    if (done) {
      if (ctx.event.currentPhase === "turn") {
        await ctx.tx
          .update(events)
          .set({ currentPhase: "summary", phaseEndsAt: null })
          .where(eq(events.id, ctx.event.id));
        ctx.log({ kind: "phase", data: { phase: "summary" } });
      }
      return { teams: 0 };
    }

    const template = normalizeTemplate(ctx.event.template);
    const rows = await ctx.tx.select().from(teams).where(eq(teams.eventId, ctx.event.id));
    const leaderPos = rows.reduce((max, r) => Math.max(max, r.trackPosition), 1);
    const physical = usesPhysicalBoard(template, resolveDayEngine(template, day));
    if (physical && ctx.event.currentPhase !== "turn")
      throw new DomainError("Сначала закройте магазин и откройте ход на поле", 409);
    if (physical && rows.length === 0) throw new DomainError("Добавьте команды перед ходом", 409);
    const buyoffSet = new Set(input?.buyoffTeamIds ?? []);

    for (const row of rows) {
      const cell = physical
        ? template.boardCells.find((c) => c.position === input?.boardPositions?.[row.id])
        : undefined;
      if (physical && !cell) throw new DomainError(`Укажите клетку команды «${row.name}»`, 400);
      const team = toTeam(row, [], template, false);
      const outcome = resolveBoardTurn({
        team,
        cellOverride: cell?.type === "mutation" ? { ...cell, type: "start" } : cell,
        template,
        leaderTrackPosition: leaderPos,
        useBuyoff: buyoffSet.has(row.id) || (!physical && template.features.allowBuyoff),
      });

      await ctx.tx
        .update(teams)
        .set({
          boardPosition: cell?.position ?? row.boardPosition,
          trackPosition: outcome.nextTrackPosition,
          currency: outcome.nextCurrency,
        })
        .where(eq(teams.id, row.id));

      ctx.log({
        teamId: row.id,
        kind: "step",
        amount: outcome.nextTrackPosition - row.trackPosition,
        data: {
          day,
          from: row.trackPosition,
          to: outcome.nextTrackPosition,
          currencyDelta: outcome.currencyDelta,
          boardCell: cell?.label,
          losePartRequired: outcome.losePartRequired,
          summary: cell
            ? `${cell.label}: клетка ${cell.position}. Спираль: ${row.trackPosition} → ${outcome.nextTrackPosition}. ${
                cell.type === "mutation"
                  ? (cell.description ?? "Ведущий разыгрывает карточки обмена за столом.")
                  : outcome.summary
              }`
            : outcome.summary,
        },
      });
      ctx.alert({
        target: "team",
        teamId: row.id,
        text: `🏁 Итог дня ${day}: ${
          cell?.type === "mutation"
            ? `${cell.label} (кл. ${cell.position}) · Спираль: ${outcome.nextTrackPosition}. ${cell.description ?? ""}`
            : outcome.summary
        }`,
      });
    }
    await ctx.tx
      .update(events)
      .set({ currentPhase: "summary", phaseEndsAt: null })
      .where(eq(events.id, ctx.event.id));
    ctx.log({ kind: "phase", data: { phase: "summary" } });
    return { teams: rows.length };
  });
}

export function updateFeatures(options: MutationOptions, patch: Partial<FeatureFlags>) {
  return mutateEvent(options, async (ctx) => {
    const current = normalizeTemplate(ctx.event.template);
    const nextFeatures: FeatureFlags = { ...current.features, ...patch };
    const nextTemplate = { ...current, features: nextFeatures };
    const rulesVersion = ctx.event.rulesVersion + 1;
    await ctx.tx
      .update(events)
      .set({
        template: nextTemplate,
        rulesVersion,
        rulesNote: `Обновлены механики смены (v${rulesVersion})`,
      })
      .where(eq(events.id, ctx.event.id));
    ctx.rulesChanged();
    ctx.log({ kind: "features-updated", data: patch as Record<string, unknown> });
    return { features: nextFeatures };
  });
}

export function upsertCard(
  options: MutationOptions,
  input: Omit<CardItem, "id"> & { id?: string; stockLeft?: number },
) {
  return mutateEvent(options, async (ctx) => {
    const current = normalizeTemplate(ctx.event.template);
    const slotExists = current.slots.some((s) => s.id === input.slotId);
    if (!slotExists) throw new DomainError("Выбранная категория узла не существует", 400);

    const cardId =
      input.id && input.id.trim().length > 0
        ? input.id.trim()
        : slugifyCardName(input.name, current.cards.length);

    const card: CardItem = {
      id: cardId,
      name: input.name.trim(),
      slotId: input.slotId,
      rarity: input.rarity,
      tier: input.tier,
      price: input.price,
      dayAvailable: Math.min(current.totalDays, Math.max(1, input.dayAvailable)),
      stats: input.stats,
      trackBonus: input.trackBonus,
      stock: input.stock,
      ...(input.effectScope ? { effectScope: input.effectScope } : {}),
      ...(input.flavor ? { flavor: input.flavor } : {}),
    };

    const existingIdx = current.cards.findIndex((c) => c.id === card.id);
    const nextCards =
      existingIdx >= 0
        ? current.cards.map((c, idx) => (idx === existingIdx ? card : c))
        : [...current.cards, card];

    const rulesVersion = ctx.event.rulesVersion + 1;
    await ctx.tx
      .update(events)
      .set({
        template: { ...current, cards: nextCards },
        rulesVersion,
        rulesNote: `Обновлена деталь «${card.name}»`,
      })
      .where(eq(events.id, ctx.event.id));

    const targetStockLeft = input.stockLeft ?? card.stock;
    const [existingStock] = await ctx.tx
      .select()
      .from(cardStock)
      .where(and(eq(cardStock.eventId, ctx.event.id), eq(cardStock.cardId, card.id)));
    if (existingStock) {
      await ctx.tx
        .update(cardStock)
        .set({ left: Math.max(0, targetStockLeft) })
        .where(and(eq(cardStock.eventId, ctx.event.id), eq(cardStock.cardId, card.id)));
    } else {
      await ctx.tx
        .insert(cardStock)
        .values({ eventId: ctx.event.id, cardId: card.id, left: Math.max(0, targetStockLeft) });
    }

    ctx.rulesChanged();
    ctx.log({ kind: "card-upserted", data: { cardId: card.id, cardName: card.name } });
    return { cardId: card.id };
  });
}

export function applyQuickFix(options: MutationOptions, fix: QuickFixKind) {
  return mutateEvent(options, async (ctx) => {
    const template = normalizeTemplate(ctx.event.template);

    if (fix.type === "grant_all") {
      const allTeams = await ctx.tx.select().from(teams).where(eq(teams.eventId, ctx.event.id));
      for (const team of allTeams) {
        const next = Math.max(0, team.currency + fix.amount);
        await ctx.tx.update(teams).set({ currency: next }).where(eq(teams.id, team.id));
        ctx.log({ teamId: team.id, kind: "reward", amount: fix.amount, data: { reason: fix.reason } });
      }
      ctx.alert({
        target: "all-teams",
        text: `${template.currencyIcon} +${fix.amount} ${template.currencyName} всем командам: ${fix.reason}`,
      });
      return { applied: fix.type };
    }

    if (fix.type === "restock_slot") {
      const slotCards = template.cards.filter(
        (c) => c.slotId === fix.slotId && c.dayAvailable <= ctx.event.currentDay,
      );
      for (const card of slotCards) {
        const [st] = await ctx.tx
          .select()
          .from(cardStock)
          .where(and(eq(cardStock.eventId, ctx.event.id), eq(cardStock.cardId, card.id)));
        if (st) {
          await ctx.tx
            .update(cardStock)
            .set({ left: st.left + fix.amount })
            .where(and(eq(cardStock.eventId, ctx.event.id), eq(cardStock.cardId, card.id)));
        }
      }
      ctx.log({ kind: "quick-fix", data: { note: `пополнен запас категории` } });
      return { applied: fix.type };
    }

    let nextTemplate = template;
    let note = "корректировка баланса";

    if (fix.type === "bump_card_price") {
      nextTemplate = {
        ...template,
        cards: template.cards.map((c) =>
          c.id === fix.cardId ? { ...c, price: Math.max(1, c.price + fix.delta) } : c,
        ),
      };
      note = "скорректирована цена детали";
    } else if (fix.type === "discount_rarity") {
      nextTemplate = {
        ...template,
        cards: template.cards.map((c) =>
          c.rarity === fix.rarity ? { ...c, price: Math.max(1, c.price + fix.delta) } : c,
        ),
      };
      note = "обновлены цены по редкости";
    } else if (fix.type === "enable_feature") {
      nextTemplate = {
        ...template,
        features: { ...template.features, [fix.feature]: true },
      };
      note = "включена механика поддержки";
    } else if (fix.type === "tighten_p2p_corridor") {
      nextTemplate = {
        ...template,
        features: {
          ...template.features,
          p2pMinPriceRatio: 0.75,
          p2pMaxPriceRatio: 2.0,
          p2pFeePercent: 10,
        },
      };
      note = "ужесточён коридор цен на бирже";
    }

    const rulesVersion = ctx.event.rulesVersion + 1;
    await ctx.tx
      .update(events)
      .set({ template: nextTemplate, rulesVersion, rulesNote: note })
      .where(eq(events.id, ctx.event.id));
    ctx.rulesChanged();
    ctx.log({ kind: "quick-fix", data: { note } });
    return { applied: fix.type };
  });
}

export function saveDayBriefing(
  options: MutationOptions,
  input: { briefing: LoreBriefing; broadcast: boolean },
) {
  return mutateEvent(options, async (ctx) => {
    const template = normalizeTemplate(ctx.event.template);
    const others = template.dayBriefings.filter((b) => b.day !== input.briefing.day);
    const nextBriefings = [...others, input.briefing].sort((a, b) => a.day - b.day);
    const rulesVersion = ctx.event.rulesVersion + 1;
    await ctx.tx
      .update(events)
      .set({
        template: { ...template, dayBriefings: nextBriefings },
        rulesVersion,
        rulesNote: `Обновлена легенда дня ${input.briefing.day}`,
      })
      .where(eq(events.id, ctx.event.id));
    ctx.rulesChanged();
    ctx.log({ kind: "lore-push", data: { day: input.briefing.day, title: input.briefing.title } });
    if (input.broadcast) {
      ctx.alert({
        target: "all-teams",
        text: `📡 ${input.briefing.title}\n\n${input.briefing.story}`,
      });
    }
    return { day: input.briefing.day };
  });
}

export function startAuction(
  options: MutationOptions,
  input: { cardId: string; startingPrice: number; durationMinutes: number },
) {
  return mutateEvent(options, async (ctx) => {
    const template = normalizeTemplate(ctx.event.template);
    if (!template.features.auctions) {
      throw new DomainError("Включите рубильник аукционов перед запуском торгов", 403);
    }
    const card = template.cards.find((c) => c.id === input.cardId);
    if (!card) throw new DomainError("Деталь для аукциона не найдена", 404);

    const id = `auc-${randomUUID()}`;
    const endsAt = new Date(Date.now() + input.durationMinutes * 60_000);
    await ctx.tx.insert(auctions).values({
      id,
      eventId: ctx.event.id,
      cardId: card.id,
      startingPrice: input.startingPrice,
      currentBid: 0,
      leaderTeamId: null,
      bidCount: 0,
      endsAt,
      status: "open",
    });
    ctx.log({
      kind: "auction-start",
      data: { auctionId: id, cardId: card.id, startingPrice: input.startingPrice },
    });
    ctx.alert({
      target: "all-teams",
      text: `🔥 Открыт аукцион за узел «${card.name}»! Старт от ${input.startingPrice} ${template.currencyIcon} (${input.durationMinutes} мин).`,
    });
    return { auctionId: id };
  });
}

export function closeAuctionNow(options: MutationOptions, auctionId: string) {
  return mutateEvent(options, async (ctx) => {
    const template = normalizeTemplate(ctx.event.template);
    const [lot] = await ctx.tx
      .select()
      .from(auctions)
      .where(and(eq(auctions.id, auctionId), eq(auctions.eventId, ctx.event.id)));
    if (lot?.status !== "open") throw new DomainError("Аукцион уже завершён", 409);

    await ctx.tx
      .update(auctions)
      .set({ status: "settled", endsAt: new Date() })
      .where(eq(auctions.id, lot.id));
    if (lot.leaderTeamId) {
      const [winner] = await ctx.tx.select().from(teams).where(eq(teams.id, lot.leaderTeamId));
      if (winner) {
        const card = template.cards.find((c) => c.id === lot.cardId);
        const slotEmpty = card ? !winner.equipped[card.slotId] : false;
        const nextEquipped =
          card && slotEmpty ? { ...winner.equipped, [card.slotId]: card.id } : winner.equipped;
        const nextInventory = card && slotEmpty ? winner.inventory : [...winner.inventory, lot.cardId];
        await ctx.tx
          .update(teams)
          .set({
            heldCurrency: Math.max(0, winner.heldCurrency - lot.currentBid),
            equipped: nextEquipped,
            inventory: nextInventory,
          })
          .where(eq(teams.id, winner.id));
        ctx.log({
          teamId: winner.id,
          kind: "auction-won",
          amount: -lot.currentBid,
          data: { cardId: lot.cardId, bid: lot.currentBid },
        });
        ctx.alert({
          target: "team",
          teamId: winner.id,
          text: `🏆 Победа на торгах! Деталь «${card?.name ?? lot.cardId}» досталась вашей команде за ${lot.currentBid} ${template.currencyIcon}.`,
        });
      }
    }
    return { auctionId: lot.id };
  });
}

export async function getPendingDraft() {
  const eventId = await currentEventId();
  const [draft] = await runtime()
    .db.select()
    .from(marketDrafts)
    .where(and(eq(marketDrafts.eventId, eventId), eq(marketDrafts.status, "pending")))
    .orderBy(desc(marketDrafts.createdAt))
    .limit(1);
  return draft ?? null;
}

export async function generateMarketDraft(actorUserId: number, input: MarketGenerationInput) {
  const eventId = await currentEventId();
  const [event] = await runtime().db.select().from(events).where(eq(events.id, eventId));
  if (!event) throw new DomainError("Активная смена не найдена", 404);
  const template = normalizeTemplate(event.template);

  const generated = await generateMarketCardsWithAi(template, input);
  const draftId = `draft-${randomUUID()}`;
  const [draft] = await runtime()
    .db.insert(marketDrafts)
    .values({
      id: draftId,
      eventId,
      theme: input.theme,
      cards: generated.cards,
      balance: generated.balance as unknown as Record<string, unknown>,
      createdBy: actorUserId,
    })
    .returning();

  return {
    draftId,
    theme: input.theme,
    cards: generated.cards,
    balance: generated.balance,
    provider: generated.provider,
    status: draft?.status ?? "pending",
  };
}

export async function updateMarketDraft(draftId: string, rawCards: unknown[]) {
  const eventId = await currentEventId();
  const [event] = await runtime().db.select().from(events).where(eq(events.id, eventId));
  const [draft] = await runtime()
    .db.select()
    .from(marketDrafts)
    .where(and(eq(marketDrafts.id, draftId), eq(marketDrafts.eventId, eventId)));
  if (!event || !draft) throw new DomainError("Черновик не найден", 404);
  if (draft.status !== "pending") throw new DomainError("Черновик уже закрыт", 409);

  const template = normalizeTemplate(event.template);
  const checked = validateGeneratedMarket({ cards: rawCards }, template, rawCards.length);
  if (!checked.success) {
    throw new DomainError(`Проверьте поля карточек: ${checked.issues.slice(0, 4).join("; ")}`, 400);
  }
  const balance = analyzeGeneratedMarket(checked.cards, template);
  const [updated] = await runtime()
    .db.update(marketDrafts)
    .set({ cards: checked.cards, balance: balance as unknown as Record<string, unknown> })
    .where(eq(marketDrafts.id, draft.id))
    .returning();
  return updated;
}

export function decideMarketDraft(
  options: MutationOptions,
  input: { draftId: string; decision: "approve" | "reject"; mode?: "append" | "replace" },
) {
  return mutateEvent(options, async (ctx) => {
    const [draft] = await ctx.tx
      .select()
      .from(marketDrafts)
      .where(and(eq(marketDrafts.id, input.draftId), eq(marketDrafts.eventId, ctx.event.id)));
    if (!draft) throw new DomainError("Черновик не найден", 404);
    if (draft.status !== "pending") throw new DomainError("Черновик уже обработан", 409);

    if (input.decision === "reject") {
      await ctx.tx.update(marketDrafts).set({ status: "rejected" }).where(eq(marketDrafts.id, draft.id));
      return { status: "rejected" as const, published: 0 };
    }

    const template = normalizeTemplate(ctx.event.template);
    const checked = validateGeneratedMarket({ cards: draft.cards }, template, draft.cards.length);
    if (!checked.success) throw new DomainError("Черновик содержит некорректные поля", 400);

    const existingIds = new Set(template.cards.map((c) => c.id));
    const preparedCards = checked.cards.map((card, idx) =>
      input.mode !== "replace" && existingIds.has(card.id) ? { ...card, id: `${card.id}-${idx + 1}` } : card,
    );

    const nextCards = input.mode === "replace" ? preparedCards : [...template.cards, ...preparedCards];
    const rulesVersion = ctx.event.rulesVersion + 1;
    await ctx.tx
      .update(events)
      .set({
        template: { ...template, cards: nextCards },
        rulesVersion,
        rulesNote: `Опубликован набор деталей (${preparedCards.length} шт.)`,
      })
      .where(eq(events.id, ctx.event.id));

    if (input.mode === "replace") {
      await ctx.tx.delete(cardStock).where(eq(cardStock.eventId, ctx.event.id));
    }
    if (preparedCards.length > 0) {
      await ctx.tx
        .insert(cardStock)
        .values(preparedCards.map((c) => ({ eventId: ctx.event.id, cardId: c.id, left: c.stock })));
    }
    await ctx.tx.update(marketDrafts).set({ status: "approved" }).where(eq(marketDrafts.id, draft.id));
    ctx.rulesChanged();
    ctx.log({
      kind: "market-published",
      data: { draftId: draft.id, cardIds: preparedCards.map((c) => c.id) },
    });
    return { status: "approved" as const, published: preparedCards.length };
  });
}

export async function createShiftFromWizard(options: MutationOptions, input: ShiftWizardInput) {
  const base = DEFAULT_TEMPLATES.find((t) => t.id === input.baseTemplateId) ?? ROVER_SPRINT_TEMPLATE;
  let customTemplate = normalizeTemplate({
    ...base,
    id: `${base.id}-${Date.now().toString(36)}`,
    title: input.title.trim(),
    theme: input.theme.trim(),
    totalDays: input.totalDays,
    totalPoints: input.totalDays,
    eventTag: `${input.title.trim().toUpperCase()} · ${input.totalDays} ДН.`,
    cards: base.cards.map((c) => ({
      ...c,
      dayAvailable: Math.min(input.totalDays, c.dayAvailable),
    })),
  });

  if (input.useAiLoreAndCards) {
    const [lore, market] = await Promise.all([
      generateLoreWithAi(customTemplate, input.theme, input.totalDays),
      generateMarketCardsWithAi(customTemplate, {
        theme: input.theme,
        templateId: customTemplate.id,
        count: input.cardCount,
        debuffStrength: "balanced",
        rareSharePercent: 30,
        legendarySharePercent: 15,
        allowedScopes: ["step", "event_shield", "economy", "slot_synergy"],
      }),
    ]);
    customTemplate = {
      ...customTemplate,
      cards: market.cards,
      dayBriefings: lore,
    };
  }

  return mutateEvent(options, async (ctx) => {
    await ctx.tx.delete(proposals).where(eq(proposals.eventId, ctx.event.id));
    await ctx.tx.delete(marketDrafts).where(eq(marketDrafts.eventId, ctx.event.id));
    await resetEventContent(ctx.tx, ctx.event.id, customTemplate, input.teamCount);
    const rulesVersion = ctx.event.rulesVersion + 1;
    await ctx.tx
      .update(events)
      .set({
        title: customTemplate.title,
        template: customTemplate,
        currentDay: 1,
        currentPhase: "scoring",
        phaseEndsAt: null,
        purchaseLimit: customTemplate.dailyPurchaseLimit,
        rulesVersion,
        rulesNote: `Запущена смена «${customTemplate.title}»`,
        roundState: {
          mode: "idle",
          secretConditionId: null,
          revealedConditionId: null,
          blindEndsAt: null,
          lastRewardBatch: null,
        },
      })
      .where(eq(events.id, ctx.event.id));
    ctx.rulesChanged();
    ctx.log({ kind: "shift-created", data: { title: customTemplate.title, teams: input.teamCount } });
    return { title: customTemplate.title };
  });
}

export function createTeam(options: MutationOptions, input: { name: string }) {
  return mutateEvent(options, async (ctx) => {
    const [{ count } = { count: 0 }] = await ctx.tx
      .select({ count: sql<number>`count(*)::int` })
      .from(teams)
      .where(eq(teams.eventId, ctx.event.id));
    const values = newTeamValues(
      ctx.event.id,
      input.name.trim(),
      count,
      normalizeTemplate(ctx.event.template),
    );
    await ctx.tx.insert(teams).values(values);
    ctx.log({ teamId: values.id, kind: "team", data: { name: values.name } });
    return { teamId: values.id, joinCode: values.joinCode };
  });
}

export function setCaptain(options: MutationOptions, input: { teamId: string; userId: number }) {
  return mutateEvent(options, async (ctx) => {
    const team = await requireTeam(ctx.tx, ctx.event.id, input.teamId);
    const [target] = await ctx.tx
      .select()
      .from(members)
      .where(and(eq(members.teamId, team.id), eq(members.userId, input.userId)));
    if (!target) throw new DomainError("Участник не найден в команде", 404);
    await ctx.tx.update(members).set({ role: "member" }).where(eq(members.teamId, team.id));
    await ctx.tx
      .update(members)
      .set({ role: "captain" })
      .where(and(eq(members.teamId, team.id), eq(members.userId, input.userId)));
    ctx.log({ teamId: team.id, kind: "captain", data: { displayName: target.displayName } });
    return { teamId: team.id };
  });
}

export function removeMember(options: MutationOptions, input: { userId: number }) {
  return mutateEvent(options, async (ctx) => {
    await ctx.tx
      .delete(members)
      .where(and(eq(members.eventId, ctx.event.id), eq(members.userId, input.userId)));
    ctx.log({ kind: "member-removed", data: { userId: input.userId } });
    return { userId: input.userId };
  });
}

export function resetEvent(options: MutationOptions, input: { templateId?: string; demoTeams: boolean }) {
  return mutateEvent(options, async (ctx) => {
    const template = input.templateId
      ? DEFAULT_TEMPLATES.find((t) => t.id === input.templateId)
      : normalizeTemplate(ctx.event.template);
    if (!template) throw new DomainError("Шаблон не найден", 404);
    await ctx.tx.delete(proposals).where(eq(proposals.eventId, ctx.event.id));
    await resetEventContent(ctx.tx, ctx.event.id, template, input.demoTeams);
    const rulesVersion = ctx.event.rulesVersion + 1;
    await ctx.tx
      .update(events)
      .set({
        title: template.title,
        template,
        currentDay: 1,
        currentPhase: "scoring",
        phaseEndsAt: null,
        purchaseLimit: template.dailyPurchaseLimit,
        rulesVersion,
        rulesNote: `Версия ${rulesVersion} · Старт смены «${template.title}»`,
        roundState: {
          mode: "idle",
          secretConditionId: null,
          revealedConditionId: null,
          blindEndsAt: null,
          lastRewardBatch: null,
        },
      })
      .where(eq(events.id, ctx.event.id));
    ctx.rulesChanged();
    ctx.log({ kind: "reset", data: { templateId: template.id } });
    return { templateId: template.id };
  });
}

export function extendPhaseTimer(options: MutationOptions, input: { seconds: number }) {
  return mutateEvent(options, async (ctx) => {
    const baseMs =
      ctx.event.phaseEndsAt && ctx.event.phaseEndsAt.getTime() > Date.now()
        ? ctx.event.phaseEndsAt.getTime()
        : Date.now();
    const nextEnds = new Date(baseMs + input.seconds * 1000);
    await ctx.tx.update(events).set({ phaseEndsAt: nextEnds }).where(eq(events.id, ctx.event.id));
    return { phaseEndsAt: nextEnds.toISOString() };
  });
}

export function startRoundEngine(
  options: MutationOptions,
  input: {
    engine?: "mission" | "diagnosis";
    durationSeconds?: number;
    conditionId?: string;
  },
) {
  return mutateEvent(options, async (ctx) => {
    const template = normalizeTemplate(ctx.event.template);
    const lexicon = resolveLexicon(template);
    const activeEngine = input.engine ?? resolveDayEngine(template, ctx.event.currentDay);
    const now = Date.now();

    if (activeEngine === "diagnosis") {
      const durationSec = input.durationSeconds ?? 180;
      const phaseEndsAt = new Date(now + durationSec * 1000);
      await ctx.tx
        .update(events)
        .set({
          currentPhase: "turn",
          phaseEndsAt,
          roundState: {
            ...(ctx.event.roundState ?? {}),
            mode: "diagnosis",
            secretConditionId: null,
            revealedConditionId: null,
            blindEndsAt: null,
          },
        })
        .where(eq(events.id, ctx.event.id));
      ctx.log({ kind: "program-start", data: { engine: "diagnosis", durationSec } });
      ctx.alert({
        target: "all-teams",
        text: `🔬 Начат раунд «${lexicon.diagnosisLabel}» (${Math.round(durationSec / 60)} мин). Откройте кабинет команды и выберите приборный замер.`,
      });
      return { mode: "diagnosis" as const, phaseEndsAt: phaseEndsAt.toISOString() };
    }

    const missionDay = resolveMissionDay(template, ctx.event.currentDay);
    const chosenCondition =
      (input.conditionId ? missionDay.conditions.find((c) => c.id === input.conditionId) : undefined) ??
      missionDay.conditions[randomInt(missionDay.conditions.length)] ??
      missionDay.conditions[0];

    const durationSec = input.durationSeconds ?? 120;
    const blindEndsAt = new Date(now + Math.min(30, Math.floor(durationSec / 3)) * 1000);
    const phaseEndsAt = new Date(now + durationSec * 1000);

    await ctx.tx
      .update(events)
      .set({
        currentPhase: "turn",
        phaseEndsAt,
        roundState: {
          ...(ctx.event.roundState ?? {}),
          mode: "blind_draft",
          secretConditionId: chosenCondition?.id ?? "calm",
          revealedConditionId: null,
          blindEndsAt: blindEndsAt.toISOString(),
        },
      })
      .where(eq(events.id, ctx.event.id));

    ctx.log({ kind: "program-start", data: { engine: "mission", durationSec } });
    ctx.alert({
      target: "all-teams",
      text: `🧭 Открыта «${lexicon.programLabel}» на ${Math.round(durationSec / 60)} мин! Первые 30 секунд — личный выбор каждого участника.`,
    });
    return {
      mode: "blind_draft" as const,
      phaseEndsAt: phaseEndsAt.toISOString(),
      blindEndsAt: blindEndsAt.toISOString(),
    };
  });
}

export function revealMissionRound(options: MutationOptions, input?: { conditionId?: string }) {
  return mutateEvent(options, async (ctx) => {
    const template = normalizeTemplate(ctx.event.template);
    const day = ctx.event.currentDay;
    const missionDay = resolveMissionDay(template, day);
    const targetCondId =
      input?.conditionId ?? ctx.event.roundState?.secretConditionId ?? missionDay.conditions[0]?.id;
    const condition = missionDay.conditions.find((c) => c.id === targetCondId) ?? missionDay.conditions[0];
    if (!condition) throw new DomainError("Условие среды не настроено", 400);

    const totalWeight = missionDay.conditions.reduce((s, c) => s + c.weight, 0);
    const circuit = defaultPowerCircuit(template);
    const rows = await ctx.tx.select().from(teams).where(eq(teams.eventId, ctx.event.id));

    for (const row of rows) {
      const plain = toTeam(row, [], template, false);
      const prevRound = TeamRoundStateSchema.parse(row.roundState ?? {});
      const effStats = computeEffectiveMissionStats(plain, template);
      const eqLoad = computeEquippedCircuitLoad(plain.equippedCards, template);

      const outcome = evaluateMissionOutcome({
        stats: effStats,
        day: missionDay,
        orders: prevRound.orders,
        condition,
        totalWeight,
        circuit,
        equippedLoad: eqLoad,
      });

      const newMilestones = evaluateOpenMilestones({ outcome, team: plain, template });
      const mergedBadges = Array.from(new Set([...row.badges, ...newMilestones]));
      const nextTrack = Math.min(template.trackMax, row.trackPosition + outcome.totalPoints);

      await ctx.tx
        .update(teams)
        .set({
          trackPosition: nextTrack,
          badges: mergedBadges,
          roundState: {
            ...prevRound,
            lastRoundPoints: outcome.totalPoints,
            seasonPoints: prevRound.seasonPoints + outcome.totalPoints,
          },
        })
        .where(eq(teams.id, row.id));

      const summary = `${condition.label}: +${outcome.totalPoints} очк. (A:${outcome.sectorA.points}, B:${outcome.sectorB.points}, валюта: 0)`;
      ctx.log({
        teamId: row.id,
        kind: "round-reveal",
        amount: outcome.totalPoints,
        data: {
          day,
          conditionId: condition.id,
          conditionLabel: condition.label,
          points: outcome.totalPoints,
          currencyDelta: 0,
          summary,
        },
      });
      ctx.alert({
        target: "team",
        teamId: row.id,
        text: `🏁 Вскрытие дня ${day} (${condition.label}): ваша команда набрала +${outcome.totalPoints} очк.! Откройте разбор и контрфактуал.`,
      });
    }

    await ctx.tx
      .update(events)
      .set({
        currentPhase: "summary",
        phaseEndsAt: null,
        roundState: {
          ...(ctx.event.roundState ?? {}),
          mode: "revealed",
          revealedConditionId: condition.id,
        },
      })
      .where(eq(events.id, ctx.event.id));

    return { conditionId: condition.id, conditionLabel: condition.label, teams: rows.length };
  });
}

export function updateTemplateLexicon(options: MutationOptions, patch: Partial<TemplateLexicon>) {
  return mutateEvent(options, async (ctx) => {
    const current = normalizeTemplate(ctx.event.template);
    const mergedLexicon = { ...resolveLexicon(current), ...patch };
    const nextTemplate = normalizeTemplate({
      ...current,
      objectName: mergedLexicon.objectName,
      currencyName: mergedLexicon.currencyLabel,
      lexicon: mergedLexicon,
    });
    const rulesVersion = ctx.event.rulesVersion + 1;
    await ctx.tx
      .update(events)
      .set({
        template: nextTemplate,
        rulesVersion,
        rulesNote: `Обновлён словарь смены (v${rulesVersion})`,
      })
      .where(eq(events.id, ctx.event.id));
    ctx.rulesChanged();
    ctx.log({ kind: "lexicon-updated", data: patch as Record<string, unknown> });
    return { lexicon: mergedLexicon };
  });
}

export function updateDaySchedule(
  options: MutationOptions,
  input: { totalDays?: number; daySchedule: DayScheduleItem[] },
) {
  return mutateEvent(options, async (ctx) => {
    const current = normalizeTemplate(ctx.event.template);
    const totalDays = input.totalDays ?? current.totalDays;
    const nextTemplate = normalizeTemplate({
      ...current,
      totalDays,
      totalPoints: totalDays,
      daySchedule: input.daySchedule,
    });
    const rulesVersion = ctx.event.rulesVersion + 1;
    await ctx.tx
      .update(events)
      .set({
        template: nextTemplate,
        rulesVersion,
        rulesNote: `Обновлено расписание дней (v${rulesVersion})`,
      })
      .where(eq(events.id, ctx.event.id));
    ctx.rulesChanged();
    ctx.log({ kind: "schedule-updated", data: { totalDays } });
    return { totalDays, daySchedule: nextTemplate.daySchedule };
  });
}

export function applyParetoFix(options: MutationOptions, input?: { day?: number }) {
  return mutateEvent(options, async (ctx) => {
    const current = normalizeTemplate(ctx.event.template);
    const targetDay = input?.day ?? ctx.event.currentDay;
    const missionDay = resolveMissionDay(current, targetDay);
    const s0 = current.stats[0]?.id ?? "speed";
    const s1 = current.stats[1]?.id ?? s0;
    const s2 = current.stats[2]?.id ?? s1;
    const check = validateParetoStrategies({
      day: missionDay,
      referenceStats: { [s0]: 4, [s1]: 5, [s2]: 4 },
      circuit: defaultPowerCircuit(current),
    });

    const updatedMission = {
      ...missionDay,
      routesA: missionDay.routesA.map((r, i) => (i === 0 ? { ...r, min: check.suggestedMinA } : r)),
    };

    const existingIdx = current.missionDays.findIndex((m) => m.day === targetDay);
    const nextMissionDays =
      existingIdx >= 0
        ? current.missionDays.map((m, i) => (i === existingIdx ? updatedMission : m))
        : [...current.missionDays, updatedMission];

    const nextTemplate = normalizeTemplate({
      ...current,
      missionDays: nextMissionDays,
    });
    const rulesVersion = ctx.event.rulesVersion + 1;
    await ctx.tx
      .update(events)
      .set({
        template: nextTemplate,
        rulesVersion,
        rulesNote: `Выровнен порог короткого пути до ${check.suggestedMinA} (v${rulesVersion})`,
      })
      .where(eq(events.id, ctx.event.id));
    ctx.rulesChanged();
    ctx.log({
      kind: "pareto-fix",
      data: { day: targetDay, suggestedMinA: check.suggestedMinA },
    });
    return { suggestedMinA: check.suggestedMinA };
  });
}
