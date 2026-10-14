import type { CardItem, GameTemplate } from "@stem/shared";
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
}

export function composeAssembly(
  template: GameTemplate,
  equipped: Record<string, string | null>,
  pack?: ArtPack | null,
  preview?: AssemblyPreview,
) {
  const rig = RIGS[template.objectRig];
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
          box: [(shelfIndex++ % 5) * 200, 1020 + Math.floor((shelfIndex - 1) / 5) * 200, 180, 180],
          align: "center",
          z: 0,
        });
    const current = cards.get(equipped[slot.id] ?? "");
    const candidate = preview?.slotId === slot.id ? cards.get(preview.cardId) : undefined;
    const validCurrent = current?.slotId === slot.id ? current : null;
    const isPreview = Boolean(candidate?.slotId === slot.id);
    return {
      slotId: slot.id,
      label: slot.label,
      socket,
      card: isPreview ? (candidate ?? null) : validCurrent,
      previousCard: isPreview ? validCurrent : null,
      isPreview,
      onShelf: !base,
    };
  });
  return {
    rig,
    layers: layers.sort((a, b) => a.socket.z - b.socket.z),
    height: 1000 + Math.ceil(shelfIndex / 5) * 220,
  };
}
