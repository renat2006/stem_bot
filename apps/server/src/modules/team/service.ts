import { previewCardEffect, type Team } from "@stem/shared";
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

  const stockLeft = store.gameState.cardStockLeft[card.id] ?? card.stock;
  if (stockLeft <= 0) {
    const soldTo = store.gameState.cardSoldTo[card.id] ?? "другая команда";
    throw new DomainError(`Карту уже раскупили (последнюю взяла «${soldTo}»)`);
  }

  if (team.currency < card.price) {
    throw new DomainError(`Недостаточно валюты (${template.currencyName})`);
  }

  const prevEquippedCardId = team.equippedCards[card.slotId] ?? null;
  store.lastPurchaseByTeam.set(team.id, {
    teamId: team.id,
    cardId: card.id,
    price: card.price,
    prevEquippedCardId,
    prevStockLeft: stockLeft,
    prevSoldTo: store.gameState.cardSoldTo[card.id],
  });

  const nextStock = stockLeft - 1;
  store.gameState.cardStockLeft[card.id] = nextStock;
  if (nextStock === 0) {
    store.gameState.cardSoldTo[card.id] = team.name;
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

export function undoLastPurchase(teamId: string) {
  const template = store.getActiveTemplate();
  const team = requireTeam(teamId);
  const snapshot = store.lastPurchaseByTeam.get(teamId);
  if (!snapshot) {
    throw new DomainError("Нет последней покупки для отмены");
  }

  const card = template.cards.find((c) => c.id === snapshot.cardId);
  if (!card) throw new DomainError("Карта не найдена", 404);

  store.gameState.cardStockLeft[card.id] = snapshot.prevStockLeft;
  if (snapshot.prevSoldTo) {
    store.gameState.cardSoldTo[card.id] = snapshot.prevSoldTo;
  } else {
    delete store.gameState.cardSoldTo[card.id];
  }

  const updated: Team = {
    ...team,
    currency: team.currency + snapshot.price,
    purchasesToday: Math.max(0, team.purchasesToday - 1),
    equippedCards: {
      ...team.equippedCards,
      [card.slotId]: snapshot.prevEquippedCardId,
    },
  };
  store.teams.set(updated.id, updated);
  store.lastPurchaseByTeam.delete(teamId);
  return withComputedStats(updated, template);
}

export function proposeCardToCaptain(teamId: string, cardId: string, memberName = "Участник") {
  const template = store.getActiveTemplate();
  const team = requireTeam(teamId);
  const card = template.cards.find((c) => c.id === cardId);
  if (!card) throw new DomainError("Карта не найдена", 404);

  const preview = previewCardEffect(team, card, template);
  const proposal = {
    id: `prop-${Date.now()}`,
    teamId: team.id,
    cardId: card.id,
    cardName: card.name,
    price: card.price,
    memberName,
    stepBefore: preview.beforeStats.step.total,
    stepAfter: preview.afterStats.step.total,
    createdAt: new Date().toISOString(),
  };
  store.proposals.unshift(proposal);
  return proposal;
}

export function buyPerk(teamId: string, perkId: string) {
  const template = store.getActiveTemplate();
  const team = requireTeam(teamId);
  requireOpenShop();

  const perk = template.perks.find((p) => p.id === perkId);
  if (!perk) throw new DomainError("Свойство не найдено", 404);
  if (perk.dayAvailable > store.gameState.currentDay) {
    throw new DomainError(`Свойство откроется в День ${perk.dayAvailable}`);
  }
  if (team.currency < perk.price) {
    throw new DomainError(`Недостаточно валюты (${template.currencyName})`);
  }

  const updated: Team = { ...team, currency: team.currency - perk.price, activePerkId: perk.id };
  store.teams.set(updated.id, updated);
  return withComputedStats(updated, template);
}
