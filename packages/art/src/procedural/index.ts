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
  ],
  gondola: ["M20 45 H180 L160 155 H45Z", "M20 40 L175 55 L160 155 L55 165 L30 100Z"],
  propulsion: ["M20 70 H100 L155 25 L175 50 L130 100 L175 150 L155 175 L100 130 H20Z"],
  stabilizer: ["M15 25 L180 100 L15 175 L50 100Z", "M25 30 L180 100 L25 155Z"],
  bci: ["M20 30 H180 V170 H20Z", "M100 15 L185 100 L100 185 L15 100Z"],
  telemetry: ["M70 30 H130 V150 H70Z M100 30 V10 M35 165 H165"],
  prod: ["M15 90 L100 35 L185 90 L100 145Z M30 100 V140 L100 180 L170 140 V100"],
  team: ["M15 65 L100 20 L185 65 V140 L100 185 L15 140Z"],
  mkt: ["M25 30 L175 60 V175 L25 145Z"],
  fin: ["M15 65 L100 20 L185 65 V140 L100 185 L15 140Z"],
  tech: ["M30 40 L100 15 L170 40 V160 L100 190 L30 160Z"],
};

function roverPartSvg(card: CardItem, primary: string, accent: string, outline: string): string {
  const rarityGlow = card.rarity === "legendary" ? "#F5A623" : card.rarity === "rare" ? "#D47B2A" : "#FAF6EE";
  const textHint = `${card.id} ${card.name}`.toLowerCase();

  if (card.slotId === "chassis") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 120" preserveAspectRatio="xMidYMid meet">
      <g stroke="${outline}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
        <path d="M18 68 L42 36 H232 L264 64 V88 H18Z" fill="${rarityGlow}" stroke="${rarityGlow}" stroke-width="10"/>
        <path d="M18 68 L42 36 H232 L264 64 V88 H18Z" fill="${primary}"/>
        <path d="M44 46 H224 L244 66 H34Z" fill="${accent}" opacity="0.85"/>
        <path d="M55 68 L85 86 M115 68 L145 86 M175 68 L205 86" stroke="${outline}" stroke-width="3"/>
        <circle cx="62" cy="78" r="6" fill="#FAF6EE"/><circle cx="140" cy="78" r="6" fill="#FAF6EE"/><circle cx="218" cy="78" r="6" fill="#FAF6EE"/>
      </g>
    </svg>`;
  }

  if (card.slotId === "drive") {
    if (textHint.includes("track") || textHint.includes("гусен")) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 130" preserveAspectRatio="xMidYMid meet">
        <g stroke="${outline}" stroke-width="4.5" stroke-linejoin="round">
          <rect x="20" y="38" width="260" height="72" rx="36" fill="${rarityGlow}" stroke="${rarityGlow}" stroke-width="10"/>
          <rect x="20" y="38" width="260" height="72" rx="36" fill="#2A2F33"/>
          <rect x="34" y="50" width="232" height="48" rx="24" fill="${primary}"/>
          <circle cx="64" cy="74" r="18" fill="${accent}"/><circle cx="150" cy="74" r="18" fill="${accent}"/><circle cx="236" cy="74" r="18" fill="${accent}"/>
          <circle cx="64" cy="74" r="6" fill="#FAF6EE"/><circle cx="150" cy="74" r="6" fill="#FAF6EE"/><circle cx="236" cy="74" r="6" fill="#FAF6EE"/>
          <path d="M55 38 V30 M95 38 V30 M135 38 V30 M175 38 V30 M215 38 V30 M245 38 V30" stroke="${outline}" stroke-width="4"/>
        </g>
      </svg>`;
    }
    if (textHint.includes("walk") || textHint.includes("шаг")) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 130" preserveAspectRatio="xMidYMid meet">
        <g stroke="${outline}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
          <path d="M85 28 L42 68 L58 116 M150 28 L125 74 L145 118 M215 28 L256 68 L238 116" fill="none" stroke="${rarityGlow}" stroke-width="13"/>
          <path d="M85 28 L42 68 L58 116 M150 28 L125 74 L145 118 M215 28 L256 68 L238 116" fill="none" stroke="${primary}" stroke-width="7"/>
          <rect x="70" y="18" width="160" height="22" rx="8" fill="${accent}"/>
          <circle cx="42" cy="68" r="8" fill="#FAF6EE"/><circle cx="125" cy="74" r="8" fill="#FAF6EE"/><circle cx="256" cy="68" r="8" fill="#FAF6EE"/>
          <path d="M44 116 H72 M132 118 H160 M224 116 H252" stroke="${outline}" stroke-width="6"/>
        </g>
      </svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 130" preserveAspectRatio="xMidYMid meet">
      <g stroke="${outline}" stroke-width="4.5" stroke-linejoin="round">
        <path d="M68 68 L150 32 L232 68" fill="none" stroke="${primary}" stroke-width="10"/>
        <circle cx="68" cy="74" r="42" fill="#2A2F33"/><circle cx="232" cy="74" r="42" fill="#2A2F33"/>
        <circle cx="68" cy="74" r="25" fill="${accent}"/><circle cx="232" cy="74" r="25" fill="${accent}"/>
        <circle cx="68" cy="74" r="9" fill="#FAF6EE"/><circle cx="232" cy="74" r="9" fill="#FAF6EE"/>
        <circle cx="150" cy="34" r="10" fill="${primary}"/>
      </g>
    </svg>`;
  }

  if (card.slotId === "sensors") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" preserveAspectRatio="xMidYMid meet">
      <g stroke="${outline}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round">
        <path d="M90 162 V86" stroke="${primary}" stroke-width="12"/>
        <rect x="52" y="42" width="76" height="46" rx="14" fill="${primary}"/>
        <circle cx="90" cy="65" r="14" fill="${accent}"/>
        <circle cx="90" cy="65" r="5" fill="#FAF6EE"/>
        <path d="M132 52 L164 36 M132 65 H168 M132 78 L164 94" stroke="${rarityGlow === "#FAF6EE" ? accent : rarityGlow}" stroke-width="4" stroke-dasharray="5 5"/>
        <rect x="64" y="154" width="52" height="14" rx="5" fill="${accent}"/>
      </g>
    </svg>`;
  }

  if (card.slotId === "power") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 150" preserveAspectRatio="xMidYMid meet">
      <g stroke="${outline}" stroke-width="4.5" stroke-linejoin="round">
        <rect x="26" y="36" width="128" height="84" rx="12" fill="${primary}"/>
        <rect x="46" y="24" width="24" height="14" rx="3" fill="${accent}"/>
        <rect x="110" y="24" width="24" height="14" rx="3" fill="${accent}"/>
        <path d="M96 52 L76 80 H96 L84 106 L110 74 H90Z" fill="#FFD15C"/>
      </g>
    </svg>`;
  }

  if (card.slotId === "cargo") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 170" preserveAspectRatio="xMidYMid meet">
      <g stroke="${outline}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round">
        <path d="M148 152 L106 96 L136 52 L88 44" fill="none" stroke="${primary}" stroke-width="11"/>
        <rect x="26" y="34" width="68" height="54" rx="8" fill="${accent}"/>
        <path d="M26 58 H94 M60 34 V88" stroke="${outline}" stroke-width="3.5"/>
        <circle cx="106" cy="96" r="9" fill="#FAF6EE"/><circle cx="136" cy="52" r="8" fill="#FAF6EE"/>
        <rect x="120" y="146" width="54" height="14" rx="5" fill="${primary}"/>
      </g>
    </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 150" preserveAspectRatio="xMidYMid meet">
    <g stroke="${outline}" stroke-width="4" stroke-linejoin="round">
      <rect x="30" y="30" width="110" height="90" rx="12" fill="#2E5F63"/>
      <rect x="54" y="50" width="62" height="50" rx="6" fill="${primary}"/>
      <path d="M46 30 V16 M74 30 V16 M102 30 V16 M124 30 V16 M46 120 V134 M74 120 V134 M102 120 V134 M124 120 V134" stroke="${accent}" stroke-width="5"/>
      <circle cx="72" cy="75" r="5" fill="#FFD15C"/><circle cx="96" cy="75" r="5" fill="#5EE2A0"/>
    </g>
  </svg>`;
}

export function proceduralPart(card: CardItem, template: GameTemplate, pack?: ArtPack | null): string {
  const seed = hashId(card.id);
  const palette = pack?.palette ?? {
    outline: "#1F1D19",
    rust: "#C4532F",
    teal: "#2E5F63",
    ochre: "#D99B38",
    olive: "#6F8136",
  };
  const colors = Object.entries(palette)
    .filter(([key]) => !["outline", "paper", "glow"].includes(key))
    .map(([, color]) => color);
  const family = card.id.split("-")[0] ?? card.id;
  const color = colors[hashId(family) % colors.length] ?? "#C4532F";
  const secondColor = colors[(hashId(family) + 1) % colors.length] ?? "#D99B38";
  const outline = palette.outline ?? "#1F1D19";

  if (template.objectRig === "rover") {
    return roverPartSvg(card, color, secondColor, outline);
  }

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
