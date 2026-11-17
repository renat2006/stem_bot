import type { LiveState } from "@stem/shared";
import { postJson } from "../../../shared/api/index.js";

export const buyCard = (cardId: string) => postJson<LiveState>("/api/team/buy-card", { cardId });
export const undoLastPurchase = () => postJson<LiveState>("/api/team/undo-purchase");
export const proposeCard = (cardId: string, listingId?: string) =>
  postJson<LiveState>("/api/team/propose", { cardId, listingId });
export const resolveProposal = (proposalId: string, accept: boolean) =>
  postJson<LiveState>(`/api/team/proposals/${encodeURIComponent(proposalId)}`, { accept });
export const buyPerk = (perkId: string) => postJson<LiveState>("/api/team/buy-perk", { perkId });

export const equipFromInventory = (slotId: string, cardId: string | null) =>
  postJson<LiveState>("/api/team/equip-inventory", { slotId, cardId });

export const createP2PListing = (input: { cardId: string; price: number; fromEquippedSlot?: string }) =>
  postJson<LiveState>("/api/team/p2p/list", input);

export const cancelP2PListing = (listingId: string) =>
  postJson<LiveState>("/api/team/p2p/cancel", { listingId });

export const buyP2PListing = (listingId: string) => postJson<LiveState>("/api/team/p2p/buy", { listingId });

export const placeAuctionBid = (auctionId: string, amount: number) =>
  postJson<LiveState>(`/api/team/auctions/${encodeURIComponent(auctionId)}/bid`, { amount });
