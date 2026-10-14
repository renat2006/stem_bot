import type { GameState, GameTemplate, StatDefinition } from "@stem/shared";

export type HelpKey = "build" | "step" | "extra" | "market" | "earn";

export interface RulesRow {
  label: string;
  value: string;
  stat?: StatDefinition;
}

export interface RulesSection {
  key: HelpKey;
  title: string;
  module: string;
  rows: RulesRow[];
}

export function buildRulesSections(
  template: GameTemplate,
  gameState: GameState,
  limit: number | null,
): RulesSection[] {
  const extra = template.extraModule;
  const extraStat = extra ? template.stats.find((s) => s.id === extra.statId) : undefined;
  return [
    {
      key: "step",
      title: "Шаг за ход",
      module: "ГОНКА ПО ТРЕКУ",
      rows: [
        { label: "Каждый ход (база)", value: "+1" },
        ...template.stepThresholds.map((th) => {
          const stat = template.stats.find((s) => s.id === th.statId);
          return { label: `${stat?.label ?? th.statId} от ${th.min}`, value: `+${th.bonus}`, stat };
        }),
        ...template.perks
          .filter((p) => p.stepBonus > 0)
          .map((p) => ({ label: `${p.shortName ?? p.name}: ${p.effectText}`, value: `+${p.stepBonus}` })),
      ],
    },
    {
      key: "build",
      title: "Сборка",
      module: "СБОРКА ПО СЛОТАМ",
      rows: [
        { label: `${template.slots.length} слотов, одна карта на слот`, value: "" },
        { label: "Новая карта вытесняет старую, склада нет", value: "" },
        { label: "Сильные карты всегда с минусом", value: "" },
      ],
    },
    {
      key: "market",
      title: "Рынок",
      module: "ОБЩИЙ РЫНОК",
      rows: [
        { label: "Покупок за одну точку", value: limit === null ? "без лимита" : String(limit) },
        { label: "Рынок общий: последнюю карту забирает тот, кто купил первым", value: "" },
        { label: "Покупает капитан, участники предлагают карты", value: "" },
        { label: "Открыто дней прогрессии", value: `${gameState.currentDay}/${template.totalDays}` },
      ],
    },
    ...(extra
      ? [
          {
            key: "extra" as const,
            title: extra.tag,
            module: extra.moduleLabel,
            rows: [
              {
                label: `${extraStat?.label ?? extra.statId} от ${extra.min}`,
                value: extra.danger ? "без штрафа" : "заказ сдан",
                stat: extraStat,
              },
              ...extra.chips.map((c) => ({ label: c, value: "" })),
            ],
          },
        ]
      : []),
    {
      key: "earn",
      title: `Как получить ${template.currencyName}`,
      module: "НАЧИСЛЕНИЕ ЗА УЧЁБУ",
      rows: template.rewardReasons.map((r) => ({ label: r, value: "+2" })),
    },
  ];
}
