import type { GameTemplate } from "@stem/shared";
import { useState } from "react";
import { useArtPack } from "../model/use-art-pack.js";

export function PackIllustration({
  template,
  kind,
  label,
}: {
  template: GameTemplate;
  kind: "hero" | "noTeam" | "waiting" | "marketClosed" | "summary";
  label: string;
}) {
  const pack = useArtPack(template.artPackId);
  const [failed, setFailed] = useState<string>();
  const path = kind === "hero" ? pack?.covers.hero : pack?.emptyStates[kind];
  const src = path ? `/art/${pack?.id}/${path}` : "";
  if (!src || failed === src) return null;
  return (
    <img
      src={src}
      alt={label}
      width={kind === "hero" ? 1200 : 512}
      height={kind === "hero" ? 630 : 512}
      decoding="async"
      loading="lazy"
      onError={() => setFailed(src)}
      className={kind === "hero" ? "w-full rounded-2xl border border-ln" : "mx-auto h-28 w-28 object-contain"}
    />
  );
}
