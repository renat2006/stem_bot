import type { CardItem, GameTemplate, Team } from "./schema.js";

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
  step: TeamStepBreakdown;
}

export function calculateTeamStep(
  totals: Record<string, number>,
  equippedCards: Record<string, string | null>,
  activePerkId: string | null,
  template: GameTemplate,
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
  for (const cardId of Object.values(equippedCards)) {
    if (!cardId) continue;
    const card = cardMap.get(cardId);
    if (card?.trackBonus) cardTrackBonus += card.trackBonus;
  }
  if (cardTrackBonus > 0) {
    parts.push({
      key: "cards-bonus",
      value: cardTrackBonus,
      met: true,
      label: "детали",
    });
  }

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

  const total = parts.filter((p) => p.met).reduce((sum, p) => sum + p.value, 0);
  return { total, parts };
}

export function calculateTeamStats(team: Team, template: GameTemplate): TeamComputedStats {
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
  for (const cardId of Object.values(team.equippedCards)) {
    if (!cardId) continue;
    const card = cardMap.get(cardId);
    if (!card) continue;
    for (const [statId, value] of Object.entries(card.stats)) {
      byPart[statId] = (byPart[statId] ?? 0) + value;
    }
  }

  const activePerk = template.perks.find((p) => p.id === team.activePerkId);
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

  const step = calculateTeamStep(total, team.equippedCards, team.activePerkId, template);

  return { byPart, byPerk, byModifier, total, perkConditionMet, step };
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
      blockHead: "Фаза покупок закрыта",
      blockText: "Дождитесь открытия окна рынка ведущим смены.",
    };
  }

  if (team.equippedCards[card.slotId] === card.id) {
    return {
      ok: false,
      kind: "equipped",
      label: "Уже в сборке",
    };
  }

  if (stockLeft <= 0) {
    return {
      ok: false,
      kind: "soldOut",
      label: "Раскупили",
      blockHead: "Карту купили раньше вас",
      blockText: `Последнюю взяла «${soldToTeam ?? "другая команда"}». Завтра на рынке будут новые карты для слота «${slotLabel}».`,
    };
  }

  if (dailyLimit !== null && team.purchasesToday >= dailyLimit) {
    return {
      ok: false,
      kind: "limit",
      label: "Лимит покупок исчерпан",
      blockHead: `Куплено ${dailyLimit} из ${dailyLimit}`,
      blockText: "Следующие покупки — в следующей точке взаимодействия.",
    };
  }

  if (team.currency < card.price) {
    const diff = card.price - team.currency;
    return {
      ok: false,
      kind: "funds",
      label: `Не хватает ${diff} ${template.currencyName}`,
      blockHead: `Не хватает ${diff} ${template.currencyName}`,
      blockText:
        "Следующее начисление за учёбу — в конце блока. Карты дешевле найдутся по фильтру «По карману».",
    };
  }

  if (!isCaptain) {
    return {
      ok: true,
      kind: "propose",
      label: "Предложить капитану",
      blockHead: team.captainUsername
        ? `Покупает капитан ${team.captainUsername}`
        : "Покупает капитан команды",
      blockText: "Ему придёт карта с прогнозом шага, купить можно в одно касание.",
    };
  }

  return {
    ok: true,
    kind: "buy",
    label: `Купить за ${card.price} ${template.currencyName}`,
  };
}

export interface BalanceIssue {
  severity: "warning" | "error";
  code: string;
  message: string;
}

export interface BalanceReport {
  templateId: string;
  isBalanced: boolean;
  score: number;
  metrics: {
    totalCards: number;
    avgEfficiencyByDay: Record<number, number>;
    slotCoverage: Record<string, number>;
  };
  issues: BalanceIssue[];
}

export function validateGameBalance(template: GameTemplate): BalanceReport {
  const issues: BalanceIssue[] = [];
  const slotCoverage: Record<string, number> = {};

  for (const slot of template.slots) {
    slotCoverage[slot.id] = 0;
  }

  const efficiencyByDay: Record<number, number[]> = {};

  for (const card of template.cards) {
    slotCoverage[card.slotId] = (slotCoverage[card.slotId] ?? 0) + 1;
    const netStatSum = Object.values(card.stats).reduce((acc, v) => acc + v, 0) + card.trackBonus * 2;
    const efficiency = card.price > 0 ? Number((netStatSum / card.price).toFixed(2)) : netStatSum;

    const dayList = efficiencyByDay[card.dayAvailable] ?? [];
    dayList.push(efficiency);
    efficiencyByDay[card.dayAvailable] = dayList;

    if (efficiency > 2.0) {
      issues.push({
        severity: "warning",
        code: "OVERPOWERED_CARD",
        message: `Карта "${card.name}" (День ${card.dayAvailable}) имеет слишком высокую отдачу статов на единицу цены (${efficiency}).`,
      });
    }

    if (netStatSum < 0) {
      issues.push({
        severity: "warning",
        code: "NEGATIVE_NET_CARD",
        message: `Карта "${card.name}" даёт отрицательную сумму характеристик (${netStatSum}).`,
      });
    }
  }

  for (const slot of template.slots) {
    const count = slotCoverage[slot.id] ?? 0;
    if (count < 2) {
      issues.push({
        severity: "error",
        code: "LOW_SLOT_COVERAGE",
        message: `Слот "${slot.label}" содержит слишком мало вариантов карт (${count}).`,
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
        message: `На День ${day} не открывается ни одной новой карточки.`,
      });
      avgEfficiencyByDay[day] = 0;
    } else {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      avgEfficiencyByDay[day] = Number(avg.toFixed(2));
    }
  }

  const penalty = issues.reduce((acc, item) => acc + (item.severity === "error" ? 20 : 8), 0);
  const score = Math.max(0, 100 - penalty);

  return {
    templateId: template.id,
    isBalanced: !issues.some((i) => i.severity === "error"),
    score,
    metrics: {
      totalCards: template.cards.length,
      avgEfficiencyByDay,
      slotCoverage,
    },
    issues,
  };
}
