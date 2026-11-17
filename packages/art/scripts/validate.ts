import { readFile, stat } from "node:fs/promises";
import { DEFAULT_TEMPLATES } from "@stem/shared";
import sharp from "sharp";
import { ArtPackSchema } from "../src/schema.js";
import { validateArtCoverage, validateAssetSize } from "../src/validation.js";

const errors: string[] = [];
for (const template of DEFAULT_TEMPLATES) {
  if (!template.artPackId) continue;
  const directory = new URL(`../packs/${template.artPackId}/`, import.meta.url);
  const pack = ArtPackSchema.parse(JSON.parse(await readFile(new URL("manifest.json", directory), "utf8")));
  const files = new Map<string, { limit: number; size: number; height?: number; alpha?: boolean }>();
  if (pack.covers.hero) files.set(pack.covers.hero, { limit: 120000, size: 1200, height: 630, alpha: false });
  if (pack.covers.story)
    files.set(pack.covers.story, { limit: 120000, size: 1080, height: 1920, alpha: false });
  if (pack.parts.length) {
    errors.push(...validateArtCoverage(pack, template));
    for (const part of pack.parts) {
      files.set(part.src, { limit: 35000, size: 512 });
      files.set(part.thumb, { limit: 12000, size: 256 });
      for (const fragment of part.fragments) {
        files.set(fragment.src, { limit: 35000, size: 512 });
        files.set(fragment.thumb, { limit: 12000, size: 256 });
        if (fragment.contact[1] <= fragment.anchor[1])
          errors.push(`${part.cardId}: contact must be below joint`);
      }
    }
    for (const src of [
      ...Object.values(pack.perks),
      ...Object.values(pack.stats),
      ...Object.values(pack.cells),
      pack.currency,
    ])
      if (src) files.set(src, { limit: 10000, size: 256 });
    for (const src of Object.values(pack.emptyStates)) if (src) files.set(src, { limit: 35000, size: 512 });
  } else if (!files.size) {
    process.stdout.write(`${pack.id}: procedural mode\n`);
    continue;
  }
  let total = 0;
  for (const [src, limits] of files) {
    try {
      const path = new URL(src, directory);
      const bytes = (await stat(path)).size;
      total += bytes;
      const error = validateAssetSize(src, bytes, limits.limit);
      if (error) errors.push(error);
      const metadata = await sharp(path.pathname).metadata();
      if (
        metadata.width !== limits.size ||
        metadata.height !== (limits.height ?? limits.size) ||
        (limits.alpha !== false && !metadata.hasAlpha)
      )
        errors.push(`${src}: expected ${limits.size}px square with alpha`);
    } catch {
      errors.push(`Missing or unreadable file: ${src}`);
    }
  }
  if (total > 3000000) errors.push(`${pack.id}: pack exceeds 3 MB`);
  process.stdout.write(`${pack.id}: ${pack.parts.length} cards, ${Math.round(total / 1024)} KiB\n`);
}
if (errors.length) throw new Error(errors.join("\n"));
