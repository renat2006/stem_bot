import type { GameState, GameTemplate, StatDefinition } from "@stem/shared";

export type HelpKey = "build" | "step" | "extra" | "market" | "p2p" | "auctions" | "rarity" | "earn";

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
  const { features } = template;

  const sections: RulesSection[] = [
    {
      key: "step",
      title: "Как считается шаг на маршруте",
      module: "ГОНКА",
      rows: [
        { label: "Базовый ход каждой команды", value: "+1" },
        ...template.stepThresholds.map((th) => {
          const stat = template.stats.find((s) => s.id === th.statId);
          return { label: `${stat?.label ?? th.statId} от ${th.min}`, value: `+${th.bonus}`, stat };
        }),
        ...(template.allStatsStepBonus
          ? [
              {
                label: `Все три характеристики от ${template.allStatsStepBonus.min}`,
                value: `+${template.allStatsStepBonus.bonus}`,
              },
            ]
          : []),
        ...(template.elitePartStepBonus > 0
          ? [{ label: "Элитная часть в сборке", value: `+${template.elitePartStepBonus}` }]
          : []),
        ...(features.catchUpBonus
          ? [{ label: "Рывок догоняющего (при отставании от лидера ≥ 6 кл.)", value: "+1" }]
          : []),
      ],
    },
    {
      key: "build",
      title: features.slotInventory ? "Ангар и склад команды" : "Сборка по слотам",
      module: "КОНСТРУКТОР",
      rows: [
        { label: `${template.slots.length} слотов: по одной активной детали в каждом`, value: "" },
        {
          label: features.slotInventory
            ? "Вытесненные детали уходят на склад — их можно вернуть в сборку бесплатно"
            : "Новая деталь заменяет старую в том же слоте",
          value: "",
        },
        { label: "Мощные модули дают сильный плюс, но требуют компенсировать минус", value: "" },
      ],
    },
    {
      key: "rarity",
      title: "Редкости и легендарные эффекты",
      module: "МОДУЛИ",
      rows: [
        { label: "Обычные — надёжная база без жёстких штрафов", value: "База" },
        {
          label: "Редкие — высокий прирост характеристик, но растёт и компромиссный минус",
          value: "Компромисс",
        },
        {
          label: "Легендарные — уникальное свойство (шаг, щит полигона, скидка −1 или рывок)",
          value: "Особый эффект",
        },
      ],
    },
    {
      key: "market",
      title: "Общий магазин деталей",
      module: "МАГАЗИН",
      rows: [
        { label: "Покупок за одно окно", value: limit === null ? "без лимита" : String(limit) },
        { label: "Запас ограничен: последнюю деталь забирает тот, кто успел первым", value: "" },
        { label: "Покупает капитан, участники отправляют предложения", value: "" },
        { label: "Текущий день смены", value: `${gameState.currentDay}/${template.totalDays}` },
      ],
    },
  ];

  if (features.p2pMarket) {
    sections.push({
      key: "p2p",
      title: "Биржа между командами",
      module: "БИРЖА",
      rows: [
        {
          label: "Капитан может выставить деталь со склада или из сборки за свою цену",
          value: "",
        },
        {
          label: "Честный коридор цены от номинала",
          value: `${Math.round(features.p2pMinPriceRatio * 100)}%–${Math.round(features.p2pMaxPriceRatio * 100)}%`,
        },
        ...(features.p2pFeePercent > 0
          ? [{ label: "Комиссия площадки с продажи", value: `${features.p2pFeePercent}%` }]
          : []),
      ],
    });
  }

  if (features.auctions) {
    sections.push({
      key: "auctions",
      title: "Живые аукционы",
      module: "ТОРГИ",
      rows: [
        { label: "Ведущий выставляет редкий лот на открытый торг по таймеру", value: "" },
        { label: "Сумма лучшей ставки временно резервируется; при перебитии сразу возвращается", value: "" },
        { label: "Ставка на последних 15 секундах продлевает торг до 20 секунд", value: "Анти-снайпер" },
      ],
    });
  }

  if (extra) {
    sections.push({
      key: "extra",
      title: extra.tag,
      module: extra.moduleLabel,
      rows: [
        {
          label: `${extraStat?.label ?? extra.statId} от ${extra.min}`,
          value: extra.danger ? "без штрафа" : "бонус выполнен",
          stat: extraStat,
        },
        ...extra.chips.map((c) => ({ label: c, value: "" })),
      ],
    });
  }

  sections.push({
    key: "earn",
    title: `За что начисляют ${template.currencyName}`,
    module: "УЧЕБНЫЙ БЛОК",
    rows: template.rewardReasons.map((r) => ({ label: r, value: "+2" })),
  });

  return sections;
}
