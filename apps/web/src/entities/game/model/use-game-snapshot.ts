import { useCallback, useEffect, useState } from "react";
import { fetchGameSnapshot } from "../api/game-api.js";
import type { GameSnapshot } from "./types.js";

export function useGameSnapshot() {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setSnapshot(await fetchGameSnapshot());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { snapshot, error, setError, reload };
}
