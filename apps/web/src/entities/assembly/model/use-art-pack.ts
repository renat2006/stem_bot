import { type ArtPack, ArtPackSchema } from "@stem/art";
import { useEffect, useState } from "react";

const loaders: Record<string, () => Promise<{ default: unknown }>> = {
  neurofauna: () => import("@stem/art/packs/neurofauna"),
  airship: () => import("@stem/art/packs/airship"),
  startup: () => import("@stem/art/packs/startup"),
};
const cache = new Map<string, Promise<ArtPack | null>>();

function loadPack(id: string): Promise<ArtPack | null> {
  const cached = cache.get(id);
  if (cached) return cached;
  const loader = loaders[id];
  if (!loader) return Promise.resolve(null);
  const promise = loader()
    .then(({ default: data }) => {
      const parsed = ArtPackSchema.safeParse(data);
      return parsed.success ? parsed.data : null;
    })
    .catch(() => null);
  cache.set(id, promise);
  return promise;
}

export function useArtPack(id?: string) {
  const [loaded, setLoaded] = useState<{ id: string; pack: ArtPack | null } | null>(null);
  useEffect(() => {
    let active = true;
    if (id)
      void loadPack(id).then((pack) => {
        if (active) setLoaded({ id, pack });
      });
    return () => {
      active = false;
    };
  }, [id]);
  return loaded?.id === id ? (loaded?.pack ?? null) : null;
}
