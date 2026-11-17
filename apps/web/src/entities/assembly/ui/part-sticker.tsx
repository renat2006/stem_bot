import { type ArtPack, proceduralPart } from "@stem/art";
import type { CardItem, GameTemplate } from "@stem/shared";
import { useState } from "react";
import { useArtPack } from "../model/use-art-pack.js";

export function PartSticker({
  card,
  template,
  pack,
  thumbnail = false,
  mirrored = false,
  fragmentId,
}: {
  card: CardItem;
  template: GameTemplate;
  pack?: ArtPack | null;
  thumbnail?: boolean;
  mirrored?: boolean;
  fragmentId?: string;
}) {
  const loadedPack = useArtPack(pack ? undefined : template.artPackId);
  const activePack = pack ?? loadedPack;
  const whole = activePack?.parts.find((part) => part.cardId === card.id);
  const asset = whole?.fragments.find((fragment) => fragment.id === fragmentId) ?? whole;
  const src = asset ? `/art/${activePack?.id}/${thumbnail ? asset.thumb : asset.src}` : undefined;
  const [failedSrc, setFailedSrc] = useState<string>();
  const useAsset = Boolean(src && failedSrc !== src);
  const fallback = `data:image/svg+xml,${encodeURIComponent(proceduralPart(card, template, activePack))}`;
  const rarity = card.rarity ?? "common";

  if (useAsset && asset?.contentBox && !thumbnail) {
    return (
      <svg
        className="part-sticker part-sticker--printed"
        viewBox={asset.contentBox.join(" ")}
        style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={card.name}
        data-tier={card.tier}
        data-rarity={rarity}
      >
        <image
          href={src}
          width={asset.width}
          height={asset.height}
          onError={() => {
            if (src) setFailedSrc(src);
          }}
        />
      </svg>
    );
  }
  return (
    <img
      className={`part-sticker${useAsset ? " part-sticker--printed" : ""}`}
      src={useAsset ? src : fallback}
      alt={card.name}
      decoding="async"
      loading={thumbnail ? "lazy" : "eager"}
      width={thumbnail ? 64 : 200}
      height={thumbnail ? 64 : 200}
      style={{
        transform: mirrored ? "scaleX(-1)" : undefined,
        objectFit: useAsset ? "contain" : "fill",
        ...(thumbnail ? { width: 64, height: 64, maxWidth: "100%", maxHeight: "100%", flexShrink: 0 } : {}),
      }}
      onError={() => {
        if (src) setFailedSrc(src);
      }}
      data-tier={card.tier}
      data-rarity={rarity}
    />
  );
}
