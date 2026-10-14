import type { LiveState } from "@stem/shared";
import { postJson } from "../../../shared/api/index.js";

export const buyCard = (cardId: string) => postJson<LiveState>("/api/team/buy-card", { cardId });
export const undoLastPurchase = () => postJson<LiveState>("/api/team/undo-purchase");
export const proposeCard = (cardId: string) => postJson<LiveState>("/api/team/propose", { cardId });
export const resolveProposal = (proposalId: string, accept: boolean) =>
  postJson<LiveState>(`/api/team/proposals/${encodeURIComponent(proposalId)}`, { accept });
export const buyPerk = (perkId: string) => postJson<LiveState>("/api/team/buy-perk", { perkId });
