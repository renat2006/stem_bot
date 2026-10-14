import type { LiveState } from "@stem/shared";
import { postJson } from "../../../shared/api/index.js";

export const rewardTeams = (teamIds: string[], amount: number, reason: string, comment?: string) =>
  postJson<LiveState>("/api/admin/reward", { teamIds, amount, reason, comment });
export const adjustTrack = (teamId: string, delta: number, reason?: string) =>
  postJson<LiveState>("/api/admin/track", { teamId, delta, reason });
export const createTeam = (name: string) => postJson<LiveState>("/api/admin/teams", { name });
export const setCaptain = (teamId: string, userId: number) =>
  postJson<LiveState>("/api/admin/captain", { teamId, userId });
export const removeMember = (userId: number) => postJson<LiveState>("/api/admin/remove-member", { userId });
