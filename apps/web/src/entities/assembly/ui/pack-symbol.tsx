import type { GameTemplate } from "@stem/shared";
import { useState } from "react";
import { useArtPack } from "../model/use-art-pack.js";

export function PackSymbol({
  template,
  kind,
  id,
  label,
  size = 32,
}: {
  template: GameTemplate;
  kind: "perk" | "stat" | "cell" | "currency";
  id?: string;
  label: string;
  size?: number;
}) {
  const pack = useArtPack(template.artPackId);
  const [failed, setFailed] = useState<string>();
  const path =
    kind === "currency"
      ? pack?.currency
      : kind === "perk"
        ? pack?.perks[id ?? ""]
        : kind === "stat"
          ? pack?.stats[id ?? ""]
          : pack?.cells[id ?? ""];
  const src = path ? `/art/${pack?.id}/${path}` : "";
  if (!src || failed === src) return null;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={label}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(src)}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
    />
  );
}
