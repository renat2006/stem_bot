import { type AssemblyLayer, type AssemblyPreview, composeAssembly, speciesName } from "@stem/art";
import type { GameTemplate } from "@stem/shared";
import { hapticFeedback } from "@tma.js/sdk-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useArtPack } from "../model/use-art-pack.js";
import { PartSticker } from "./part-sticker.js";
import "./assembly.css";

interface AssemblyStageProps {
  template: GameTemplate;
  equipped: Record<string, string | null>;
  size?: "hero" | "card" | "token";
  preview?: AssemblyPreview;
  interactive?: boolean;
  onSlotTap?: (slotId: string) => void;
  teamName?: string;
}

export function AssemblyStage({
  template,
  equipped,
  size = "hero",
  preview,
  interactive = false,
  onSlotTap,
  teamName,
}: AssemblyStageProps) {
  const pack = useArtPack(template.artPackId);
  const { rig, layers, drawables, height } = composeAssembly(template, equipped, pack, preview);
  const equipmentKey = JSON.stringify(template.slots.map((slot) => [slot.id, equipped[slot.id] ?? null]));
  const previousTemplateId = useRef(template.id);
  const previous = useRef(equipped);
  const [departing, setDeparting] = useState<Record<string, string | null>>({});
  const [arriving, setArriving] = useState<string[]>([]);
  const lowPower =
    typeof navigator !== "undefined" &&
    /Android/i.test(navigator.userAgent) &&
    navigator.hardwareConcurrency <= 4;
  useEffect(() => {
    const current = Object.fromEntries(JSON.parse(equipmentKey) as [string, string | null][]);
    if (previousTemplateId.current !== template.id) {
      previous.current = current;
      previousTemplateId.current = template.id;
      return;
    }
    const changed = template.slots.filter(
      (slot) => (previous.current[slot.id] ?? null) !== (current[slot.id] ?? null),
    );
    if (!changed.length) return;
    setDeparting(Object.fromEntries(changed.map((slot) => [slot.id, previous.current[slot.id] ?? null])));
    setArriving(changed.filter((slot) => current[slot.id]).map((slot) => slot.id));
    previous.current = current;
    if (changed.some((slot) => current[slot.id]) && hapticFeedback.impactOccurred.isAvailable())
      hapticFeedback.impactOccurred("medium");
    const timer = window.setTimeout(() => {
      setDeparting({});
      setArriving([]);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [equipmentKey, template.id, template.slots]);
  useEffect(() => {
    if (size !== "hero" || !pack) return;
    const links = pack.parts
      .filter((part) => Object.values(equipped).includes(part.cardId))
      .flatMap((part) =>
        part.fragments.length ? part.fragments.map((fragment) => fragment.src) : [part.src],
      )
      .map((src) => {
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = `/art/${pack.id}/${src}`;
        document.head.append(link);
        return link;
      });
    return () => {
      for (const link of links) link.remove();
    };
  }, [pack, equipped, size]);
  const filled = layers
    .filter((layer) => layer.card)
    .map((layer) => layer.card?.name)
    .join(", ");
  const empty = layers
    .filter((layer) => !layer.card)
    .map((layer) => layer.label)
    .join(", ");
  const label = `${template.objectName}${teamName ? ` команды «${teamName}»` : ""}: ${filled || "деталей пока нет"}${empty ? `; пустые: ${empty}` : ""}`;
  const boxStyle = (layer: AssemblyLayer): CSSProperties =>
    ({
      "--assembly-angle": `${layer.socket.rotation}deg`,
      transform: `rotate(${layer.socket.rotation}deg)`,
      left: `${((layer.socket.box[0] - rig.frame[0]) / rig.frame[2]) * 100}%`,
      top: `${((layer.socket.box[1] - rig.frame[1]) / height) * 100}%`,
      width: `${(layer.socket.box[2] / rig.frame[2]) * 100}%`,
      height: `${(layer.socket.box[3] / height) * 100}%`,
      zIndex: layer.socket.z + 1,
      transformOrigin: `${layer.socket.pivot[0] * 100}% ${layer.socket.pivot[1] * 100}%`,
      animationDelay: `${layer.socket.motion === "bob" ? 0 : layer.socket.z * -0.4}s`,
    }) as CSSProperties;
  return (
    <figure
      className={`assembly-stage assembly-stage--${size}`}
      data-low-power={lowPower || undefined}
      data-rig={rig.id}
      aria-label={label}
    >
      <div
        className="assembly-canvas"
        role="img"
        aria-label={label}
        style={{ aspectRatio: `${rig.frame[2]} / ${height}` }}
      >
        <svg
          className="assembly-ghost"
          viewBox={`${rig.frame[0]} ${rig.frame[1]} ${rig.frame[2]} ${height}`}
          aria-hidden="true"
        >
          <ellipse {...rig.shadow} cy={rig.frame[1] + rig.frame[3] - 45} className="assembly-shadow" />
          {rig.id === "campus" && (
            <path d="M70 650 L500 420 L940 650 L500 900Z" className="assembly-plinth" />
          )}
          {rig.id === "airship" && (
            <path d="M330 430 L390 610 M670 430 L610 610 M500 735 V805" className="assembly-rigging" />
          )}
          <path d={rig.ghostPath} />
          <path d="M25 90 V25 H90 M910 25 H975 V90 M25 910 V975 H90 M910 975 H975 V910" />
        </svg>
        <div className="assembly-life">
          {drawables.map((layer) => {
            const oldCard = template.cards.find((card) => card.id === departing[layer.slotId]);
            const outgoingCard = oldCard ?? layer.previousCard;
            return (
              <div
                key={layer.id}
                data-plane={layer.plane}
                className={`assembly-socket assembly-motion--${layer.socket.motion}`}
                data-preview={layer.isPreview || undefined}
                data-shelf={layer.onShelf || undefined}
                style={{
                  ...boxStyle(layer),
                  opacity: layer.opacity,
                  animationDelay: layer.plane === "far" ? "-2.9s" : "0s",
                }}
              >
                {outgoingCard && (
                  <div className={oldCard ? "assembly-outgoing" : "assembly-replaced"}>
                    <PartSticker
                      card={outgoingCard}
                      template={template}
                      pack={pack}
                      mirrored={layer.socket.mirror}
                      fragmentId={layer.fragmentId}
                    />
                  </div>
                )}
                {layer.card ? (
                  <div
                    key={layer.card.id}
                    className={arriving.includes(layer.slotId) ? "assembly-incoming" : "assembly-part"}
                    data-align={layer.socket.align}
                  >
                    <PartSticker
                      card={layer.card}
                      template={template}
                      pack={pack}
                      thumbnail={size === "token"}
                      mirrored={layer.socket.mirror}
                      fragmentId={layer.fragmentId}
                    />
                  </div>
                ) : (
                  size !== "token" && (
                    <span className="assembly-empty" aria-hidden="true">
                      +
                    </span>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>
      {interactive && size !== "token" && (
        <div className="assembly-controls" style={{ aspectRatio: `${rig.frame[2]} / ${height}` }}>
          {layers
            .filter((layer) => !layer.card)
            .map((layer) => (
              <button
                key={layer.slotId}
                type="button"
                aria-label={`Добавить: ${layer.label}`}
                onClick={() => onSlotTap?.(layer.slotId)}
                style={boxStyle(layer)}
              />
            ))}
        </div>
      )}
      {size === "hero" && (
        <figcaption className="assembly-label">
          <span>
            ВИД ·{" "}
            {speciesName(template, preview ? { ...equipped, [preview.slotId]: preview.cardId } : equipped)}
          </span>
          {teamName && <span>{teamName}</span>}
        </figcaption>
      )}
    </figure>
  );
}
