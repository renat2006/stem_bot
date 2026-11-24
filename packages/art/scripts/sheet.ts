import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { DEFAULT_TEMPLATES } from "@stem/shared";
import { composeAssembly } from "../src/compose.js";
import { ArtPackSchema } from "../src/schema.js";

const { values } = parseArgs({ options: { pack: { type: "string" } } });
const template = DEFAULT_TEMPLATES.find((t) => t.artPackId === values.pack);
if (!template?.artPackId) throw new Error("Specify --pack <packId>");
const directory = new URL(`../packs/${template.artPackId}/`, import.meta.url);
const pack = ArtPackSchema.parse(JSON.parse(await readFile(new URL("manifest.json", directory), "utf8")));
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
const parts = template.cards
  .map((card) => {
    const part = pack.parts.find((p) => p.cardId === card.id);
    return `<article><h3>${escapeHtml(card.name)}</h3><div class="row"><div class="light">${part ? `<img src="${part.src}" alt="${escapeHtml(card.name)}">` : "MISSING"}</div><div class="dark">${part ? `<img src="${part.src}" alt="${escapeHtml(card.name)}">` : "MISSING"}</div></div></article>`;
  })
  .join("");
const scenes = Array.from({ length: 5 }, (_, index) => {
  const equipped = Object.fromEntries(
    template.slots.map((slot) => {
      const cards = template.cards.filter((c) => c.slotId === slot.id);
      return [slot.id, cards[index % cards.length]?.id ?? null];
    }),
  );
  const scene = composeAssembly(template, equipped, pack);
  return `<div class="scene" style="aspect-ratio:${scene.rig.frame[2]}/${scene.height}">${scene.drawables
    .map((layer) => {
      if (layer.poseSrc) {
        const [x, y, w, h] = layer.socket.box;
        return `<img src="${layer.poseSrc}" alt="${escapeHtml(layer.label)}" style="position:absolute;left:${((x - scene.rig.frame[0]) / scene.rig.frame[2]) * 100}%;top:${((y - scene.rig.frame[1]) / scene.height) * 100}%;width:${(w / scene.rig.frame[2]) * 100}%;height:${(h / scene.height) * 100}%;z-index:${layer.socket.z}">`;
      }
      const asset = pack.parts.find((part) => part.cardId === layer.card?.id);
      if (!asset) return "";
      const image = asset.fragments.find((fragment) => fragment.id === layer.fragmentId) ?? asset;
      const box = image.contentBox ?? [0, 0, 512, 512];
      return `<svg role="img" aria-label="${escapeHtml(layer.card?.name ?? layer.label)}" viewBox="${box.join(" ")}" style="position:absolute;left:${((layer.socket.box[0] - scene.rig.frame[0]) / scene.rig.frame[2]) * 100}%;top:${((layer.socket.box[1] - scene.rig.frame[1]) / scene.height) * 100}%;width:${(layer.socket.box[2] / scene.rig.frame[2]) * 100}%;height:${(layer.socket.box[3] / scene.height) * 100}%;z-index:${layer.socket.z};opacity:${layer.opacity};transform-origin:${layer.socket.pivot.map((v) => `${v * 100}%`).join(" ")};transform:rotate(${layer.socket.rotation}deg)"><image href="${image.src}" width="512" height="512" transform="${layer.socket.mirror ? `translate(${box[0] * 2 + box[2]},0) scale(-1,1)` : ""}"/></svg>`;
    })
    .join("")}</div>`;
}).join("");
await writeFile(
  new URL("contact-sheet.html", directory),
  `<!doctype html><html lang="ru"><meta charset="utf-8"><title>${escapeHtml(pack.id)} · каталог деталей</title><style>body{font:14px system-ui;background:#ece9e1;color:#202629;padding:24px}h1{font-size:28px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}article{background:#fff;padding:12px;border-radius:12px}h3{margin:0 0 12px}.row{display:flex}.row>div{width:50%;padding:8px}.light{background:#faf8f0}.dark,.scene{background:#181c1f}.row img{width:100%}.scene{position:relative;background:#e9e5d7;aspect-ratio:1;border-radius:16px;border:1px solid #bbc1bd}.scenes{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:24px}svg{overflow:visible;filter:none}</style><h1>${escapeHtml(pack.id)} · Каталог деталей</h1><p>Пять сборок и детали на светлом/тёмном фоне. ${pack.parts.length} карт.</p><div class="scenes">${scenes}</div><div class="grid">${parts}</div></html>`,
);
process.stdout.write(`Contact sheet written for ${pack.id}\n`);
