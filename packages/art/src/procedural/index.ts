import type { CardItem, GameTemplate } from "@stem/shared";
import type { ArtPack } from "../schema.js";

export function hashId(value: string): number {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

const shapes: Record<string, string[]> = {
  head: [
    "M25 145 Q10 40 85 28 L115 55 Q190 35 185 110 L150 132 L170 155 L70 175Z",
    "M25 155 L35 40 L75 60 L100 25 L145 58 L188 95 L175 145 L100 175Z",
    "M30 150 Q5 75 65 45 L50 15 L95 50 Q175 25 190 100 L160 145 L90 175Z",
  ],
  body: [
    "M15 75 Q40 25 125 45 L185 70 L170 145 Q85 170 25 140Z",
    "M15 70 L65 35 L150 50 L190 95 L160 150 L45 145Z",
    "M15 100 Q20 35 100 35 Q180 40 190 100 Q180 160 100 160 Q20 160 15 100Z",
  ],
  front: [
    "M45 20 L100 25 L105 120 L155 155 L160 180 L65 180 L50 130Z",
    "M40 20 L115 20 L135 80 L100 135 L155 160 L155 180 L65 180 L55 125 L75 80Z",
    "M30 25 Q110 0 120 65 L100 145 L160 160 L155 180 L55 180 L65 90Z",
  ],
  back: [
    "M30 25 L110 20 L155 90 L105 145 L160 160 L160 180 L60 180 L45 130 L85 90Z",
    "M40 20 Q150 5 155 75 L100 140 L155 165 L155 180 L55 180 L55 120 L95 80Z",
    "M35 20 L105 20 L110 140 L155 165 L155 180 L45 180Z",
  ],
  tail: [
    "M185 135 Q15 180 25 75 Q30 25 85 30 L75 55 Q30 80 95 110 L185 100Z",
    "M185 130 L45 150 L15 95 L45 65 L185 100Z",
    "M185 140 Q100 165 40 115 Q5 85 25 35 L55 60 Q40 100 185 100Z",
  ],
  special: [
    "M20 175 L30 95 L60 135 L90 35 L115 120 L150 60 L180 175Z",
    "M15 175 Q20 50 100 45 Q175 55 185 175Z",
    "M20 175 L70 130 L85 30 L110 125 L160 75 L180 175Z",
  ],
  envelope: [
    "M12 100 Q25 35 100 35 Q175 35 190 100 Q175 165 100 165 Q25 165 12 100Z",
    "M12 100 L55 45 L145 45 L190 100 L145 150 L55 150Z",
    "M12 100 Q30 15 100 25 Q175 30 190 100 Q165 155 100 155 Q30 155 12 100Z",
  ],
  gondola: [
    "M20 45 H180 L160 155 H45Z",
    "M20 40 L175 55 L160 155 L55 165 L30 100Z",
    "M25 45 Q110 20 180 55 L165 155 H50Z",
  ],
  propulsion: [
    "M20 70 H100 L155 25 L175 50 L130 100 L175 150 L155 175 L100 130 H20Z",
    "M20 50 H150 L185 100 L150 150 H20Z",
    "M25 60 H145 V140 H25Z M145 100 L180 35 V165Z",
  ],
  stabilizer: [
    "M15 25 L180 100 L15 175 L50 100Z",
    "M25 30 L180 100 L25 155Z",
    "M20 20 H75 L180 100 L75 175 H20 L65 100Z",
  ],
  bci: [
    "M20 30 H180 V170 H20Z",
    "M100 15 L185 100 L100 185 L15 100Z",
    "M50 20 H150 L185 55 V145 L150 180 H50 L15 145 V55Z",
  ],
  telemetry: [
    "M70 30 H130 V150 H70Z M100 30 V10 M35 165 H165",
    "M45 65 L100 20 L155 65 L100 110Z M90 110 H110 V180 H90Z",
    "M50 20 H150 V140 H50Z M100 140 V185",
  ],
  prod: [
    "M15 90 L100 35 L185 90 L100 145Z M30 100 V140 L100 180 L170 140 V100",
    "M15 90 L100 20 L185 90 L100 145Z M45 105 V150 L100 180 L155 150 V105",
    "M15 85 L100 45 L185 85 L100 125Z M20 90 V145 L100 180 L180 145 V90",
  ],
  team: [
    "M15 65 L100 20 L185 65 V140 L100 185 L15 140Z",
    "M20 85 L100 40 L180 85 V145 L100 185 L20 145Z",
    "M15 75 L100 25 L185 75 V130 L100 180 L15 130Z",
  ],
  mkt: [
    "M25 30 L175 60 V175 L25 145Z",
    "M15 30 L185 70 V160 L15 120Z M70 140 V180 H140",
    "M20 55 L100 20 L180 55 V140 L100 180 L20 140Z",
  ],
  fin: [
    "M15 65 L100 20 L185 65 V140 L100 185 L15 140Z",
    "M15 85 L100 40 L185 85 V140 L100 185 L15 140Z",
    "M30 50 L100 20 L170 50 V150 L100 180 L30 150Z",
  ],
  tech: [
    "M30 40 L100 15 L170 40 V160 L100 190 L30 160Z",
    "M25 55 L100 20 L175 55 V155 L100 190 L25 155Z",
    "M40 25 L100 10 L160 25 V170 L100 190 L40 170Z",
  ],
};

export function proceduralPart(card: CardItem, template: GameTemplate, pack?: ArtPack | null): string {
  const seed = hashId(card.id);
  const palette = pack?.palette ?? { outline: "#1B1F23", moss: "#5E8C4A", sand: "#D9B26F", teal: "#2F7F86" };
  const colors = Object.entries(palette)
    .filter(([key]) => !["outline", "paper", "glow"].includes(key))
    .map(([, color]) => color);
  const family = card.id.split("-")[0] ?? card.id;
  const color = colors[hashId(family) % colors.length] ?? "#5E8C4A";
  const outline = palette.outline ?? "#1B1F23";
  const variants = shapes[card.slotId] ?? ["M20 45 L100 15 L180 45 V155 L100 185 L20 155Z"];
  const path = variants[seed % variants.length] ?? variants[0];
  const dominant = template.stats
    .filter((s) => (card.stats[s.id] ?? 0) > 0)
    .sort((a, b) => (card.stats[b.id] ?? 0) - (card.stats[a.id] ?? 0))[0];
  const accent = safeColor(dominant?.color ?? "#D9B26F");
  const motif =
    dominant?.shape === "sq" || dominant?.shape === "dia"
      ? `<path d="M65 90 L82 55 L100 90 L120 55 L138 90Z" fill="${accent}"/>`
      : dominant?.shape === "hex"
        ? `<path d="M65 70 H135 V120 L100 145 L65 120Z" fill="${accent}"/>`
        : `<path d="M50 95 L140 75 L125 95 L145 105 L55 125Z" fill="${accent}"/>`;
  const weak = Object.values(card.stats).some((v) => v < 0)
    ? '<path d="M45 120 L58 128 L50 140" fill="none" stroke-dasharray="4 4"/>'
    : "";
  const tier = Array.from(
    { length: card.tier - 1 },
    (_, i) =>
      `<circle cx="${65 + i * 22}" cy="152" r="5" fill="${card.tier >= 4 ? (palette.glow ?? accent) : outline}" stroke="none"/>`,
  ).join("");
  const face =
    card.slotId === "head" ? '<circle cx="140" cy="82" r="6"/><path d="M150 120 H175" fill="none"/>' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" preserveAspectRatio="none"><g stroke="${outline}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="${path}" fill="${color}" stroke="#fff" stroke-width="11"/><path d="${path}" fill="${color}"/><path d="M45 135 Q100 155 155 130" fill="none" opacity=".25" stroke-width="10"/><path d="M55 65 L90 52" stroke="#fff" opacity=".5"/>${motif}${weak}${tier}${face}</g></svg>`;
}

function safeColor(value: string): string {
  return /^(#[a-f0-9]{3,8}|(?:oklch|rgb|hsl)a?\([\d\s.%/,+-]+\))$/i.test(value) ? value : "#D9B26F";
}
