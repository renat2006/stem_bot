import { DEFAULT_TEMPLATES, GameTemplateSchema, NEUROFAUNA_TEMPLATE } from "@stem/shared";
import { describe, expect, it } from "vitest";
import airship from "../packs/airship/manifest.json";
import neurofauna from "../packs/neurofauna/manifest.json";
import startup from "../packs/startup/manifest.json";
import { composeAssembly } from "./compose.js";
import { proceduralPart } from "./procedural/index.js";
import { RIGS } from "./rigs/index.js";
import { ArtPackSchema } from "./schema.js";
import { speciesName } from "./species-name.js";

const manifests = [neurofauna, airship, startup];

describe("art pack contract", () => {
  it("validates the three procedural manifests and rig sockets against their templates", () => {
    for (const template of DEFAULT_TEMPLATES) {
      const pack = ArtPackSchema.parse(manifests.find((m) => m.id === template.artPackId));
      expect(pack.rig).toBe(template.objectRig);
      expect(new Set(RIGS[pack.rig].sockets.map((s) => s.slotId))).toEqual(
        new Set(template.slots.map((s) => s.id)),
      );
    }
  });
  it("rejects chroma-key, duplicate cards and unsafe asset paths", () => {
    expect(ArtPackSchema.safeParse({ ...neurofauna, palette: { bad: "#ff00ff" } }).success).toBe(false);
    const part = {
      cardId: "lion-head",
      src: "assets/lion.12345678.webp",
      thumb: "assets/lion-thumb.12345678.webp",
      width: 512,
      height: 512,
      promptId: "lion-head",
    };
    expect(ArtPackSchema.safeParse({ ...neurofauna, parts: [part, part] }).success).toBe(false);
    expect(
      ArtPackSchema.safeParse({ ...neurofauna, parts: [{ ...part, src: "../../private" }] }).success,
    ).toBe(false);
  });
  it("keeps older templates compatible", () => {
    const { objectRig: _rig, artPackId: _pack, ...old } = NEUROFAUNA_TEMPLATE;
    expect(GameTemplateSchema.parse(old).objectRig).toBe("creature");
  });
});

describe("procedural art", () => {
  it("renders every current card deterministically without an art pack", () => {
    for (const template of DEFAULT_TEMPLATES) {
      for (const card of template.cards) {
        const svg = proceduralPart(card, template);
        expect(svg).toBe(proceduralPart(card, template));
        expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
        expect(svg).not.toMatch(/undefined|NaN|<script/);
      }
    }
  });
  it("uses different silhouettes for different slots and variants for ids", () => {
    const card = NEUROFAUNA_TEMPLATE.cards[0];
    if (!card) throw new Error("Missing fixture");
    expect(proceduralPart(card, NEUROFAUNA_TEMPLATE)).not.toBe(
      proceduralPart({ ...card, slotId: "tail" }, NEUROFAUNA_TEMPLATE),
    );
    const variants = new Set(
      Array.from({ length: 12 }, (_, i) =>
        proceduralPart({ ...card, id: `variant-${i}` }, NEUROFAUNA_TEMPLATE),
      ),
    );
    expect(variants.size).toBeGreaterThan(1);
  });
  it("does not interpolate arbitrary stat colors into SVG", () => {
    const card = NEUROFAUNA_TEMPLATE.cards[0];
    if (!card) throw new Error("Missing fixture");
    const svg = proceduralPart(card, {
      ...NEUROFAUNA_TEMPLATE,
      stats: NEUROFAUNA_TEMPLATE.stats.map((s) => ({ ...s, color: '"><script>alert(1)</script>' })),
    });
    expect(svg).not.toContain("<script>");
  });
});

describe("composition", () => {
  it("sorts layers by z and puts unknown slots on a shelf", () => {
    const template = {
      ...NEUROFAUNA_TEMPLATE,
      slots: [...NEUROFAUNA_TEMPLATE.slots, { id: "custom", label: "Custom" }],
    };
    const scene = composeAssembly(template, {});
    expect(scene.layers.map((l) => l.socket.z)).toEqual(
      scene.layers.map((l) => l.socket.z).sort((a, b) => a - b),
    );
    expect(scene.layers.find((l) => l.slotId === "custom")?.onShelf).toBe(true);
    expect(scene.height).toBe(1220);
  });
  it("previews exactly one slot without mutating equipment", () => {
    const equipped = { head: "lion-head", body: "lion-body" };
    const scene = composeAssembly(NEUROFAUNA_TEMPLATE, equipped, null, {
      slotId: "body",
      cardId: "shark-body",
    });
    expect(scene.layers.filter((l) => l.isPreview).map((l) => l.slotId)).toEqual(["body"]);
    expect(scene.layers.find((l) => l.slotId === "body")?.previousCard?.id).toBe("lion-body");
    expect(equipped.body).toBe("lion-body");
    const invalid = composeAssembly(NEUROFAUNA_TEMPLATE, equipped, null, {
      slotId: "body",
      cardId: "lion-head",
    });
    expect(invalid.layers.some((l) => l.isPreview)).toBe(false);
  });
  it("ignores mismatched rigs and preserves supplied overrides", () => {
    const pack = ArtPackSchema.parse({ ...neurofauna, rigOverrides: [{ slotId: "head", z: 10 }] });
    expect(composeAssembly(NEUROFAUNA_TEMPLATE, {}, pack).layers.at(-1)?.slotId).toBe("head");
    expect(composeAssembly(NEUROFAUNA_TEMPLATE, {}, { ...pack, rig: "campus" }).layers.at(-1)?.slotId).toBe(
      "special",
    );
  });
});

describe("species names", () => {
  it("joins creature roots", () => {
    const template = {
      ...NEUROFAUNA_TEMPLATE,
      cards: [
        ...NEUROFAUNA_TEMPLATE.cards,
        {
          id: "scorpion-tail",
          name: "Хвост скорпиона",
          slotId: "tail",
          stats: {},
          price: 1,
          tier: 1,
          stock: 1,
          dayAvailable: 1,
          trackBonus: 0,
        },
      ],
    };
    expect(speciesName(template, { head: "lion-head", body: "shark-body", tail: "scorpion-tail" })).toBe(
      "Львакулоскорп",
    );
    expect(speciesName(template, {})).toBe("Неизвестный вид");
  });
  it("names empty and assembled airships and campuses", () => {
    for (const template of DEFAULT_TEMPLATES.filter((t) => t.objectRig !== "creature")) {
      const equipped = Object.fromEntries(
        template.slots.map((slot) => [slot.id, template.cards.find((c) => c.slotId === slot.id)?.id ?? null]),
      );
      expect(speciesName(template, equipped)).toBe(speciesName(template, equipped));
      expect(speciesName(template, equipped)).not.toBe(speciesName(template, {}));
      expect(speciesName(template, equipped)).toMatch(
        template.objectRig === "campus" ? /Labs$/ : /^NX-\d+ «.+»$/,
      );
    }
  });
});
