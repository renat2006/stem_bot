import type { GameTemplate } from "@stem/shared";
import { useState } from "react";
import { useArtPack } from "../model/use-art-pack.js";

export function PackIllustration({
  template,
  kind,
  label,
  className,
}: {
  template: GameTemplate;
  kind: "hero" | "story" | "noTeam" | "waiting" | "marketClosed" | "summary";
  label: string;
  className?: string;
}) {
  const pack = useArtPack(template.artPackId);
  const [failed, setFailed] = useState<string>();
  const path =
    kind === "hero" ? pack?.covers.hero : kind === "story" ? pack?.covers.story : pack?.emptyStates[kind];
  const src = path ? `/art/${pack?.id}/${path}` : "";

  if (src && failed !== src) {
    const isCover = kind === "hero" || kind === "story";
    return (
      <img
        src={src}
        alt={label}
        width={kind === "story" ? 1080 : isCover ? 1200 : 512}
        height={kind === "story" ? 1920 : isCover ? 630 : 512}
        decoding="async"
        loading={kind === "hero" ? "eager" : "lazy"}
        onError={() => setFailed(src)}
        className={
          className ??
          (kind === "story"
            ? "h-52 w-full rounded-2xl border border-ln object-cover object-center"
            : kind === "hero"
              ? "w-full rounded-2xl border border-ln object-cover"
              : "mx-auto h-28 w-28 object-contain")
        }
      />
    );
  }

  if (kind === "hero" || kind === "story") {
    return (
      <div
        role="img"
        aria-label={label}
        className={
          className ?? "relative h-44 w-full overflow-hidden rounded-2xl border border-ln bg-sf2 p-4"
        }
      >
        <svg viewBox="0 0 800 320" className="absolute inset-0 h-full w-full opacity-55" aria-hidden="true">
          <defs>
            <pattern id="bp-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="var(--ln)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="800" height="320" fill="url(#bp-grid)" />
          <path
            d="M 40 250 Q 220 180 410 220 T 760 120"
            fill="none"
            stroke="var(--ac)"
            strokeWidth="4"
            strokeDasharray="10 8"
          />
          <circle cx="410" cy="220" r="14" fill="var(--sf)" stroke="var(--ac)" strokeWidth="4" />
          <circle cx="760" cy="120" r="18" fill="var(--ac)" />
        </svg>
      </div>
    );
  }

  return null;
}
