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

function buildInitialStock(template: GameTemplate): {
  cardStockLeft: Record<string, number>;
  cardSoldTo: Record<string, string>;
} {
  const cardStockLeft: Record<string, number> = {};
  const cardSoldTo: Record<string, string> = {};
  for (const card of template.cards) {
    if (card.id === "rat-back") {
      cardStockLeft[card.id] = 0;
      cardSoldTo[card.id] = "Тайга-04";
    } else {
      cardStockLeft[card.id] = card.stock;
    }
  }
  return { cardStockLeft, cardSoldTo };
}

class MemoryStore {
  templates: Map<string, GameTemplate> = new Map(DEFAULT_TEMPLATES.map((t) => [t.id, t]));

  gameState: GameState = {
    activeTemplateId: NEUROFAUNA_TEMPLATE.id,
    currentDay: 3,
    currentPoint: 3,
    purchasePhaseActive: true,
    dailyPurchaseLimit: NEUROFAUNA_TEMPLATE.dailyPurchaseLimit,
    secondsLeft: 522,
    rulesVersion: 4,
    rulesUpdatedNote: "Версия 4 · 15:58 · рынок продлён до 16:15",
    ...buildInitialStock(NEUROFAUNA_TEMPLATE),
  };

  lastPurchaseByTeam: Map<string, PurchaseUndoSnapshot> = new Map();
  proposals: ProposalMessage[] = [];

  teams: Map<string, Team> = new Map([
    [
      "team-alpha",
      {
        id: "team-alpha",
        name: "Химера-01",
        monogram: "Х1",
        joinCode: "HX01",
        captainUsername: "egor",
        members: ["Е", "О", "М", "Д"],
        currency: 12,
        trackPosition: 11,
        boardPosition: 3,
        purchasesToday: 0,
        equippedCards: {
          head: "lion-head",
          body: "shark-body",
          front: "scorpion-claws",
          back: null,
          tail: "crocodile-tail",
          special: "wasp-sting",
        },
        activePerkId: "massive",
        statModifiers: {},
      },
    ],
    [
      "team-beta",
      {
        id: "team-beta",
        name: "Тайга-04",
        monogram: "Т4",
        joinCode: "TG04",
        captainUsername: "renat",
        members: ["Р", "А", "К", "В"],
        currency: 9,
        trackPosition: 15,
        boardPosition: 4,
        purchasesToday: 1,
        equippedCards: {
          head: "mammoth-tusks",
          body: "lion-body",
          front: null,
          back: "rat-back",
          tail: null,
          special: "turtle-shell",
        },
        activePerkId: "lightning",
        statModifiers: {},
      },
    ],
    [
      "team-gamma",
      {
        id: "team-gamma",
        name: "Альфа-07",
        monogram: "А7",
        joinCode: "AL07",
        captainUsername: "leon",
        members: ["Л", "Д", "С"],
        currency: 10,
        trackPosition: 13,
        boardPosition: 2,
        purchasesToday: 1,
        equippedCards: {
          head: "lion-head",
          body: "lion-body",
          front: "eagle-claws",
          back: "lion-back",
          tail: null,
          special: null,
        },
        activePerkId: null,
        statModifiers: {},
      },
    ],
    [
      "team-delta",
      {
        id: "team-delta",
        name: "Кракен-02",
        monogram: "К2",
        joinCode: "KR02",
        captainUsername: "danya",
        members: ["Д", "В", "И"],
        currency: 8,
        trackPosition: 10,
        boardPosition: 5,
        purchasesToday: 0,
        equippedCards: {
          head: null,
          body: "shark-body",
          front: "chameleon-front",
          back: null,
          tail: "cheetah-tail",
          special: "turtle-shell",
        },
        activePerkId: null,
        statModifiers: {},
      },
    ],
  ]);

  getActiveTemplate(): GameTemplate {
    return this.templates.get(this.gameState.activeTemplateId) ?? NEUROFAUNA_TEMPLATE;
  }

  switchTemplate(templateId: string): GameTemplate {
    const next = this.templates.get(templateId);
    if (!next) {
      throw new DomainError(`Шаблон ${templateId} не найден`, 404);
    }
    this.gameState = {
      activeTemplateId: next.id,
      currentDay: Math.min(3, next.totalDays),
      currentPoint: Math.min(2, next.totalPoints),
      purchasePhaseActive: true,
      dailyPurchaseLimit: next.dailyPurchaseLimit,
      secondsLeft: Math.min(900, next.phaseDurationSeconds),
      rulesVersion: this.gameState.rulesVersion + 1,
      rulesUpdatedNote: `Версия ${this.gameState.rulesVersion + 1} · сеттинг «${next.title}» активирован`,
      ...buildInitialStock(next),
    };
    this.lastPurchaseByTeam.clear();
    this.proposals = [];

    const emptySlots = Object.fromEntries(next.slots.map((s) => [s.id, null]));
    const firstCards = next.cards.slice(0, 4);
    let idx = 0;
    for (const [id, team] of this.teams.entries()) {
      const sampleEquipped: Record<string, string | null> = { ...emptySlots };
      if (idx === 0) {
        for (const c of firstCards) {
          if (sampleEquipped[c.slotId] === null) sampleEquipped[c.slotId] = c.id;
        }
      }
      this.teams.set(id, {
        ...team,
        trackPosition: Math.min(team.trackPosition, next.trackMax - 2),
        purchasesToday: 0,
        equippedCards: sampleEquipped,
        activePerkId: next.perks[0]?.id ?? null,
        statModifiers: {},
      });
      idx++;
    }
    return next;
  }
}

export const store = new MemoryStore();
