import { postJson } from "../../../shared/api/index.js";

export const rewardTeam = (teamId: string, amount: number) =>
  postJson("/api/admin/reward", { teamId, amount });
export const moveTeamOnTrack = (teamId: string, delta: number) =>
  postJson("/api/admin/move-track", { teamId, delta });
