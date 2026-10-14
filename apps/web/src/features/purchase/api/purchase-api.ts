import { postJson } from "../../../shared/api/index.js";

export const buyCard = (teamId: string, cardId: string) => postJson("/api/team/buy-card", { teamId, cardId });
export const buyPerk = (teamId: string, perkId: string) => postJson("/api/team/buy-perk", { teamId, perkId });
