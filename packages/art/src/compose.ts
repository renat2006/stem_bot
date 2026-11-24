import type { CardItem, GameTemplate } from "@stem/shared";
import { buildDrawables, resolveAnchor } from "./projection.js";
import { RIGS } from "./rigs/index.js";
import { type ArtPack, type SlotSocket, SlotSocketSchema } from "./schema.js";

export interface AssemblyPreview {
  slotId: string;
  cardId: string;
}
export interface AssemblyLayer {
  slotId: string;
  label: string;
  socket: SlotSocket;
  card: CardItem | null;
  previousCard: CardItem | null;
  isPreview: boolean;
  onShelf: boolean;
  baseCard?: CardItem;
  support?: { left: number; right: number; top: number; leftFoot: number; rightFoot: number };
}

export function composeAssembly(
  template: GameTemplate,
  equipped: Record<string, string | null>,
  pack?: ArtPack | null,
  preview?: AssemblyPreview,
) {
  const rig = RIGS[template.objectRig];
  if (pack?.rig !== rig.id) pack = undefined;
  const cards = new Map(template.cards.map((card) => [card.id, card]));
  let shelfIndex = 0;
  const layers: AssemblyLayer[] = template.slots.map((slot) => {
    const base = rig.sockets.find((socket) => socket.slotId === slot.id);
    const override =
      pack?.rig === rig.id ? pack.rigOverrides.find((socket) => socket.slotId === slot.id) : undefined;
    const socket = base
      ? SlotSocketSchema.parse({ ...base, ...override })
      : SlotSocketSchema.parse({
          slotId: slot.id,
          box: [
            (shelfIndex++ % 5) * 200,
            rig.frame[1] + rig.frame[3] + 20 + Math.floor((shelfIndex - 1) / 5) * 200,
            180,
            180,
          ],
          align: "center",
          z: 0,
        });
    const current = cards.get(equipped[slot.id] ?? "");
    const candidate = preview?.slotId === slot.id ? cards.get(preview.cardId) : undefined;
    const validCurrent = current?.slotId === slot.id ? current : null;
    const isPreview = Boolean(candidate?.slotId === slot.id);
    const baseCard = cards.get(pack?.baseAppearance?.[slot.id] ?? "");
    return {
      baseCard: baseCard?.slotId === slot.id ? baseCard : undefined,
      slotId: slot.id,
      label: slot.label,
      socket,
      card: isPreview ? (candidate ?? null) : validCurrent,
      previousCard: isPreview ? validCurrent : null,
      isPreview,
      onShelf: !base,
    };
  });
  const resolved = new Set<string>();
  const resolving = new Set<string>();
  const place = (layer: AssemblyLayer) => {
    if (resolved.has(layer.slotId) || resolving.has(layer.slotId)) return;
    resolving.add(layer.slotId);
    const asset = pack?.parts.find((part) => part.cardId === (layer.card ?? layer.baseCard)?.id);
    if (asset?.contentBox) {
      const [, , naturalWidth, naturalHeight] = asset.contentBox;
      const [x, y, width, height] = layer.socket.box;
      const scale = Math.min(width / naturalWidth, height / naturalHeight);
      const fittedWidth = naturalWidth * scale;
      const fittedHeight = naturalHeight * scale;
      layer.socket.box = [
        x + (width - fittedWidth) / 2,
        y + (height - fittedHeight) / 2,
        fittedWidth,
        fittedHeight,
      ];
    }
    const reference = pack?.registeredPose?.[layer.slotId];
    if (reference?.socketBox && (!layer.card || layer.card.id === reference.cardId)) {
      layer.socket.box = reference.socketBox;
    }
    const attachment = layer.socket.attach;
    const parent = attachment
      ? layers.find((candidate) => candidate.slotId === attachment.parentSlotId)
      : undefined;
    if (attachment && parent && parent !== layer && !resolving.has(parent.slotId)) {
      place(parent);
      const [px, py, pw, ph] = parent.socket.box;
      const [, , width, height] = layer.socket.box;
      const parentAsset = pack?.parts.find((part) => part.cardId === (parent.card ?? parent.baseCard)?.id);
      const parentPoint = resolveAnchor(
        parentAsset,
        attachment.parentAnchor,
        attachment.parentPoint,
        parent.socket.mirror,
      );
      if (attachment.supportAnchors && layer.card) {
        const [l, r] = attachment.supportAnchors.map((name) => parentAsset?.anchors[name]);
        if (l && r)
          layer.support = {
            left: px + pw * l[0],
            right: px + pw * r[0],
            top: py + ph * parentPoint[1],
            leftFoot: py + ph * l[1],
            rightFoot: py + ph * r[1],
          };
      }
      const partPoint = resolveAnchor(
        asset,
        attachment.partAnchor,
        attachment.partPoint,
        layer.socket.mirror,
      );
      layer.socket.box = [
        px + pw * parentPoint[0] - width * partPoint[0],
        py + ph * parentPoint[1] - height * partPoint[1],
        width,
        height,
      ];
    }
    resolving.delete(layer.slotId);
    resolved.add(layer.slotId);
  };
  for (const layer of layers) place(layer);
  return {
    rig,
    drawables: buildDrawables(layers, pack, rig),
    layers: layers.sort((a, b) => a.socket.z - b.socket.z),
    height: rig.frame[3] + Math.ceil(shelfIndex / 5) * 220,
  };
}
