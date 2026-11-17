import type { AssemblyLayer } from "./compose.js";
import type { ArtPack, PartAsset, Rig } from "./schema.js";

export interface AssemblyDrawable extends AssemblyLayer {
  id: string;
  plane: "single" | "near" | "far";
  fragmentId?: string;
  opacity: number;
}

export function resolveAnchor(
  asset: PartAsset | undefined,
  name: string | undefined,
  fallback: [number, number],
  mirrored: boolean,
): [number, number] {
  const point = name ? asset?.anchors[name] : undefined;
  return point ? [mirrored ? 1 - point[0] : point[0], point[1]] : fallback;
}

export function buildDrawables(
  layers: AssemblyLayer[],
  pack: ArtPack | null | undefined,
  rig: Rig,
): AssemblyDrawable[] {
  return layers
    .flatMap<AssemblyDrawable>((layer) => {
      const asset = pack?.parts.find((part) => part.cardId === layer.card?.id);
      const fragments = asset?.fragments ?? [];
      const attach = layer.socket.attach;
      const parent = layers.find((candidate) => candidate.slotId === attach?.parentSlotId);
      if (!fragments.length || !attach || !parent || !rig.groundY)
        return [{ ...layer, id: layer.slotId, plane: "single" as const, opacity: 1 }];
      const parentAsset = pack?.parts.find((part) => part.cardId === parent.card?.id);
      const point = resolveAnchor(parentAsset, attach.parentAnchor, attach.parentPoint, parent.socket.mirror);
      const [px, py, pw, ph] = parent.socket.box;
      return fragments.flatMap((fragment) =>
        (fragment.paired ? (["far", "near"] as const) : (["near"] as const)).map((plane) => {
          const far = plane === "far";
          const rootX = px + pw * point[0] + (far ? 36 : 0);
          const rootY = py + ph * point[1] - (far ? 18 : 0);
          const ground = rig.groundY ?? 810;
          const height = fragment.grounded
            ? Math.max(
                70,
                (ground - (far ? 26 : 0) - rootY) / Math.max(0.2, fragment.contact[1] - fragment.anchor[1]),
              )
            : layer.socket.box[3] * (far ? 0.88 : 1);
          const width = Math.min(
            layer.socket.box[2] * 1.2,
            ((height * fragment.contentBox[2]) / fragment.contentBox[3]) * (far ? 0.88 : 1),
          );
          const anchor: [number, number] = [
            layer.socket.mirror ? 1 - fragment.anchor[0] : fragment.anchor[0],
            fragment.anchor[1],
          ];
          return {
            ...layer,
            id: `${layer.slotId}:${fragment.id}:${plane}`,
            fragmentId: fragment.id,
            plane,
            opacity: far ? 0.64 : 1,
            socket: {
              ...layer.socket,
              z: far ? parent.socket.z - 1 : parent.socket.z + 1,
              motion: "sway" as const,
              rotation: fragment.restAngle,
              pivot: anchor,
              box: [rootX - width * anchor[0], rootY - height * anchor[1], width, height] as [
                number,
                number,
                number,
                number,
              ],
            },
          };
        }),
      );
    })
    .sort((a, b) => a.socket.z - b.socket.z);
}
