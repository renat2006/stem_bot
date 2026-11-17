import { createReadStream } from "node:fs";
import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const root = new URL("../../packages/art/packs/", import.meta.url);
async function iconSprite() {
  const directory = new URL("../../packages/art/icons/", import.meta.url);
  const files = await readdir(directory);
  const symbols = await Promise.all(
    files
      .filter((name) => name.endsWith(".svg"))
      .map(async (name) => {
        const source = await readFile(new URL(name, directory), "utf8");
        return `<symbol id="i-${name.slice(0, -4)}" viewBox="0 0 24 24">${source
          .replace(/<svg[^>]*>/, "")
          .replace(/<\/svg>/, "")
          .replace(/<title>.*?<\/title>/g, "")
          .trim()}</symbol>`;
      }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join("")}</svg>`;
}

export function artPlugin(): Plugin {
  let outDir = "";
  return {
    name: "stem-art-packs",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      const sprite = iconSprite();
      server.middlewares.use("/art/", async (req, res, next) => {
        if (req.url === "/icons.svg") {
          res.setHeader("Content-Type", "image/svg+xml");
          res.end(await sprite);
          return;
        }
        const match = /^\/?([a-z0-9-]+)\/(assets\/[a-zA-Z0-9_-]+\.[a-f0-9]{8,}\.webp)$/.exec(
          req.url?.split("?")[0] ?? "",
        );
        if (!match) {
          next();
          return;
        }
        try {
          const path = fileURLToPath(new URL(`${match[1]}/${match[2]}`, root));
          await stat(path);
          res.setHeader("Content-Type", "image/webp");
          createReadStream(path)
            .on("error", () => res.destroy())
            .pipe(res);
        } catch {
          next();
        }
      });
    },
    async closeBundle() {
      await mkdir(`${outDir}/art`, { recursive: true });
      await writeFile(`${outDir}/art/icons.svg`, await iconSprite());
      for (const directory of await readdir(root, { withFileTypes: true })) {
        if (!directory.isDirectory()) continue;
        const assets = new URL(`${directory.name}/assets/`, root);
        try {
          await stat(assets);
        } catch {
          continue;
        }
        await cp(assets, `${outDir}/art/${directory.name}/assets`, { recursive: true });
      }
    },
  };
}
