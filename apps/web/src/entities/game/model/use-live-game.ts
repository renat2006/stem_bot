import type { GameSnapshot, LiveState, RulesPayload } from "@stem/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGameSnapshot } from "../api/game-api.js";
import { LiveConnection } from "./live-connection.js";
import type { ConnectionStatus } from "./types.js";

export function useLiveGame() {
  const [rules, setRules] = useState<RulesPayload | null>(null);
  const [state, setState] = useState<LiveState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef(0);

  const applyState = useCallback((next: LiveState) => {
    if (next.version < versionRef.current) return;
    versionRef.current = next.version;
    setState(next);
  }, []);

  const applyRules = useCallback(
    ({ rulesVersion, template, availableTemplates, balanceReport }: RulesPayload) => {
      setRules({ rulesVersion, template, availableTemplates, balanceReport });
    },
    [],
  );

  const applySnapshot = useCallback(
    (next: GameSnapshot) => {
      versionRef.current = next.version;
      applyRules(next);
      setState(next);
      setClockOffsetMs(Date.parse(next.serverTime) - Date.now());
    },
    [applyRules],
  );

  const refresh = useCallback(async () => {
    const snapshot = await fetchGameSnapshot();
    applySnapshot(snapshot);
  }, [applySnapshot]);

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки"));
    const connection = new LiveConnection(
      {
        onRules: applyRules,
        onState: (next) => {
          if (next.version === 1 && versionRef.current > 1) {
            versionRef.current = 1;
          }
          applyState(next);
        },
        onStatus: setStatus,
        onClockOffset: setClockOffsetMs,
        onError: setError,
      },
      refresh,
    );
    connection.start();
    return () => connection.stop();
  }, [refresh, applyRules, applyState]);

  const staleRules = Boolean(state && rules && state.gameState.rulesVersion !== rules.rulesVersion);
  useEffect(() => {
    if (staleRules) refresh().catch(() => {});
  }, [staleRules, refresh]);

  const snapshot: GameSnapshot | null = state && rules ? { ...state, ...rules } : null;
  return { snapshot, status, clockOffsetMs, error, setError, applyState, applySnapshot, refresh };
}
