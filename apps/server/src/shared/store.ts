import {
  DEFAULT_TEMPLATES,
  type GameState,
  type GameTemplate,
  NEUROFAUNA_TEMPLATE,
  type Team,
} from "@stem/shared";
import { DomainError } from "./errors.js";

class MemoryStore {
  templates: Map<string, GameTemplate> = new Map(DEFAULT_TEMPLATES.map((t) => [t.id, t]));

  gameState: GameState = {
    activeTemplateId: NEUROFAUNA_TEMPLATE.id,
    currentDay: 1,
    purchasePhaseActive: true,
    dailyPurchaseLimit: NEUROFAUNA_TEMPLATE.dailyPurchaseLimit,
  };

  teams: Map<string, Team> = new Map([
    [
      "team-alpha",
      {
        id: "team-alpha",
        name: "Химера-01",
        captainUsername: "egor_captain",
        currency: 12,
        trackPosition: 6,
        boardPosition: 3,
        purchasesToday: 1,
        equippedCards: {
          head: "lion-head",
          body: "lion-body",
          front: "chameleon-front",
          back: null,
          tail: "crocodile-tail",
          special: null,
        },
        activePerkId: "lightning",
        statModifiers: {},
      },
    ],
    [
      "team-beta",
      {
        id: "team-beta",
        name: "БиоПульс",
        captainUsername: "renat_lead",
        currency: 9,
        trackPosition: 8,
        boardPosition: 4,
        purchasesToday: 0,
        equippedCards: {
          head: "mammoth-tusks",
          body: "lion-body",
          front: null,
          back: "lion-back",
          tail: null,
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
      currentDay: 1,
      purchasePhaseActive: true,
      dailyPurchaseLimit: next.dailyPurchaseLimit,
    };

    const emptySlots = Object.fromEntries(next.slots.map((s) => [s.id, null]));
    for (const [id, team] of this.teams.entries()) {
      this.teams.set(id, {
        ...team,
        purchasesToday: 0,
        equippedCards: { ...emptySlots },
        activePerkId: null,
        statModifiers: {},
      });
    }
    return next;
  }
}

export const store = new MemoryStore();
