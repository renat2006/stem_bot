import { NEUROFAUNA_TEMPLATE, ROVER_SPRINT_TEMPLATE } from "@stem/shared";
import { describe, expect, it } from "vitest";
import manifest from "../packs/neurofauna/manifest.json";
import roverManifest from "../packs/rovers/manifest.json";
import { composeAssembly } from "./compose.js";
import { keyMagenta } from "./processing.js";
import { buildAssetPrompts } from "./prompts/index.js";
import { ArtPackSchema } from "./schema.js";
import { validateArtCoverage, validateAssetSize } from "./validation.js";

function fixture(left = 3, top = 3) {
  const pixels = new Uint8Array(12 * 12 * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([255, 0, 255, 255], i);
  for (let y = top; y < top + 4; y++)
    for (let x = left; x < left + 4; x++) pixels.set([50, 120, 80, 255], (y * 12 + x) * 4);
  return pixels;
}

describe("chroma key processing", () => {
  it("removes magenta and finds foreground bounds without changing input", () => {
    const input = fixture();
    const result = keyMagenta(input, 12, 12);
    expect(result.bounds).toEqual({ left: 3, top: 3, width: 4, height: 4 });
    expect(result.pixels[3]).toBe(0);
    expect(result.pixels[(4 * 12 + 4) * 4 + 3]).toBe(255);
    expect(input[3]).toBe(255);
  });
  it("rejects clipped subjects and missing chroma key", () => {
    expect(() => keyMagenta(fixture(0, 3), 12, 12)).toThrow("edge");
    expect(() => keyMagenta(new Uint8Array(12 * 12 * 4).fill(255), 12, 12)).toThrow("25%");
    const empty = fixture();
    for (let i = 0; i < empty.length; i += 4) empty.set([255, 0, 255, 255], i);
    expect(() => keyMagenta(empty, 12, 12)).toThrow("No foreground");
  });
});

describe("asset prompts and validation", () => {
  const pack = ArtPackSchema.parse(manifest);
  it("builds deterministic separate prompts with attachment, stat and tier", () => {
    const prompts = buildAssetPrompts(NEUROFAUNA_TEMPLATE, pack);
    expect(prompts).toEqual(buildAssetPrompts(NEUROFAUNA_TEMPLATE, pack));
    const head = prompts.find((p) => p.id === "lion-head");
    expect(head?.prompt).toContain("LOWER LEFT");
    expect(head?.prompt).toContain("Tier II");
    expect(head?.prompt).toContain("Сила");
    expect(head?.prompt).toContain("modular expedition model kit");
    expect(new Set(prompts.map((p) => p.id)).size).toBe(prompts.length);
    expect(prompts.filter((p) => p.kind === "part")).toHaveLength(NEUROFAUNA_TEMPLATE.cards.length);
  });
  it("detects missing cards, icons and weight violations", () => {
    const missing = validateArtCoverage(
      { ...pack, parts: [], perks: {}, stats: {}, cells: {}, currency: "" },
      NEUROFAUNA_TEMPLATE,
    );
    expect(missing).toContain("Missing card: lion-head");
    expect(missing).toContain("Missing stat: speed");
    expect(missing).toContain("Missing currency");
    expect(validateAssetSize("part.webp", 35001, 35000)).toContain("exceeds");
    expect(validateAssetSize("part.webp", 35000, 35000)).toBeNull();
  });
});

describe("printed specimen attachment geometry", () => {
  it("joins each child to the body after fitting its visible image bounds", async () => {
    const { composeAssembly } = await import("./compose.js");
    const pack = ArtPackSchema.parse(manifest);
    const equipped = {
      head: "lion-head",
      body: "shark-body",
      front: "scorpion-claws",
      back: "lion-back",
      tail: "crocodile-tail",
      special: "turtle-shell",
    };
    const scene = composeAssembly(NEUROFAUNA_TEMPLATE, equipped, pack);
    const body = scene.layers.find((layer) => layer.slotId === "body");
    if (!body) throw new Error("Missing body");
    for (const layer of scene.layers) {
      const attach = layer.socket.attach;
      if (!attach) continue;
      const [x, y, w, h] = layer.socket.box;
      const [px, py, pw, ph] = body.socket.box;
      expect(x + w * attach.partPoint[0]).toBeCloseTo(px + pw * attach.parentPoint[0]);
      expect(y + h * attach.partPoint[1]).toBeCloseTo(py + ph * attach.parentPoint[1]);
    }
    expect(scene.rig.frame[3]).toBeLessThan(1000);
    expect(equipped.body).toBe("shark-body");
  });
});

describe("layered limbs", () => {
  it("keeps far limbs behind the body and near limbs in front on a common ground", async () => {
    const { composeAssembly } = await import("./compose.js");
    const pack = ArtPackSchema.parse(manifest);
    const scene = composeAssembly(
      NEUROFAUNA_TEMPLATE,
      {
        body: "shark-body",
        front: "scorpion-claws",
        back: "lion-back",
      },
      pack,
    );
    const body = scene.drawables.find((layer) => layer.slotId === "body");
    if (!body) throw new Error("Missing body");
    const limbs = scene.drawables.filter((layer) => layer.fragmentId);
    expect(limbs).toHaveLength(4);
    for (const limb of limbs) {
      const fragment = pack.parts.find((part) => part.cardId === limb.card?.id)?.fragments[0];
      if (!fragment) throw new Error("Missing fragment");
      expect(limb.socket.z < body.socket.z).toBe(limb.plane === "far");
      expect(limb.socket.box[1] + limb.socket.box[3] * fragment.contact[1]).toBeCloseTo(
        (scene.rig.groundY ?? 0) - (limb.plane === "far" ? 26 : 0),
      );
    }
  });
  it("reflects named image anchors and preserves rig fallbacks", async () => {
    const { resolveAnchor } = await import("./projection.js");
    const asset = ArtPackSchema.parse(manifest).parts.find((part) => part.cardId === "shark-body");
    expect(resolveAnchor(asset, "neck", [0, 0], true)[0]).toBeCloseTo(0.06);
    expect(resolveAnchor(asset, "absent", [0.2, 0.3], true)).toEqual([0.2, 0.3]);
  });
  it("replaces both planes in a preview without changing equipment", async () => {
    const { composeAssembly } = await import("./compose.js");
    const equipped = { body: "lion-body", front: "scorpion-claws" };
    const scene = composeAssembly(NEUROFAUNA_TEMPLATE, equipped, ArtPackSchema.parse(manifest), {
      slotId: "front",
      cardId: "eagle-claws",
    });
    expect(scene.drawables.filter((layer) => layer.isPreview).map((layer) => layer.card?.id)).toEqual([
      "eagle-claws",
      "eagle-claws",
    ]);
    expect(equipped.front).toBe("scorpion-claws");
  });
});

describe("starter appearance", () => {
  it("mounts the base wheels twice while keeping inventory and empty slots intact", () => {
    const pack = ArtPackSchema.parse(roverManifest);
    const scene = composeAssembly(ROVER_SPRINT_TEMPLATE, {}, pack);
    expect(scene.layers.every((layer) => layer.card === null)).toBe(true);
    const wheels = scene.drawables.filter((layer) => layer.slotId === "drive");
    expect(wheels).toHaveLength(2);
    expect(wheels.every((layer) => layer.isBase)).toBe(true);
    expect(wheels[1]?.socket.box[0]).toBeGreaterThan(wheels[0]?.socket.box[0] ?? 0);
    const swap = composeAssembly(ROVER_SPRINT_TEMPLATE, {}, pack, {
      slotId: "drive",
      cardId: "kevlar-tracks",
    });
    expect(
      swap.drawables
        .filter((layer) => layer.slotId === "drive")
        .every((layer) => layer.card?.id === "kevlar-tracks" && !layer.isBase),
    ).toBe(true);
  });
});

it("keeps unmodified pieces in their reference pose when a team replaces a limb", () => {
  const pack = ArtPackSchema.parse(manifest);
  const start = composeAssembly(NEUROFAUNA_TEMPLATE, {}, pack);
  expect(start.drawables.filter((d) => d.poseSrc)).toHaveLength(5);
  const changed = composeAssembly(NEUROFAUNA_TEMPLATE, { front: "scorpion-claws" }, pack);
  expect(changed.drawables.filter((d) => d.poseSrc)).toHaveLength(4);
  expect(changed.drawables.filter((d) => d.slotId === "front" && d.fragmentId)).toHaveLength(2);
});
it("uses the selected chassis shape for the sensor support", () => {
  const pack = ArtPackSchema.parse(roverManifest);
  const support = (id: string) =>
    composeAssembly(ROVER_SPRINT_TEMPLATE, { chassis: id, sensors: "stereo-lidar" }, pack).layers.find(
      (l) => l.slotId === "sensors",
    )?.support;
  const arch = support("titan-exoframe");
  expect(arch).toBeDefined();
  expect(arch?.leftFoot).toBeGreaterThan(arch?.rightFoot ?? 0);
  expect(arch?.top).not.toBe(support("alu-frame")?.top);
});
