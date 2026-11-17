import { calculateTeamStats, validateGameBalance } from "./engine.js";
import type { AuctionLot, GameState, GameTemplate, P2PListing, Team } from "./schema.js";

export type QuickFixKind =
  | { type: "grant_all"; amount: number; reason: string }
  | { type: "discount_rarity"; rarity: "common" | "rare"; delta: number }
  | { type: "bump_card_price"; cardId: string; delta: number }
  | { type: "restock_slot"; slotId: string; amount: number }
  | { type: "enable_feature"; feature: "catchUpBonus" | "p2pMarket" | "auctions" }
  | { type: "tighten_p2p_corridor" };

export interface LiveAdvisorAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  explanation: string;
  suggestion: string;
  fixLabel?: string;
  fix?: QuickFixKind;
}

export interface LiveBalanceDashboard {
  healthScore: number;
  momentumLabel: "Высокая динамика" | "Стабильный темп" | "Нужна поддержка";
  summary: string;
  metrics: {
    avgCurrency: number;
    avgStep: number;
    leaderGap: number;
    activeBuyerRatio: number;
    openSupplyCount: number;
  };
  alerts: LiveAdvisorAlert[];
}

export function analyzeLiveBalance(params: {
  template: GameTemplate;
  gameState: GameState;
  teams: Team[];
  listings?: P2PListing[];
  auctions?: AuctionLot[];
}): LiveBalanceDashboard {
  const { template, gameState, teams, listings = [], auctions = [] } = params;
  const staticReport = validateGameBalance(template);
  const alerts: LiveAdvisorAlert[] = [];

  if (teams.length === 0) {
    return {
      healthScore: staticReport.score,
      momentumLabel: "Стабильный темп",
      summary: "Смена готова к старту: добавьте команды, чтобы отслеживать живую динамику.",
      metrics: {
        avgCurrency: 0,
        avgStep: 1,
        leaderGap: 0,
        activeBuyerRatio: 0,
        openSupplyCount: template.cards.length,
      },
      alerts: staticReport.issues.slice(0, 3).map((issue, idx) => ({
        id: `static-${idx}`,
        severity: issue.severity === "error" ? "critical" : "warning",
        title: "Замечание по колоде смены",
        explanation: issue.message,
        suggestion: "Откройте редактор карт и скорректируйте характеристики или цену.",
        ...(issue.cardId && issue.code === "OVERPOWERED_CARD"
          ? {
              fixLabel: `Поднять цену на +1 ${template.currencyIcon}`,
              fix: { type: "bump_card_price" as const, cardId: issue.cardId, delta: 1 },
            }
          : {}),
      })),
    };
  }

  const positions = [...teams].map((t) => t.trackPosition).sort((a, b) => b - a);
  const leaderPos = positions[0] ?? 1;
  const medianPos = positions[Math.floor(positions.length / 2)] ?? 1;
  const leaderGap = leaderPos - medianPos;

  const statsList = teams.map((t) => calculateTeamStats(t, template, leaderPos));
  const avgStep = Number((statsList.reduce((acc, s) => acc + s.step.total, 0) / teams.length).toFixed(1));
  const avgCurrency = Number((teams.reduce((acc, t) => acc + t.currency, 0) / teams.length).toFixed(1));
  const activeBuyerRatio = Number(
    (teams.filter((t) => t.purchasesToday > 0).length / teams.length).toFixed(2),
  );

  const availableCardsToday = template.cards.filter(
    (c) => c.dayAvailable <= gameState.currentDay && (gameState.cardStockLeft[c.id] ?? c.stock) > 0,
  );
  const openSupplyCount = availableCardsToday.reduce(
    (acc, c) => acc + (gameState.cardStockLeft[c.id] ?? c.stock),
    0,
  );

  if (leaderGap >= Math.max(6, Math.round(template.trackMax * 0.25))) {
    const leader = teams.find((t) => t.trackPosition === leaderPos);
    alerts.push({
      id: "runaway-leader",
      severity: "critical",
      title: `Сильный отрыв лидера (${leader?.name ?? "Топ-1"} впереди на +${leaderGap} кл.)`,
      explanation: "Остальным командам становится трудно догнать лидера за оставшиеся дни смены.",
      suggestion: template.features.catchUpBonus
        ? "Усильте следующее испытание трассы по профильной характеристике лидера."
        : "Включите догоняющий импульс (+1 к шагу для отстающих на 6+ клеток).",
      ...(!template.features.catchUpBonus
        ? {
            fixLabel: "Включить догоняющий импульс",
            fix: { type: "enable_feature", feature: "catchUpBonus" },
          }
        : {}),
    });
  }

  const cheapestOpenPrice = availableCardsToday.length
    ? Math.min(...availableCardsToday.map((c) => c.price))
    : 2;
  const poorTeams = teams.filter((t) => t.currency < cheapestOpenPrice).length;

  if (poorTeams >= Math.ceil(teams.length * 0.6) && activeBuyerRatio < 0.4) {
    alerts.push({
      id: "currency-famine",
      severity: "warning",
      title: `Покупки замедлились: у ${poorTeams} из ${teams.length} команд пустой баланс`,
      explanation: `Средний запас сейчас ${avgCurrency} ${template.currencyName}, а доступные детали стоят от ${cheapestOpenPrice} ${template.currencyName}.`,
      suggestion: "Выдайте поощрительный грант за промежуточный чекпоинт или снизьте цену обычных деталей.",
      fixLabel: `Выдать всем +2 ${template.currencyIcon}`,
      fix: { type: "grant_all", amount: 2, reason: "Промежуточный чекпоинт лаборатории" },
    });
  } else if (gameState.purchasePhaseActive && activeBuyerRatio < 0.25 && teams.length >= 2) {
    alerts.push({
      id: "low-momentum",
      severity: "info",
      title: "Команды осторожничают на открытом рынке",
      explanation: "Большинство капитанов ещё не сделали ни одной покупки в текущем окне.",
      suggestion: "Напомните о времени до закрытия рынка или разыграйте редкий узел на аукционе.",
    });
  }

  for (const slot of template.slots) {
    const inShop = availableCardsToday.filter((c) => c.slotId === slot.id).length;
    const inP2P = listings.filter((l) => {
      const c = template.cards.find((item) => item.id === l.cardId);
      return c?.slotId === slot.id;
    }).length;
    if (inShop === 0 && inP2P === 0) {
      alerts.push({
        id: `slot-empty-${slot.id}`,
        severity: "warning",
        title: `Разобрали все детали в категории «${slot.label}»`,
        explanation:
          "Ни в общем магазине, ни на бирже команд не осталось доступных вариантов для этого узла.",
        suggestion: `Пополните запас базовых деталей категории «${slot.label}», чтобы отстающие могли собрать комплект.`,
        fixLabel: `Досыпать +2 в «${slot.label}»`,
        fix: { type: "restock_slot", slotId: slot.id, amount: 2 },
      });
    }
  }

  const avgCardPrice = availableCardsToday.length
    ? availableCardsToday.reduce((sum, c) => sum + c.price, 0) / availableCardsToday.length
    : 3;
  if (avgCurrency >= Math.max(7, avgCardPrice * 2.6)) {
    const hasOpenAuction = auctions.some((a) => a.status === "open");
    alerts.push({
      id: "currency-hoarding",
      severity: "warning",
      title: "В экономике накопился избыток валюты",
      explanation: `На руках у команд в среднем по ${avgCurrency} ${template.currencyName} — обычные цены перестают создавать выбор.`,
      suggestion: hasOpenAuction
        ? "Поднимите стоимость редких узлов на +1 или включите платные откупы на испытании дня."
        : "Запустите живой аукцион за легендарный узел дня, чтобы связать лишнюю валюту.",
      fixLabel: "Поднять цену редких деталей на +1",
      fix: { type: "discount_rarity", rarity: "rare", delta: 1 },
    });
  }

  const highRarityOpen = availableCardsToday.filter((c) => c.rarity === "rare" || c.rarity === "legendary");
  if (
    gameState.currentDay <= 2 &&
    availableCardsToday.length > 0 &&
    highRarityOpen.length / availableCardsToday.length > 0.55
  ) {
    const topCard = highRarityOpen[0];
    alerts.push({
      id: "market-power-spike",
      severity: "warning",
      title: "На старте смены открыто слишком много мощных деталей",
      explanation: `${highRarityOpen.length} из ${availableCardsToday.length} доступных узлов сейчас редкие или легендарные — базовые детали теряют смысл.`,
      suggestion: "Сдвиньте часть редких узлов на более поздние дни или слегка поднимите им цену.",
      ...(topCard
        ? {
            fixLabel: `Удорожить «${topCard.name}» на +1`,
            fix: { type: "bump_card_price", cardId: topCard.id, delta: 1 },
          }
        : {}),
    });
  }

  const cheapListings = listings.filter((l) => {
    const card = template.cards.find((c) => c.id === l.cardId);
    return card && l.price <= Math.max(1, Math.floor(card.price * 0.55));
  });
  if (cheapListings.length >= 2 && template.features.p2pFeePercent === 0) {
    alerts.push({
      id: "p2p-dumping",
      severity: "info",
      title: "Демпинг на бирже между командами",
      explanation: "Несколько узлов выставлены почти за полцены — возможен договорной перелив деталей.",
      suggestion: "Сузьте ценовой коридор биржи до 0.75x–2.0x и включите комиссию 10%.",
      fixLabel: "Ужесточить правила биржи",
      fix: { type: "tighten_p2p_corridor" },
    });
  }

  for (const issue of staticReport.issues.slice(0, 2)) {
    if (alerts.length >= 6) break;
    alerts.push({
      id: `deck-${issue.code}-${issue.cardId ?? "all"}`,
      severity: issue.severity === "error" ? "critical" : "info",
      title: "Совет по балансу карточек",
      explanation: issue.message,
      suggestion: "Проверьте эту позицию во вкладке «Карты и Редкости».",
      ...(issue.cardId && issue.code === "OVERPOWERED_CARD"
        ? {
            fixLabel: "Поднять цену на +1",
            fix: { type: "bump_card_price", cardId: issue.cardId, delta: 1 },
          }
        : {}),
    });
  }

  const penalty = alerts.reduce(
    (sum, a) => sum + (a.severity === "critical" ? 22 : a.severity === "warning" ? 10 : 3),
    0,
  );
  const healthScore = Math.max(10, Math.min(100, Math.round((staticReport.score + (100 - penalty)) / 2)));

  const momentumLabel =
    alerts.some((a) => a.severity === "critical") || poorTeams >= Math.ceil(teams.length * 0.6)
      ? "Нужна поддержка"
      : avgStep >= 2.5 || activeBuyerRatio >= 0.5
        ? "Высокая динамика"
        : "Стабильный темп";

  const summary =
    alerts.length === 0
      ? `Экономика смены в норме: средний шаг команд ${avgStep}, доступно ${openSupplyCount} деталей в магазине.`
      : (alerts[0]?.title ?? "Есть рекомендации по тонкой настройке баланса.");

  return {
    healthScore,
    momentumLabel,
    summary,
    metrics: {
      avgCurrency,
      avgStep,
      leaderGap,
      activeBuyerRatio,
      openSupplyCount,
    },
    alerts,
  };
}
