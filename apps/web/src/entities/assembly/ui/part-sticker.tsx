import { type ArtPack, proceduralPart } from "@stem/art";
import type { CardItem, GameTemplate } from "@stem/shared";
import { useState } from "react";
import { useArtPack } from "../model/use-art-pack.js";

export function PartSticker({
  card,
  template,
  pack,
  thumbnail = false,
}: {
  card: CardItem;
  template: GameTemplate;
  pack?: ArtPack | null;
  thumbnail?: boolean;
}) {
  const loadedPack = useArtPack(pack ? undefined : template.artPackId);
  const activePack = pack ?? loadedPack;
  const asset = activePack?.parts.find((part) => part.cardId === card.id);
  const src = asset ? `/art/${activePack?.id}/${thumbnail ? asset.thumb : asset.src}` : undefined;
  const [failedSrc, setFailedSrc] = useState<string>();
  const useAsset = Boolean(src && failedSrc !== src);
  const fallback = `data:image/svg+xml,${encodeURIComponent(proceduralPart(card, template, activePack))}`;
  return (
    <img
      className="part-sticker"
      src={useAsset ? src : fallback}
      alt={card.name}
      decoding="async"
      loading={thumbnail ? "lazy" : "eager"}
      width={thumbnail ? 64 : 200}
      height={thumbnail ? 64 : 200}
      style={{
        objectFit: useAsset ? "contain" : "fill",
        ...(thumbnail ? { width: 64, height: 64, maxWidth: "100%", maxHeight: "100%", flexShrink: 0 } : {}),
      }}
      onError={() => {
        if (src) setFailedSrc(src);
      }}
      data-tier={card.tier}
    />
  );
}
