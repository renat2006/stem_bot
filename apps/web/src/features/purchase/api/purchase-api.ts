import { postJson } from "../../../shared/api/index.js";

export const buyCard = (teamId: string, cardId: string) => postJson("/api/team/buy-card", { teamId, cardId });

export const undoLastPurchase = (teamId: string) => postJson("/api/team/undo-purchase", { teamId });

export const proposeCardToCaptain = (teamId: string, cardId: string, memberName?: string) =>
  postJson("/api/team/propose-card", { teamId, cardId, memberName });

export const buyPerk = (teamId: string, perkId: string) => postJson("/api/team/buy-perk", { teamId, perkId });
