import type { GameState } from "@stem/shared";
import { postJson } from "../../../shared/api/index.js";

export type GameStatePatch = Partial<
  Pick<GameState, "currentDay" | "purchasePhaseActive" | "dailyPurchaseLimit">
>;

export const updateGameState = (patch: GameStatePatch) => postJson("/api/admin/game-state", patch);
export const switchTemplate = (templateId: string) => postJson("/api/admin/switch-template", { templateId });
