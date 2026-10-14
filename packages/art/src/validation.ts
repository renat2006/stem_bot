import type { GameTemplate } from "@stem/shared";
import type { ArtPack } from "./schema.js";

export function validateArtCoverage(pack: ArtPack, template: GameTemplate): string[] {
  const errors: string[] = [];
  for (const card of template.cards)
    if (!pack.parts.some((part) => part.cardId === card.id)) errors.push(`Missing card: ${card.id}`);
  for (const part of pack.parts)
    if (!template.cards.some((card) => card.id === part.cardId)) errors.push(`Unknown card: ${part.cardId}`);
  for (const perk of template.perks) if (!pack.perks[perk.id]) errors.push(`Missing perk: ${perk.id}`);
  for (const stat of template.stats) if (!pack.stats[stat.id]) errors.push(`Missing stat: ${stat.id}`);
  for (const type of new Set(template.boardCells.map((cell) => cell.type)))
    if (!pack.cells[type]) errors.push(`Missing cell: ${type}`);
  if (!pack.currency) errors.push("Missing currency");
  if (Object.values(pack.palette).some((color) => color.toUpperCase() === "#FF00FF"))
    errors.push("Chroma key in palette");
  for (const key of ["noTeam", "waiting", "marketClosed", "summary"] as const)
    if (!pack.emptyStates[key]) errors.push(`Missing empty state: ${key}`);
  if (!pack.covers.hero || !pack.covers.story) errors.push("Missing theme covers");
  return errors;
}

export function validateAssetSize(path: string, bytes: number, limit: number) {
  return bytes > limit ? `${path}: ${bytes} exceeds ${limit} bytes` : null;
}
