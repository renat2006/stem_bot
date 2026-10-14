import type { CardItem, GameTemplate, Team } from "./schema.js";

export interface TeamComputedStats {
  byPart: Record<string, number>;
  byPerk: Record<string, number>;
  byModifier: Record<string, number>;
  total: Record<string, number>;
  perkConditionMet: boolean;
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

  return { byPart, byPerk, byModifier, total, perkConditionMet };
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
