import type { AuctionLot, BoardCell, CardItem, FeatureFlags, GameTemplate, Team } from "./schema.js";

export const AUCTION_ANTI_SNIPE_WINDOW_MS = 15_000;
export const AUCTION_ANTI_SNIPE_EXTEND_MS = 20_000;

export interface StepPart {
  key: string;
  value: number;
  met: boolean;
  statId?: string;
  min?: number;
  isPerk?: boolean;
  label: string;
}

export interface TeamStepBreakdown {
  total: number;
  parts: StepPart[];
}

export interface TeamComputedStats {
  byPart: Record<string, number>;
  byPerk: Record<string, number>;
  byModifier: Record<string, number>;
  total: Record<string, number>;
  perkConditionMet: boolean;
  hasEventShield: boolean;
  economyBonus: number;
  step: TeamStepBreakdown;
}

export function calculateTeamStep(
  totals: Record<string, number>,
  equippedCards: Record<string, string | null>,
  activePerkId: string | null,
  template: GameTemplate,
  leaderTrackPosition?: number,
  teamTrackPosition?: number,
): TeamStepBreakdown {
  const parts: StepPart[] = [{ key: "base", value: 1, met: true, label: "база" }];

  for (const th of template.stepThresholds) {
    const current = totals[th.statId] ?? 0;
    parts.push({
      key: `th:${th.statId}:${th.min}`,
      statId: th.statId,
      min: th.min,
      value: th.bonus,
      met: current >= th.min,
      label: `от ${th.min}`,
    });
  }

  const cardMap = new Map<string, CardItem>(template.cards.map((c) => [c.id, c]));
  let cardTrackBonus = 0;
  let filledSlots = 0;
  let hasSynergyCard = false;

  for (const cardId of Object.values(equippedCards)) {
    if (!cardId) continue;
    filledSlots += 1;
    const card = cardMap.get(cardId);
    if (!card) continue;
    if (card.trackBonus) cardTrackBonus += card.trackBonus;
    if (card.effectScope === "step") cardTrackBonus += 1;
    if (card.effectScope === "slot_synergy") hasSynergyCard = true;
  }

  if (cardTrackBonus > 0) {
    parts.push({
      key: "cards-bonus",
      value: cardTrackBonus,
      met: true,
      label: "узлы",
    });
  }

  if (hasSynergyCard) {
    const minFilled = Math.max(3, Math.ceil(template.slots.length * 0.65));
    parts.push({
      key: "slot-synergy",
      value: 1,
      met: filledSlots >= minFilled,
      label: `сборка ${minFilled}+`,
    });
  }

  if (template.features?.perks !== false) {
    const activePerk = template.perks.find((p) => p.id === activePerkId);
    if (activePerk && activePerk.stepBonus > 0 && activePerk.minStatsCondition) {
      const entries = Object.entries(activePerk.minStatsCondition);
      const firstEntry = entries[0];
      const met = entries.every(([statId, minVal]) => (totals[statId] ?? 0) >= minVal);
      parts.push({
        key: `perk:${activePerk.id}`,
        statId: firstEntry?.[0],
        min: firstEntry?.[1],
        value: activePerk.stepBonus,
        met,
        isPerk: true,
        label: activePerk.shortName ?? activePerk.name,
      });
    }
  }

  if (
    template.features?.catchUpBonus &&
    leaderTrackPosition !== undefined &&
    teamTrackPosition !== undefined &&
    leaderTrackPosition - teamTrackPosition >= 6
  ) {
    parts.push({
      key: "catch-up",
      value: 1,
      met: true,
      label: "догоняющий импульс",
    });
  }

  const total = parts.filter((p) => p.met).reduce((sum, p) => sum + p.value, 0);
  return { total, parts };
}

export function calculateTeamStats(
  team: Team,
  template: GameTemplate,
  leaderTrackPosition?: number,
): TeamComputedStats {
  const byPart: Record<string, number> = {};
  const byPerk: Record<string, number> = {};
  const byModifier: Record<string, number> = {};
  const total: Record<string, number> = {};

  for (const stat of template.stats) {
    byPart[stat.id] = 0;
    byPerk[stat.id] = 0;
    byModifier[stat.id] = team.statModifiers[stat.id] ?? 0;
  }

  const cardMap = new Map<string, CardItem>(template.cards.map((c) => [c.id, c]));
  let hasEventShield = false;
  let economyBonus = 0;

  for (const cardId of Object.values(team.equippedCards)) {
    if (!cardId) continue;
    const card = cardMap.get(cardId);
    if (!card) continue;
    if (card.effectScope === "event_shield") hasEventShield = true;
    if (card.effectScope === "economy") economyBonus += 1;
    for (const [statId, value] of Object.entries(card.stats)) {
      byPart[statId] = (byPart[statId] ?? 0) + value;
    }
  }

  const activePerk =
    template.features?.perks !== false ? template.perks.find((p) => p.id === team.activePerkId) : undefined;
  if (activePerk) {
    for (const [statId, value] of Object.entries(activePerk.stats)) {
      byPerk[statId] = (byPerk[statId] ?? 0) + value;
    }
  }

  for (const stat of template.stats) {
    total[stat.id] = (byPart[stat.id] ?? 0) + (byPerk[stat.id] ?? 0) + (byModifier[stat.id] ?? 0);
  }

  let perkConditionMet = true;
  if (activePerk?.minStatsCondition) {
    for (const [statId, minVal] of Object.entries(activePerk.minStatsCondition)) {
      if ((total[statId] ?? 0) < minVal) {
        perkConditionMet = false;
        break;
      }
    }
  }

  const step = calculateTeamStep(
    total,
    team.equippedCards,
    team.activePerkId,
    template,
    leaderTrackPosition,
    team.trackPosition,
  );

  return {
    byPart,
    byPerk,
    byModifier,
    total,
    perkConditionMet,
    hasEventShield,
    economyBonus,
    step,
  };
}

export interface CardEffectPreview {
  beforeStats: TeamComputedStats;
  afterStats: TeamComputedStats;
  stepDelta: number;
  lostParts: StepPart[];
  gainedParts: StepPart[];
  replacedCard: CardItem | undefined;
}

export function previewCardEffect(team: Team, card: CardItem, template: GameTemplate): CardEffectPreview {
  const beforeStats = calculateTeamStats(team, template);
  const nextTeam: Team = {
    ...team,
    equippedCards: { ...team.equippedCards, [card.slotId]: card.id },
  };
  const afterStats = calculateTeamStats(nextTeam, template);

  const lostParts = beforeStats.step.parts.filter((part) => {
    if (!part.met || part.key === "base") return false;
    const afterPart = afterStats.step.parts.find((p) => p.key === part.key);
    return !afterPart?.met;
  });

  const gainedParts = afterStats.step.parts.filter((part) => {
    if (!part.met || part.key === "base") return false;
    const beforePart = beforeStats.step.parts.find((p) => p.key === part.key);
    return !beforePart?.met;
  });

  const prevCardId = team.equippedCards[card.slotId];
  const replacedCard = prevCardId ? template.cards.find((c) => c.id === prevCardId) : undefined;

  return {
    beforeStats,
    afterStats,
    stepDelta: afterStats.step.total - beforeStats.step.total,
    lostParts,
    gainedParts,
    replacedCard,
  };
}

export type BuyStateKind = "closed" | "equipped" | "soldOut" | "limit" | "funds" | "propose" | "buy";

export interface BuyStateResult {
  ok: boolean;
  kind: BuyStateKind;
  label: string;
  blockHead?: string;
  blockText?: string;
}

export function evaluateBuyState(params: {
  template: GameTemplate;
  team: Team;
  card: CardItem;
  stockLeft: number;
  soldToTeam?: string;
  isOpen: boolean;
  dailyLimit: number | null;
  isCaptain: boolean;
}): BuyStateResult {
  const { template, team, card, stockLeft, soldToTeam, isOpen, dailyLimit, isCaptain } = params;
  const slotLabel = template.slots.find((s) => s.id === card.slotId)?.label ?? card.slotId;

  if (!isOpen) {
    return {
      ok: false,
      kind: "closed",
      label: "Рынок закрыт",
      blockHead: "Окно покупок закрыто",
      blockText: "Дождитесь открытия фазы рынка ведущим смены.",
    };
  }

  if (team.equippedCards[card.slotId] === card.id) {
    return {
      ok: false,
      kind: "equipped",
      label: "Уже установлено",
    };
  }

  if (stockLeft <= 0) {
    return {
      ok: false,
      kind: "soldOut",
      label: "Разобрали",
      blockHead: "Деталь забрали раньше вас",
      blockText: `Последнюю взяла команда «${soldToTeam ?? "соперников"}». Загляните на биржу команд или подберите другой вариант для слота «${slotLabel}».`,
    };
  }

  if (dailyLimit !== null && team.purchasesToday >= dailyLimit) {
    return {
      ok: false,
      kind: "limit",
      label: "Лимит исчерпан",
      blockHead: `Взято ${dailyLimit} из ${dailyLimit} за раунд`,
      blockText: "Новые покупки из общего магазина откроются в следующем раунде.",
    };
  }

  if (team.currency < card.price) {
    const diff = card.price - team.currency;
    return {
      ok: false,
      kind: "funds",
      label: `Не хватает ${diff} ${template.currencyName}`,
      blockHead: `Не хватает ${diff} ${template.currencyName}`,
      blockText: "Следующее начисление придёт после оценки работы команды.",
    };
  }

  if (!isCaptain) {
    if (template.features?.teamProposals === false) {
      return {
        ok: false,
        kind: "propose",
        label: "Покупает капитан",
        blockHead: "Покупки оформляет капитан",
        blockText: "Обсудите выбор в команде и попросите капитана взять эту деталь.",
      };
    }
    return {
      ok: true,
      kind: "propose",
      label: "Предложить капитану",
      blockHead: team.captainUsername ? `Покупает капитан ${team.captainUsername}` : "Покупает капитан",
      blockText: "Капитан увидит деталь с прогнозом шага и сможет взять её в одно касание.",
    };
  }

  return {
    ok: true,
    kind: "buy",
    label: `Взять за ${card.price} ${template.currencyName}`,
  };
}

export interface P2PPriceCheck {
  ok: boolean;
  minPrice: number;
  maxPrice: number;
  fee: number;
  sellerReceives: number;
  reason?: string;
}

export function validateP2PPrice(
  card: CardItem,
  price: number,
  features: FeatureFlags,
  currencyName: string,
): P2PPriceCheck {
  const base = Math.max(1, card.price);
  const minPrice = Math.max(1, Math.floor(base * features.p2pMinPriceRatio));
  const maxPrice = Math.max(minPrice, Math.ceil(base * features.p2pMaxPriceRatio));

  if (!Number.isInteger(price) || price < minPrice || price > maxPrice) {
    return {
      ok: false,
      minPrice,
      maxPrice,
      fee: 0,
      sellerReceives: 0,
      reason: `Допустимая цена на бирже: от ${minPrice} до ${maxPrice} ${currencyName}`,
    };
  }

  const fee = Math.floor((price * features.p2pFeePercent) / 100);
  const sellerReceives = Math.max(1, price - fee);

  return { ok: true, minPrice, maxPrice, fee, sellerReceives };
}

export interface AuctionBidEvaluation {
  ok: boolean;
  minBid: number;
  nextEndsAtMs: number;
  extended: boolean;
  refundTeamId: string | null;
  refundAmount: number;
  reason?: string;
}

export function evaluateAuctionBid(params: {
  auction: Pick<AuctionLot, "status" | "startingPrice" | "currentBid" | "leaderTeamId" | "endsAt">;
  bidderTeam: Pick<Team, "id" | "currency">;
  amount: number;
  nowMs: number;
  currencyName: string;
}): AuctionBidEvaluation {
  const { auction, bidderTeam, amount, nowMs, currencyName } = params;
  const endsAtMs = Date.parse(auction.endsAt);
  const minBid = auction.currentBid > 0 ? auction.currentBid + 1 : auction.startingPrice;

  if (auction.status !== "open" || Number.isNaN(endsAtMs) || nowMs >= endsAtMs) {
    return {
      ok: false,
      minBid,
      nextEndsAtMs: endsAtMs,
      extended: false,
      refundTeamId: null,
      refundAmount: 0,
      reason: "Торги по этому узлу уже завершены",
    };
  }

  if (auction.leaderTeamId === bidderTeam.id) {
    return {
      ok: false,
      minBid,
      nextEndsAtMs: endsAtMs,
      extended: false,
      refundTeamId: null,
      refundAmount: 0,
      reason: "Ваша команда уже удерживает лучшую ставку",
    };
  }

  if (!Number.isInteger(amount) || amount < minBid) {
    return {
      ok: false,
      minBid,
      nextEndsAtMs: endsAtMs,
      extended: false,
      refundTeamId: null,
      refundAmount: 0,
      reason: `Минимальная ставка сейчас — ${minBid} ${currencyName}`,
    };
  }

  if (bidderTeam.currency < amount) {
    return {
      ok: false,
      minBid,
      nextEndsAtMs: endsAtMs,
      extended: false,
      refundTeamId: null,
      refundAmount: 0,
      reason: `Не хватает ${amount - bidderTeam.currency} ${currencyName} на балансе команды`,
    };
  }

  const remainingMs = endsAtMs - nowMs;
  const extended = remainingMs < AUCTION_ANTI_SNIPE_WINDOW_MS;
  const nextEndsAtMs = extended ? nowMs + AUCTION_ANTI_SNIPE_EXTEND_MS : endsAtMs;

  return {
    ok: true,
    minBid,
    nextEndsAtMs,
    extended,
    refundTeamId: auction.leaderTeamId,
    refundAmount: auction.leaderTeamId ? auction.currentBid : 0,
  };
}

export interface BoardTurnOutcome {
  stepMove: number;
  cellEventTriggered: boolean;
  cellLabel: string | null;
  passed: boolean;
  shielded: boolean;
  buyoffUsed: boolean;
  canBuyoff: boolean;
  currencyDelta: number;
  eventTrackDelta: number;
  nextTrackPosition: number;
  nextCurrency: number;
  summary: string;
}

export function resolveBoardTurn(params: {
  team: Team;
  template: GameTemplate;
  leaderTrackPosition?: number;
  cellOverride?: BoardCell;
  useBuyoff?: boolean;
}): BoardTurnOutcome {
  const { team, template, leaderTrackPosition, cellOverride, useBuyoff = false } = params;
  const computed = calculateTeamStats(team, template, leaderTrackPosition);
  const stepMove = computed.step.total;
  const landedPos = Math.min(template.trackMax, Math.max(1, team.trackPosition + stepMove));

  let currencyDelta = computed.economyBonus;
  let eventTrackDelta = 0;
  let canBuyoff = false;

  const dayEventsEnabled = template.features?.dayEvents !== false;
  const allowBuyoff = template.features?.allowBuyoff !== false;
  const targetCell =
    cellOverride ??
    (dayEventsEnabled ? template.boardCells.find((c) => c.position === landedPos) : undefined);

  if (!targetCell || targetCell.type === "start" || targetCell.type === "apex") {
    const finalTrack = Math.min(template.trackMax, Math.max(1, landedPos));
    return {
      stepMove,
      cellEventTriggered: false,
      cellLabel: targetCell?.label ?? null,
      passed: true,
      shielded: false,
      buyoffUsed: false,
      canBuyoff: false,
      currencyDelta,
      eventTrackDelta: 0,
      nextTrackPosition: finalTrack,
      nextCurrency: Math.max(0, team.currency + currencyDelta),
      summary: `Ход +${stepMove}: клетка ${team.trackPosition} → ${finalTrack}`,
    };
  }

  if (targetCell.type === "resource") {
    const gain = targetCell.rewardCurrency || 2;
    currencyDelta += gain;
    return {
      stepMove,
      cellEventTriggered: true,
      cellLabel: targetCell.label,
      passed: true,
      shielded: false,
      buyoffUsed: false,
      canBuyoff: false,
      currencyDelta,
      eventTrackDelta: targetCell.rewardTrack,
      nextTrackPosition: Math.min(template.trackMax, Math.max(1, landedPos + targetCell.rewardTrack)),
      nextCurrency: Math.max(0, team.currency + currencyDelta),
      summary: `${targetCell.label}: находка принесла +${gain} ${template.currencyName}`,
    };
  }

  const statId = targetCell.statId ?? template.extraModule?.statId ?? template.stats[0]?.id;
  const minRequired = targetCell.minStat ?? template.extraModule?.min ?? 3;
  const currentStat = statId ? (computed.total[statId] ?? 0) : 0;
  const statLabel = template.stats.find((s) => s.id === statId)?.label ?? "Характеристика";
  const buyoffCost = targetCell.buyoffCost ?? template.extraModule?.buyoffCost ?? 2;

  if (currentStat >= minRequired) {
    const band = targetCell.rewardBands?.filter(([min]) => currentStat >= min).sort((a, b) => b[0] - a[0])[0];
    const bonusTrack = band?.[1] ?? (targetCell.rewardTrack || (targetCell.type === "challenge" ? 1 : 0));
    const bonusCurrency = band?.[2] ?? targetCell.rewardCurrency;
    eventTrackDelta += bonusTrack;
    currencyDelta += bonusCurrency;
    const finalTrack = Math.min(template.trackMax, Math.max(1, landedPos + eventTrackDelta));
    return {
      stepMove,
      cellEventTriggered: true,
      cellLabel: targetCell.label,
      passed: true,
      shielded: false,
      buyoffUsed: false,
      canBuyoff: false,
      currencyDelta,
      eventTrackDelta,
      nextTrackPosition: finalTrack,
      nextCurrency: Math.max(0, team.currency + currencyDelta),
      summary: `${targetCell.label}: проверка «${statLabel}» пройдена (${currentStat} ≥ ${minRequired})${bonusTrack > 0 ? `, +${bonusTrack} к треку` : ""}`,
    };
  }

  if (computed.hasEventShield) {
    return {
      stepMove,
      cellEventTriggered: true,
      cellLabel: targetCell.label,
      passed: true,
      shielded: true,
      buyoffUsed: false,
      canBuyoff: false,
      currencyDelta,
      eventTrackDelta: 0,
      nextTrackPosition: landedPos,
      nextCurrency: Math.max(0, team.currency + currencyDelta),
      summary: `${targetCell.label}: защитный модуль спас сборку от потери темпа`,
    };
  }

  canBuyoff = allowBuyoff && buyoffCost > 0 && team.currency + currencyDelta >= buyoffCost;
  if (useBuyoff && canBuyoff) {
    currencyDelta -= buyoffCost;
    return {
      stepMove,
      cellEventTriggered: true,
      cellLabel: targetCell.label,
      passed: false,
      shielded: false,
      buyoffUsed: true,
      canBuyoff: true,
      currencyDelta,
      eventTrackDelta: 0,
      nextTrackPosition: landedPos,
      nextCurrency: Math.max(0, team.currency + currencyDelta),
      summary: `${targetCell.label}: откуп ${buyoffCost} ${template.currencyName} удержал позицию`,
    };
  }

  const penaltyTrack = targetCell.penaltyTrack !== 0 ? targetCell.penaltyTrack : -1;
  const penaltyCurrency = targetCell.penaltyCurrency;
  eventTrackDelta += penaltyTrack;
  currencyDelta += penaltyCurrency;
  const finalTrack = Math.min(template.trackMax, Math.max(1, landedPos + eventTrackDelta));

  return {
    stepMove,
    cellEventTriggered: true,
    cellLabel: targetCell.label,
    passed: false,
    shielded: false,
    buyoffUsed: false,
    canBuyoff,
    currencyDelta,
    eventTrackDelta,
    nextTrackPosition: finalTrack,
    nextCurrency: Math.max(0, team.currency + currencyDelta),
    summary: `${targetCell.label}: не хватило «${statLabel}» (${currentStat} < ${minRequired}), откат ${penaltyTrack}`,
  };
}

export interface BalanceIssue {
  severity: "warning" | "error";
  code: string;
  message: string;
  cardId?: string;
}

export interface BalanceReport {
  templateId: string;
  isBalanced: boolean;
  score: number;
  metrics: {
    totalCards: number;
    avgEfficiencyByDay: Record<number, number>;
    slotCoverage: Record<string, number>;
    rarityCounts: Record<"common" | "rare" | "legendary", number>;
  };
  issues: BalanceIssue[];
}

export function validateGameBalance(template: GameTemplate): BalanceReport {
  const issues: BalanceIssue[] = [];
  const slotCoverage: Record<string, number> = {};
  const dayOneSlotCoverage: Record<string, number> = {};
  const rarityCounts: Record<"common" | "rare" | "legendary", number> = {
    common: 0,
    rare: 0,
    legendary: 0,
  };

  for (const slot of template.slots) {
    slotCoverage[slot.id] = 0;
    dayOneSlotCoverage[slot.id] = 0;
  }

  const efficiencyByDay: Record<number, number[]> = {};

  template.cards.forEach((card, index) => {
    const rarity = card.rarity ?? "common";
    rarityCounts[rarity] = (rarityCounts[rarity] ?? 0) + 1;
    slotCoverage[card.slotId] = (slotCoverage[card.slotId] ?? 0) + 1;
    if (card.dayAvailable === 1) {
      dayOneSlotCoverage[card.slotId] = (dayOneSlotCoverage[card.slotId] ?? 0) + 1;
    }

    const values = Object.values(card.stats);
    const positiveSum = values.reduce((acc, v) => acc + Math.max(0, v), 0) + card.trackBonus * 2;
    const negativeSum = values.reduce((acc, v) => acc + Math.abs(Math.min(0, v)), 0);
    const netStatSum = values.reduce((acc, v) => acc + v, 0) + card.trackBonus * 2;
    const efficiency = card.price > 0 ? Number((positiveSum / card.price).toFixed(2)) : positiveSum;

    const dayList = efficiencyByDay[card.dayAvailable] ?? [];
    dayList.push(efficiency);
    efficiencyByDay[card.dayAvailable] = dayList;

    if (efficiency > 2.2) {
      issues.push({
        severity: "warning",
        code: "OVERPOWERED_CARD",
        cardId: card.id,
        message: `Деталь «${card.name}» слишком выгодна для своей цены (${card.price} ${template.currencyName}).`,
      });
    }

    if (netStatSum < 0 && !card.effectScope) {
      issues.push({
        severity: "warning",
        code: "NEGATIVE_NET_CARD",
        cardId: card.id,
        message: `У детали «${card.name}» штрафы перевешивают плюсы без особого свойства.`,
      });
    }

    if (rarity === "rare" && positiveSum >= 4 && negativeSum === 0) {
      issues.push({
        severity: "warning",
        code: "RARE_WITHOUT_TRADEOFF",
        cardId: card.id,
        message: `Редкая деталь «${card.name}» даёт сильный плюс без встречного минуса-компромисса.`,
      });
    }

    const dominator = template.cards.find(
      (other, otherIndex) =>
        otherIndex !== index &&
        other.slotId === card.slotId &&
        other.dayAvailable <= card.dayAvailable &&
        other.price <= card.price &&
        other.trackBonus >= card.trackBonus &&
        !card.effectScope &&
        template.stats.every(({ id }) => (other.stats[id] ?? 0) >= (card.stats[id] ?? 0)) &&
        (other.price < card.price ||
          other.trackBonus > card.trackBonus ||
          template.stats.some(({ id }) => (other.stats[id] ?? 0) > (card.stats[id] ?? 0))),
    );

    if (dominator) {
      issues.push({
        severity: "warning",
        code: "DOMINATED_CARD",
        cardId: card.id,
        message: `Деталь «${card.name}» полностью проигрывает варианту «${dominator.name}» в том же слоте.`,
      });
    }
  });

  for (const slot of template.slots) {
    const count = slotCoverage[slot.id] ?? 0;
    if (count < 2) {
      issues.push({
        severity: "error",
        code: "LOW_SLOT_COVERAGE",
        message: `В слоте «${slot.label}» меньше двух вариантов деталей (${count}).`,
      });
    } else if ((dayOneSlotCoverage[slot.id] ?? 0) === 0) {
      issues.push({
        severity: "warning",
        code: "MISSING_DAY_ONE_SLOT",
        message: `В слоте «${slot.label}» нет стартовой детали для Дня 1.`,
      });
    }
  }

  const avgEfficiencyByDay: Record<number, number> = {};
  for (let day = 1; day <= template.totalDays; day++) {
    const values = efficiencyByDay[day] ?? [];
    if (values.length === 0) {
      issues.push({
        severity: "warning",
        code: "EMPTY_DAY_POOL",
        message: `В День ${day} на рынке не открывается ни одной новой детали.`,
      });
      avgEfficiencyByDay[day] = 0;
    } else {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      avgEfficiencyByDay[day] = Number(avg.toFixed(2));
    }
  }

  const penalty = issues.reduce((acc, item) => acc + (item.severity === "error" ? 18 : 6), 0);
  const score = Math.max(0, 100 - penalty);

  return {
    templateId: template.id,
    isBalanced: !issues.some((i) => i.severity === "error"),
    score,
    metrics: {
      totalCards: template.cards.length,
      avgEfficiencyByDay,
      slotCoverage,
      rarityCounts,
    },
    issues,
  };
}
