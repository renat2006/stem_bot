import type { Team } from "@stem/shared";
import { DomainError } from "../../shared/errors.js";
import { store } from "../../shared/store.js";
import { withComputedStats } from "../game/service.js";

export function requireTeam(teamId: string): Team {
  const team = store.teams.get(teamId);
  if (!team) throw new DomainError("Команда не найдена", 404);
  return team;
}

function requireOpenShop() {
  if (!store.gameState.purchasePhaseActive) {
    throw new DomainError("Фаза покупок сейчас закрыта администратором");
  }
}

export function buyCard(teamId: string, cardId: string) {
  const template = store.getActiveTemplate();
  const team = requireTeam(teamId);
  requireOpenShop();

  const limit = store.gameState.dailyPurchaseLimit;
  if (limit !== null && team.purchasesToday >= limit) {
    throw new DomainError(`Достигнут дневной лимит покупок (${limit})`);
  }

  const card = template.cards.find((item) => item.id === cardId);
  if (!card) throw new DomainError("Карта не найдена", 404);
  if (card.dayAvailable > store.gameState.currentDay) {
    throw new DomainError(`Карта откроется в День ${card.dayAvailable}`);
  }
  if (team.currency < card.price) {
    throw new DomainError(`Недостаточно валюты (${template.currencyName})`);
  }

  const updated: Team = {
    ...team,
    currency: team.currency - card.price,
    purchasesToday: team.purchasesToday + 1,
    equippedCards: { ...team.equippedCards, [card.slotId]: card.id },
  };
  store.teams.set(updated.id, updated);
  return withComputedStats(updated, template);
}

export function buyPerk(teamId: string, perkId: string) {
  const template = store.getActiveTemplate();
  const team = requireTeam(teamId);
  requireOpenShop();

  const perk = template.perks.find((p) => p.id === perkId);
  if (!perk) throw new DomainError("Свойство не найдено", 404);
  if (team.currency < perk.price) {
    throw new DomainError(`Недостаточно валюты (${template.currencyName})`);
  }

  const updated: Team = { ...team, currency: team.currency - perk.price, activePerkId: perk.id };
  store.teams.set(updated.id, updated);
  return withComputedStats(updated, template);
}
