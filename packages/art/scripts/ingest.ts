import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { keyMagenta } from "../src/processing.js";
import type { AssetPrompt } from "../src/prompts/index.js";
import { ArtPackSchema } from "../src/schema.js";

const { values } = parseArgs({
  options: { pack: { type: "string" }, only: { type: "string" }, fragment: { type: "string" } },
});
if (values.fragment && (!values.only || !/^[a-z0-9-]+$/.test(values.fragment)))
  throw new Error("Fragments require --only <cardId> and a safe fragment name");
if (!values.pack || !/^[a-z0-9-]+$/.test(values.pack)) throw new Error("Specify --pack <packId>");
const directory = new URL(`../packs/${values.pack}/`, import.meta.url);
const manifestUrl = new URL("manifest.json", directory);
const pack = ArtPackSchema.parse(JSON.parse(await readFile(manifestUrl, "utf8")));
const prompts: AssetPrompt[] = (await readFile(new URL("prompts.jsonl", directory), "utf8"))
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
await mkdir(new URL("assets/", directory), { recursive: true });
for (const prompt of prompts.filter((p) => !values.only || p.id === values.only)) {
  const master = new URL(
    `masters/${prompt.id}${values.fragment ? `-${values.fragment}` : ""}.png`,
    directory,
  );
  if (prompt.kind === "cover") {
    const size = prompt.id === "cover-hero" ? [1200, 630] : [1080, 1920];
    let quality = 82;
    let bytes = await sharp(await readFile(master))
      .resize(size[0], size[1], { fit: "cover" })
      .webp({ quality, effort: 6 })
      .toBuffer();
    while (bytes.length > 120000 && quality > 35) {
      quality -= 5;
      bytes = await sharp(await readFile(master))
        .resize(size[0], size[1], { fit: "cover" })
        .webp({ quality, effort: 6 })
        .toBuffer();
    }
    if (bytes.length > 120000) throw new Error(`${prompt.id}: exceeds 120 KB`);
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
    const src = `assets/${prompt.id}.${hash}.webp`;
    await writeFile(new URL(src, directory), bytes);
    if (prompt.id === "cover-hero") pack.covers.hero = src;
    else pack.covers.story = src;
    await writeFile(manifestUrl, `${JSON.stringify(ArtPackSchema.parse(pack), null, 2)}\n`);
    process.stdout.write(`${prompt.id}: ingested\n`);
    continue;
  }
  const { data, info } = await sharp(await readFile(master))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const keyed = keyMagenta(data, info.width, info.height);
  const image = sharp(keyed.pixels, { raw: { width: info.width, height: info.height, channels: 4 } }).extract(
    keyed.bounds,
  );
  const target = prompt.kind === "part" || prompt.kind === "empty" ? 512 : 256;
  const inside = Math.round(target * 0.88);
  const ratio = Math.min(inside / keyed.bounds.width, inside / keyed.bounds.height);
  const width = Math.max(1, Math.round(keyed.bounds.width * ratio));
  const height = Math.max(1, Math.round(keyed.bounds.height * ratio));
  const left = Math.floor((target - width) / 2);
  const top = Math.floor((target - height) / 2);
  const canvas = await image
    .resize(width, height)
    .extend({
      left,
      top,
      right: target - width - left,
      bottom: target - height - top,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const encode = async (size: number, limit: number, quality: number, suffix: string) => {
    let bytes = await sharp(canvas).resize(size, size).webp({ quality, effort: 6 }).toBuffer();
    while (bytes.length > limit && quality > 40) {
      quality -= 5;
      bytes = await sharp(canvas).resize(size, size).webp({ quality, effort: 6 }).toBuffer();
    }
    if (bytes.length > limit) throw new Error(`${prompt.id}: weight ${bytes.length} exceeds ${limit}`);
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
    const path = `assets/${prompt.id}${values.fragment ? `-${values.fragment}` : ""}${suffix}.${hash}.webp`;
    await writeFile(new URL(path, directory), bytes);
    return path;
  };
  const src = await encode(target, target === 512 ? 35000 : 10000, 82, "");
  if (prompt.kind === "part") {
    const thumb = await encode(256, 12000, 78, "-thumb");
    const existing = pack.parts.find((part) => part.cardId === prompt.id);
    if (values.fragment) {
      if (!existing) throw new Error("Ingest the card before its fragments");
      const fragment = {
        id: values.fragment,
        src,
        thumb,
        width: 512,
        height: 512,
        contentBox: [left, top, width, height] as [number, number, number, number],
        anchor: [0.5, 0.05] as [number, number],
        contact: [0.5, 0.97] as [number, number],
        paired: true,
        grounded: existing.fragments.find((item) => item.id === values.fragment)?.grounded ?? true,
        restAngle: existing.fragments.find((item) => item.id === values.fragment)?.restAngle ?? 0,
      };
      existing.fragments = [...existing.fragments.filter((part) => part.id !== values.fragment), fragment];
      await writeFile(manifestUrl, `${JSON.stringify(ArtPackSchema.parse(pack), null, 2)}\n`);
      process.stdout.write(`${prompt.id}/${values.fragment}: ingested\n`);
      continue;
    }
    pack.parts = pack.parts.filter((part) => part.cardId !== prompt.id);
    pack.parts.push({
      cardId: prompt.id,
      anchors: existing?.anchors ?? {},
      fragments: existing?.fragments ?? [],
      src,
      thumb,
      width: 512,
      height: 512,
      promptId: prompt.id,
      contentBox: [left, top, width, height],
    });
  } else if (prompt.kind === "perk") pack.perks[prompt.id.slice(5)] = src;
  else if (prompt.kind === "stat") pack.stats[prompt.id.slice(5)] = src;
  else if (prompt.kind === "cell") pack.cells[prompt.id.slice(5)] = src;
  else if (prompt.kind === "currency") pack.currency = src;
  else if (prompt.kind === "empty") {
    const key = prompt.id.slice(6) as "noTeam" | "waiting" | "marketClosed" | "summary";
    pack.emptyStates[key] = src;
  }
  await writeFile(manifestUrl, `${JSON.stringify(ArtPackSchema.parse(pack), null, 2)}\n`);
  process.stdout.write(`${prompt.id}: ingested\n`);
}
