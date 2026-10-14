import type { LiveState, ShiftPhase } from "@stem/shared";
import { postJson } from "../../../shared/api/index.js";

export const setPhase = (phase: ShiftPhase, minutes: number | null = null) =>
  postJson<LiveState>("/api/admin/phase", { phase, minutes });
export const nextDay = () => postJson<LiveState>("/api/admin/next-day");
export const applyTurn = () => postJson<LiveState>("/api/admin/apply-turn");
export const updatePurchaseLimit = (purchaseLimit: number | null) =>
  postJson<LiveState>("/api/admin/settings", { purchaseLimit });
export const resetEvent = (templateId: string | undefined, demoTeams: boolean) =>
  postJson<LiveState>("/api/admin/reset", { templateId, demoTeams });
