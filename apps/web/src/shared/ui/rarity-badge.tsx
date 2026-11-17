import type { CardRarity, EffectScope } from "@stem/shared";
import { Layers, ShieldCheck, Sparkles, Tag } from "lucide-react";

export const RARITY_LABEL: Record<CardRarity, string> = {
  common: "Обычная",
  rare: "Редкая",
  legendary: "Легендарная",
};

export const SCOPE_LABEL: Record<EffectScope, string> = {
  step: "Усиление хода (+1 шаг)",
  event_shield: "Щит испытаний трассы",
  economy: "Бонус экономики (+1 за раунд)",
  slot_synergy: "Синергия полной сборки (+1 шаг)",
};

export function RarityBadge({
  rarity = "common",
  compact = false,
}: {
  rarity?: CardRarity;
  compact?: boolean;
}) {
  const styles: Record<CardRarity, string> = {
    common: "border-ln bg-sf2 text-mu",
    rare: "border-ac/40 bg-ac/12 text-ac",
    legendary: "border-warn/50 bg-warn/15 text-warn",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${styles[rarity]} ${
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      {rarity === "legendary" && <Sparkles className="h-3 w-3 shrink-0" />}
      {RARITY_LABEL[rarity]}
    </span>
  );
}

export function EffectScopeBadge({ scope }: { scope?: EffectScope }) {
  if (!scope) return null;
  const IconComp =
    scope === "event_shield"
      ? ShieldCheck
      : scope === "economy"
        ? Tag
        : scope === "slot_synergy"
          ? Layers
          : Sparkles;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-warn/40 bg-warn/10 px-2.5 py-1 text-xs font-medium text-fg">
      <IconComp className="h-3.5 w-3.5 shrink-0 text-warn" />
      {SCOPE_LABEL[scope]}
    </span>
  );
}
