import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { DEFAULT_TEMPLATES } from "@stem/shared";
import { buildAssetPrompts } from "../src/prompts/index.js";
import { ArtPackSchema } from "../src/schema.js";

const { values } = parseArgs({ options: { template: { type: "string" }, only: { type: "string" } } });
const template = DEFAULT_TEMPLATES.find((t) => t.id === values.template || t.artPackId === values.template);
if (!template?.artPackId) throw new Error("Specify --template <templateId or packId>");
const directory = new URL(`../packs/${template.artPackId}/`, import.meta.url);
const pack = ArtPackSchema.parse(JSON.parse(await readFile(new URL("manifest.json", directory), "utf8")));
const prompts = buildAssetPrompts(template, pack).filter((p) => !values.only || p.id === values.only);
if (!prompts.length) throw new Error("No matching asset");
await writeFile(new URL("prompts.jsonl", directory), `${prompts.map((p) => JSON.stringify(p)).join("\n")}\n`);
process.stdout.write(`${prompts.length} prompts written for ${pack.id}\n`);
