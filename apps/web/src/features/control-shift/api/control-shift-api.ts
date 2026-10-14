import type { GameState } from "@stem/shared";
import { postJson } from "../../../shared/api/index.js";

export type GameStatePatch = Partial<
  Pick<GameState, "currentDay" | "currentPhase" | "purchasePhaseActive" | "dailyPurchaseLimit">
>;

export const updateGameState = (patch: GameStatePatch) => postJson("/api/admin/game-state", patch);
export const resetShift = () => postJson("/api/admin/reset-shift", {});
export const loadDemoMidgame = () => postJson("/api/admin/load-demo", {});
export const switchTemplate = (templateId: string) => postJson("/api/admin/switch-template", { templateId });
