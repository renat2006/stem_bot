import type { AssemblyLayer } from "./compose.js";
import type { ArtPack, PartAsset, Rig } from "./schema.js";

export interface AssemblyDrawable extends AssemblyLayer {
  id: string;
  plane: "single" | "near" | "far";
  fragmentId?: string;
  opacity: number;
  isBase?: boolean;
  poseSrc?: string;
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
    .map((layer) => ({
      ...layer,
      isBase: !layer.card && Boolean(layer.baseCard),
      card: layer.card ?? layer.baseCard ?? null,
    }))
    .flatMap<AssemblyDrawable>((layer, _, visibleLayers) => {
      const pose = pack?.registeredPose?.[layer.slotId];
      const referenceBody = pack?.registeredPose?.[pack.poseRoot ?? ""];
      const body = visibleLayers.find((item) => item.slotId === pack?.poseRoot);
      if (
        pose &&
        referenceBody &&
        (body?.isBase || body?.card?.id === referenceBody.cardId) &&
        (layer.isBase || layer.card?.id === pose.cardId)
      ) {
        return [
          {
            ...layer,
            id: layer.slotId,
            plane: "single",
            opacity: 1,
            poseSrc: pose.src,
            socket: {
              ...layer.socket,
              box: pose.box,
              z: pose.z ?? layer.socket.z,
              rotation: 0,
              motion: "none",
            },
          },
        ];
      }
      const asset = pack?.parts.find((part) => part.cardId === layer.card?.id);
      const fragments = asset?.fragments ?? [];
      const attach = layer.socket.attach;
      const parent = visibleLayers.find((candidate) => candidate.slotId === attach?.parentSlotId);
      if (asset?.additionalMounts?.length && parent && attach) {
        const [px, py, pw, ph] = parent.socket.box;
        const [, , w, h] = layer.socket.box;
        const joint = resolveAnchor(asset, attach.partAnchor, attach.partPoint, layer.socket.mirror);
        const primary: AssemblyDrawable = { ...layer, id: layer.slotId, plane: "single", opacity: 1 };
        return [
          primary,
          ...asset.additionalMounts.map(
            ([u, v], i): AssemblyDrawable => ({
              ...primary,
              id: `${layer.slotId}-mount-${i}`,
              socket: {
                ...layer.socket,
                box: [px + pw * u - w * joint[0], py + ph * v - h * joint[1], w, h],
              },
            }),
          ),
        ];
      }
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
          const width = (height * fragment.contentBox[2]) / fragment.contentBox[3];
          const anchor: [number, number] = [
            layer.socket.mirror ? 1 - fragment.anchor[0] : fragment.anchor[0],
            fragment.anchor[1],
          ];
          return {
            ...layer,
            id: `${layer.slotId}:${fragment.id}:${plane}`,
            fragmentId: fragment.id,
            plane,
            opacity: 1,
            socket: {
              ...layer.socket,
              z: far ? parent.socket.z - 1 : parent.socket.z + 1,
              motion: layer.socket.motion,
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
