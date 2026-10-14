import type { GameState } from "@stem/shared";
import { store } from "../../shared/store.js";
import { requireTeam } from "../team/service.js";

export function rewardTeam(teamId: string, amount: number) {
  const team = requireTeam(teamId);
  const updated = { ...team, currency: Math.max(0, team.currency + amount) };
  store.teams.set(updated.id, updated);
  return updated;
}

export function moveTeamOnTrack(teamId: string, delta: number) {
  const { trackMax } = store.getActiveTemplate();
  const team = requireTeam(teamId);
  const updated = { ...team, trackPosition: Math.min(trackMax, Math.max(1, team.trackPosition + delta)) };
  store.teams.set(updated.id, updated);
  return updated;
}

export type GameStatePatch = Partial<
  Pick<GameState, "currentDay" | "purchasePhaseActive" | "dailyPurchaseLimit">
>;

export function updateGameState(patch: GameStatePatch) {
  const dayChanged = patch.currentDay !== undefined && patch.currentDay !== store.gameState.currentDay;
  const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  store.gameState = { ...store.gameState, ...defined };

  if (dayChanged) {
    for (const [id, team] of store.teams) store.teams.set(id, { ...team, purchasesToday: 0 });
  }
  return store.gameState;
}

export function switchTemplate(templateId: string) {
  return { template: store.switchTemplate(templateId), gameState: store.gameState };
}
