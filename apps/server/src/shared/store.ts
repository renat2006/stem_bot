import {
  DEFAULT_TEMPLATES,
  type GameState,
  type GameTemplate,
  NEUROFAUNA_TEMPLATE,
  type Team,
} from "@stem/shared";
import { DomainError } from "./errors.js";

export interface PurchaseUndoSnapshot {
  teamId: string;
  cardId: string;
  price: number;
  prevEquippedCardId: string | null;
  prevStockLeft: number;
  prevSoldTo?: string;
}

export interface ProposalMessage {
  id: string;
  teamId: string;
  cardId: string;
  cardName: string;
  price: number;
  memberName: string;
  stepBefore: number;
  stepAfter: number;
  createdAt: string;
}

function buildCleanStock(template: GameTemplate): {
  cardStockLeft: Record<string, number>;
  cardSoldTo: Record<string, string>;
} {
  const cardStockLeft: Record<string, number> = {};
  for (const card of template.cards) {
    cardStockLeft[card.id] = card.stock;
  }
  return { cardStockLeft, cardSoldTo: {} };
}

function createInitialTeams(template: GameTemplate): Map<string, Team> {
  const emptySlots = Object.fromEntries(template.slots.map((s) => [s.id, null]));
  const roster: Array<Pick<Team, "id" | "name" | "monogram" | "joinCode" | "captainUsername" | "members">> = [
    {
      id: "team-alpha",
      name: "Химера-01",
      monogram: "Х1",
      joinCode: "HX01",
      captainUsername: "egor",
      members: ["Е", "О", "М", "Д"],
    },
    {
      id: "team-beta",
      name: "Тайга-04",
      monogram: "Т4",
      joinCode: "TG04",
      captainUsername: "renat",
      members: ["Р", "А", "К", "В"],
    },
    {
      id: "team-gamma",
      name: "Альфа-07",
      monogram: "А7",
      joinCode: "AL07",
      captainUsername: "leon",
      members: ["Л", "Д", "С"],
    },
    {
      id: "team-delta",
      name: "Кракен-02",
      monogram: "К2",
      joinCode: "KR02",
      captainUsername: "danya",
      members: ["Д", "В", "И"],
    },
  ];

  return new Map(
    roster.map((item) => [
      item.id,
      {
        ...item,
        currency: 0,
        trackPosition: 1,
        boardPosition: 1,
        purchasesToday: 0,
        equippedCards: { ...emptySlots },
        activePerkId: null,
        statModifiers: {},
      },
    ]),
  );
}

class MemoryStore {
  templates: Map<string, GameTemplate> = new Map(DEFAULT_TEMPLATES.map((t) => [t.id, t]));

  gameState: GameState = {
    activeTemplateId: NEUROFAUNA_TEMPLATE.id,
    currentDay: 1,
    currentPoint: 1,
    currentPhase: "scoring",
    purchasePhaseActive: false,
    dailyPurchaseLimit: NEUROFAUNA_TEMPLATE.dailyPurchaseLimit,
    secondsLeft: NEUROFAUNA_TEMPLATE.phaseDurationSeconds,
    rulesVersion: 1,
    rulesUpdatedNote: "Версия 1 · День 1 · ожидание начисления за учебный блок",
    ...buildCleanStock(NEUROFAUNA_TEMPLATE),
  };

  lastPurchaseByTeam: Map<string, PurchaseUndoSnapshot> = new Map();
  proposals: ProposalMessage[] = [];
  teams: Map<string, Team> = createInitialTeams(NEUROFAUNA_TEMPLATE);

  getActiveTemplate(): GameTemplate {
    return this.templates.get(this.gameState.activeTemplateId) ?? NEUROFAUNA_TEMPLATE;
  }

  resetShift(): GameState {
    const template = this.getActiveTemplate();
    this.gameState = {
      activeTemplateId: template.id,
      currentDay: 1,
      currentPoint: 1,
      currentPhase: "scoring",
      purchasePhaseActive: false,
      dailyPurchaseLimit: template.dailyPurchaseLimit,
      secondsLeft: template.phaseDurationSeconds,
      rulesVersion: 1,
      rulesUpdatedNote: `Версия 1 · Старт смены «${template.title}»`,
      ...buildCleanStock(template),
    };
    this.lastPurchaseByTeam.clear();
    this.proposals = [];
    this.teams = createInitialTeams(template);
    return this.gameState;
  }

  loadDemoMidgame(): GameState {
    const template = this.getActiveTemplate();
    const stock = buildCleanStock(template);
    if (template.id === "neurofauna-classic") {
      stock.cardStockLeft["rat-back"] = 0;
      stock.cardSoldTo["rat-back"] = "Тайга-04";
    }

    this.gameState = {
      activeTemplateId: template.id,
      currentDay: Math.min(3, template.totalDays),
      currentPoint: Math.min(3, template.totalPoints),
      currentPhase: "market",
      purchasePhaseActive: true,
      dailyPurchaseLimit: template.dailyPurchaseLimit,
      secondsLeft: 522,
      rulesVersion: 4,
      rulesUpdatedNote: "Версия 4 · 15:58 · рынок открыт до 16:15",
      ...stock,
    };
    this.lastPurchaseByTeam.clear();
    this.proposals = [];

    const emptySlots = Object.fromEntries(template.slots.map((s) => [s.id, null]));
    const firstCards = template.cards.slice(0, 4);
    let idx = 0;
    for (const [id, team] of this.teams.entries()) {
      const equipped: Record<string, string | null> = { ...emptySlots };
      if (template.id === "neurofauna-classic" && idx === 0) {
        equipped.head = "lion-head";
        equipped.body = "shark-body";
        equipped.front = "scorpion-claws";
        equipped.tail = "crocodile-tail";
        equipped.special = "wasp-sting";
      } else {
        for (const c of firstCards.slice(0, idx === 0 ? 4 : 2)) {
          if (equipped[c.slotId] === null) equipped[c.slotId] = c.id;
        }
      }
      this.teams.set(id, {
        ...team,
        currency: idx === 0 ? 12 : 9,
        trackPosition: Math.min(template.trackMax, idx === 0 ? 11 : 15 - idx * 2),
        purchasesToday: idx === 1 ? 1 : 0,
        equippedCards: equipped,
        activePerkId: idx === 0 ? (template.perks[1]?.id ?? template.perks[0]?.id ?? null) : null,
        statModifiers: {},
      });
      idx++;
    }
    return this.gameState;
  }

  switchTemplate(templateId: string): GameTemplate {
    const next = this.templates.get(templateId);
    if (!next) {
      throw new DomainError(`Шаблон ${templateId} не найден`, 404);
    }
    this.gameState = {
      activeTemplateId: next.id,
      currentDay: 1,
      currentPoint: 1,
      currentPhase: "scoring",
      purchasePhaseActive: false,
      dailyPurchaseLimit: next.dailyPurchaseLimit,
      secondsLeft: next.phaseDurationSeconds,
      rulesVersion: 1,
      rulesUpdatedNote: `Версия 1 · Сеттинг «${next.title}» готов к старту`,
      ...buildCleanStock(next),
    };
    this.lastPurchaseByTeam.clear();
    this.proposals = [];
    this.teams = createInitialTeams(next);
    return next;
  }
}

export const store = new MemoryStore();
