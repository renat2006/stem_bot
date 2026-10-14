import { z } from "zod";

export const SlotSocketSchema = z.object({
  slotId: z.string().min(1),
  box: z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]),
  align: z.enum(["center", "bottom", "top", "left", "right"]),
  z: z.number().int(),
  motion: z.enum(["none", "bob", "sway", "pulse", "flap"]).default("none"),
  pivot: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).default([0.5, 0.5]),
  mirror: z.boolean().default(false),
  rotation: z.number().min(-180).max(180).default(0),
  attach: z
    .object({
      parentSlotId: z.string().min(1),
      parentAnchor: z.string().optional(),
      partAnchor: z.string().optional(),
      parentPoint: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
      partPoint: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
    })
    .optional(),
});

export const RigSchema = z.object({
  id: z.enum(["creature", "airship", "campus"]),
  viewBox: z.literal("0 0 1000 1000"),
  frame: z
    .tuple([z.number(), z.number(), z.number().positive(), z.number().positive()])
    .default([0, 0, 1000, 1000]),
  groundY: z.number().optional(),
  ghostPath: z.string(),
  sockets: z.array(SlotSocketSchema),
  shadow: z.object({ cx: z.number(), cy: z.number(), rx: z.number(), ry: z.number() }),
});

const AssetPathSchema = z.string().regex(/^assets\/[a-zA-Z0-9_-]+\.[a-f0-9]{8,}\.webp$/);
const PointSchema = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
const ContentBoxSchema = z.tuple([
  z.number().nonnegative(),
  z.number().nonnegative(),
  z.number().positive(),
  z.number().positive(),
]);
export const PartFragmentSchema = z.object({
  id: z.string().min(1),
  src: AssetPathSchema,
  thumb: AssetPathSchema,
  width: z.number().positive(),
  height: z.number().positive(),
  contentBox: ContentBoxSchema,
  anchor: PointSchema.default([0.5, 0.05]),
  contact: PointSchema.default([0.5, 0.97]),
  paired: z.boolean().default(true),
  grounded: z.boolean().default(true),
  restAngle: z.number().min(-180).max(180).default(0),
});
export const PartAssetSchema = z.object({
  cardId: z.string().min(1),
  anchors: z.record(z.string(), PointSchema).default({}),
  fragments: z
    .array(PartFragmentSchema)
    .default([])
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length, "Duplicate fragment"),
  src: AssetPathSchema,
  thumb: AssetPathSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  promptId: z.string().min(1),
  contentBox: z
    .tuple([z.number().nonnegative(), z.number().nonnegative(), z.number().positive(), z.number().positive()])
    .optional(),
});

export const ArtPackSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().positive(),
  rig: RigSchema.shape.id,
  palette: z
    .record(z.string(), z.string().regex(/^#[0-9A-F]{6}$/i))
    .refine(
      (palette) => !Object.values(palette).some((color) => color.toUpperCase() === "#FF00FF"),
      "Chroma key is not a palette color",
    ),
  rigOverrides: z.array(SlotSocketSchema.partial().required({ slotId: true })).default([]),
  parts: z
    .array(PartAssetSchema)
    .refine(
      (parts) => new Set(parts.map((part) => part.cardId)).size === parts.length,
      "Duplicate card asset",
    ),
  perks: z.record(z.string(), AssetPathSchema),
  stats: z.record(z.string(), AssetPathSchema),
  currency: z.union([AssetPathSchema, z.literal("")]),
  cells: z.record(z.string(), AssetPathSchema),
  covers: z.object({ hero: AssetPathSchema, story: AssetPathSchema }).partial(),
  emptyStates: z.partialRecord(z.enum(["noTeam", "waiting", "marketClosed", "summary"]), AssetPathSchema),
});

export type SlotSocket = z.infer<typeof SlotSocketSchema>;
export type Rig = z.infer<typeof RigSchema>;
export type PartAsset = z.infer<typeof PartAssetSchema>;
export type ArtPack = z.infer<typeof ArtPackSchema>;
