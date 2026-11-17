import { type AssemblyLayer, type AssemblyPreview, composeAssembly, speciesName } from "@stem/art";
import type { GameTemplate } from "@stem/shared";
import { hapticFeedback } from "@tma.js/sdk-react";
import { Pause, Play } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { areHapticsEnabled, useMotionEnabled } from "../../../shared/lib/index.js";
import { useArtPack } from "../model/use-art-pack.js";
import { PartSticker } from "./part-sticker.js";
import "./assembly.css";

interface AssemblyStageProps {
  template: GameTemplate;
  equipped: Record<string, string | null>;
  size?: "hero" | "card" | "token";
  preview?: AssemblyPreview;
  interactive?: boolean;
  selectedSlotId?: string | null;
  onSlotTap?: (slotId: string) => void;
  teamName?: string;
}

const RIG_CAPTION: Record<string, string> = {
  creature: "ВИД",
  rover: "РОВЕР",
  airship: "БОРТ",
  campus: "ПРОЕКТ",
};

export function AssemblyStage({
  template,
  equipped,
  size = "hero",
  preview,
  interactive = false,
  selectedSlotId,
  onSlotTap,
  teamName,
}: AssemblyStageProps) {
  const pack = useArtPack(template.artPackId);
  const motionEnabled = useMotionEnabled();
  const [paused, setPaused] = useState(false);
  const [recoilTick, setRecoilTick] = useState(0);
  const { rig, layers, drawables, height } = composeAssembly(template, equipped, pack, preview);
  const equipmentKey = JSON.stringify(template.slots.map((slot) => [slot.id, equipped[slot.id] ?? null]));
  const previousTemplateId = useRef(template.id);
  const previous = useRef(equipped);

  const lowPower =
    typeof navigator !== "undefined" &&
    /Android/i.test(navigator.userAgent) &&
    navigator.hardwareConcurrency <= 4;

  const canAnimate = motionEnabled && !paused && !lowPower && size !== "token";

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
    previous.current = current;
    if (changed.some((slot) => current[slot.id])) {
      setRecoilTick((n) => n + 1);
      if (areHapticsEnabled() && hapticFeedback.impactOccurred.isAvailable()) {
        hapticFeedback.impactOccurred("medium");
      }
    }
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

  const boxStyle = (layer: AssemblyLayer): CSSProperties => ({
    transform: `rotate(${layer.socket.rotation}deg)`,
    left: `${((layer.socket.box[0] - rig.frame[0]) / rig.frame[2]) * 100}%`,
    top: `${((layer.socket.box[1] - rig.frame[1]) / height) * 100}%`,
    width: `${(layer.socket.box[2] / rig.frame[2]) * 100}%`,
    height: `${(layer.socket.box[3] / height) * 100}%`,
    zIndex: layer.socket.z + 1,
    transformOrigin: `${layer.socket.pivot[0] * 100}% ${layer.socket.pivot[1] * 100}%`,
  });

  const captionPrefix = RIG_CAPTION[rig.id] ?? "МОДЕЛЬ";

  return (
    <figure
      className={`assembly-stage assembly-stage--${size}`}
      data-low-power={lowPower || undefined}
      data-paused={paused || undefined}
      data-rig={rig.id}
      aria-label={label}
    >
      {size === "hero" && motionEnabled && !lowPower && (
        <button
          type="button"
          className="assembly-pause-btn"
          onClick={() => setPaused((v) => !v)}
          aria-label={paused ? "Запустить анимацию стенда" : "Поставить анимацию стенда на паузу"}
          title={paused ? "Запустить анимацию" : "Пауза анимации"}
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>
      )}
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
          {rig.id === "rover" && <path d="M80 865 L320 852 L680 868 L920 848" className="assembly-horizon" />}
          <path d={rig.ghostPath} />
          <path d="M25 90 V25 H90 M910 25 H975 V90 M25 910 V975 H90 M910 975 H975 V910" />
        </svg>
        <motion.div
          key={recoilTick}
          className="assembly-life"
          initial={canAnimate && recoilTick > 0 ? { y: 6, scale: 0.992 } : false}
          animate={{ y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
        >
          {drawables.map((layer) => (
            <div
              key={layer.id}
              data-plane={layer.plane}
              className="assembly-socket"
              data-preview={layer.isPreview || undefined}
              data-selected={selectedSlotId === layer.slotId || undefined}
              data-shelf={layer.onShelf || undefined}
              style={{
                ...boxStyle(layer),
                opacity: layer.opacity,
              }}
            >
              <div
                className={`assembly-motion-inner assembly-motion--${layer.socket.motion}`}
                style={{
                  animationDelay: layer.plane === "far" ? "-2.9s" : `${layer.socket.z * -0.35}s`,
                }}
              >
                {layer.previousCard && (
                  <div className="assembly-replaced">
                    <PartSticker
                      card={layer.previousCard}
                      template={template}
                      pack={pack}
                      mirrored={layer.socket.mirror}
                      fragmentId={layer.fragmentId}
                    />
                  </div>
                )}
                <AnimatePresence mode="popLayout" initial={false}>
                  {layer.card ? (
                    <motion.div
                      key={layer.card.id}
                      className="assembly-part"
                      data-align={layer.socket.align}
                      initial={canAnimate ? { opacity: 0, scale: 1.14, y: -14 } : false}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={canAnimate ? { opacity: 0, scale: 0.88, y: 12 } : { opacity: 0 }}
                      transition={{ type: "spring", stiffness: 360, damping: 24 }}
                    >
                      <PartSticker
                        card={layer.card}
                        template={template}
                        pack={pack}
                        thumbnail={size === "token"}
                        mirrored={layer.socket.mirror}
                        fragmentId={layer.fragmentId}
                      />
                    </motion.div>
                  ) : (
                    size !== "token" && (
                      <div key="empty" className="assembly-empty" aria-hidden="true">
                        <span className="assembly-empty-pill">+</span>
                      </div>
                    )
                  )}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
      {interactive && size !== "token" && (
        <div className="assembly-controls" style={{ aspectRatio: `${rig.frame[2]} / ${height}` }}>
          {layers.map((layer) => (
            <button
              key={layer.slotId}
              type="button"
              aria-label={
                layer.card
                  ? `${layer.label}: ${layer.card.name} — выбрать слот`
                  : `Добавить в слот «${layer.label}»`
              }
              onClick={() => onSlotTap?.(layer.slotId)}
              style={boxStyle(layer)}
            />
          ))}
        </div>
      )}
      {size === "hero" && (
        <figcaption className="assembly-label">
          <span>
            {captionPrefix} ·{" "}
            {speciesName(template, preview ? { ...equipped, [preview.slotId]: preview.cardId } : equipped)}
          </span>
          {teamName && <span>{teamName}</span>}
        </figcaption>
      )}
    </figure>
  );
}
