import type { GameTemplate } from "@stem/shared";
import type { ArtPack } from "../schema.js";

const attachment: Record<string, string> = {
  head: "head facing RIGHT with short neck joint on LOWER LEFT; no separate tusks without a head",
  body: "horizontal organic torso ONLY facing RIGHT, no head, no legs, no tail, no eyes; solid rounded rump and solid short neck base, no pipes, rings, holes or exposed mechanical sockets",
  front: "pair of front legs or pincers in strict side view, shoulder attachment at TOP, feet below",
  back: "pair of hind legs in strict side view with hip attachment at TOP, feet below",
  tail: "tail base at RIGHT, tail extends and curves LEFT, no other body parts",
  special: "single dorsal back accessory with flat attachment base at BOTTOM, not a whole animal",
};
const tierDetail = [
  "simple silhouette",
  "one extra structural detail",
  "protective plates or geometric ornament",
  "metal reinforcements and tiny energy accent",
  "crystalline or energetic feature, still restrained",
];
const motifs: Record<string, string> = {
  tri: "streamlined wedge or fin",
  up: "upward streamlined form",
  sq: "chunky angular mass or jaw",
  dia: "angular innovative structure",
  hex: "protective geometric plates",
};

export interface AssetPrompt {
  id: string;
  kind: "part" | "perk" | "stat" | "currency" | "cell" | "cover" | "empty";
  prompt: string;
  negative: string;
  size: string;
  background: string;
  referenceIds: string[];
}

export function buildAssetPrompts(template: GameTemplate, pack: ArtPack): AssetPrompt[] {
  const negative =
    "no text, letters, numbers, logos, watermarks, photo-realism, 3D, rainbow, gradients, gore, scenery, magenta inside object, white sticker outline, drop shadows";
  const prefix = `Single modular science-lab collectible illustration. Match the approved printed field-bestiary reference: simple chunky geometric silhouettes, two or three flat ink tones, very light irregular ink grain only inside shapes, warm handmade print character, playful tiny eye expression where appropriate. Palette strictly ${Object.values(pack.palette).join(", ")}. Consistent dark outline. No sticker border: the app adds it. Top-left light, strict side view. Isolated centered object with 10 percent empty margin. Solid uniform #FF00FF background.`;
  const entry = (id: string, kind: AssetPrompt["kind"], object: string): AssetPrompt => ({
    id,
    kind,
    prompt: `${prefix} Object: ${object}. ${negative}.`,
    negative,
    size: "1024x1024",
    background: "#FF00FF",
    referenceIds: ["printed-field-bestiary-B"],
  });
  const prompts = template.cards.map((card) => {
    const dominant = template.stats
      .filter((s) => (card.stats[s.id] ?? 0) > 0)
      .sort((a, b) => (card.stats[b.id] ?? 0) - (card.stats[a.id] ?? 0))[0];
    const weak = template.stats
      .filter((s) => (card.stats[s.id] ?? 0) < 0)
      .sort((a, b) => (card.stats[a.id] ?? 0) - (card.stats[b.id] ?? 0))[0];
    return entry(
      card.id,
      "part",
      `${card.name}; ${attachment[card.slotId] ?? `modular component for slot ${card.slotId}`}. Tier ${["I", "II", "III", "IV", "V"][card.tier - 1]}: ${tierDetail[card.tier - 1]}. Dominant ${dominant?.label ?? "neutral"}: ${motifs[dominant?.shape ?? "sq"]}. Weakness ${weak?.label ?? "none"}: small exposed attachment, never injury. Keep the whole silhouette very simple and recognizable at 48 pixels`,
    );
  });
  for (const perk of template.perks)
    prompts.push(
      entry(
        `perk-${perk.id}`,
        "perk",
        `round medallion, simple emblem representing ${perk.name}: ${perk.effectText}`,
      ),
    );
  for (const stat of template.stats)
    prompts.push(
      entry(
        `stat-${stat.id}`,
        "stat",
        `small symbol for ${stat.label}, geometric ${stat.shape} silhouette, not text`,
      ),
    );
  prompts.push(entry("currency", "currency", `DNA helix token coin for ${template.currencyName}`));
  for (const type of new Set(template.boardCells.map((cell) => cell.type)))
    prompts.push(
      entry(`cell-${type}`, "cell", `board event symbol ${type}, simple science-lab icon, child-friendly`),
    );
  for (const [id, scene] of Object.entries({
    noTeam: "an unassembled creature kit waiting for a team",
    waiting: "a friendly small chimera resting beside a simple hourglass",
    marketClosed: "a closed specimen drawer with a little lock",
    summary: "a completed chimera proudly standing by a small specimen medal",
  })) {
    prompts.push(entry(`empty-${id}`, "empty", scene));
  }
  for (const id of ["hero", "story"]) {
    prompts.push({
      id: `cover-${id}`,
      kind: "cover",
      prompt: `${prefix.replace("Solid uniform #FF00FF background.", "Warm bone paper background with a very faint graph grid.")} A friendly assembled modular chimera specimen for ${template.title}, moss green and muted teal body, rust lion head, little pincers, sturdy rear legs, crocodile tail and geometric turtle shell. Quiet field-notebook composition with tiny unlettered tags and measurement marks. ${id === "hero" ? "Wide landscape composition 1200x630." : "Tall portrait composition 1080x1920, central specimen, generous negative space."} No text, lettering, UI, magenta or logos.`,
      negative,
      size: id === "hero" ? "1200x630" : "1080x1920",
      background: "paper",
      referenceIds: ["printed-field-bestiary-B"],
    });
  }
  return prompts;
}
