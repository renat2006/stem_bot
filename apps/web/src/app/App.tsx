import type { LiveState } from "@stem/shared";
import { useEffect, useState } from "react";
import { type ConnectionStatus, useLiveGame } from "../entities/game/index.js";
import { AdminConsolePage } from "../pages/admin-console/index.js";
import { JoinPage } from "../pages/join/index.js";
import { TeamDashboardPage } from "../pages/team-dashboard/index.js";
import { type RunAction, useTelegram } from "../shared/lib/index.js";
import { DevIdentityBar } from "../widgets/dev-identity/index.js";

type Tab = "team" | "admin";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: "подключение…",
  live: "онлайн",
  reconnecting: "переподключение…",
  polling: "медленная связь",
};

function isLiveState(value: unknown): value is LiveState {
  return typeof value === "object" && value !== null && "version" in value && "gameState" in value;
}

export function App() {
  const { hapticSuccess, hapticError, hapticTap } = useTelegram();
  const { snapshot, status, clockOffsetMs, error, setError, applyState } = useLiveGame();
  const [tab, setTab] = useState<Tab>("team");
  const eventKey = snapshot?.template.eventKey ?? "neurofauna";

  useEffect(() => {
    document.documentElement.setAttribute("data-event", eventKey);
  }, [eventKey]);

  if (!snapshot) {
    return (
      <div className="flex min-h-[var(--tg-viewport-stable-height,100dvh)] items-center justify-center p-4 text-center font-mono text-sm text-mu">
        {error ?? "Загрузка..."}
      </div>
    );
  }

  const run: RunAction = async (action) => {
    try {
      setError(null);
      const result = await action();
      if (isLiveState(result)) applyState(result);
      hapticSuccess();
      return true;
    } catch (err) {
      hapticError();
      setError(err instanceof Error ? err.message : "Ошибка операции");
      return false;
    }
  };

  const { viewer } = snapshot;
  const team = snapshot.teams.find((t) => t.id === viewer.teamId);
  const showAdmin = viewer.isAdmin && (tab === "admin" || !team);

  return (
    <div
      className="mx-auto max-w-[430px] px-3.5 pt-2.5"
      style={{ paddingBottom: "calc(4rem + var(--app-safe-bottom, 0px))" }}
    >
      {!viewer.isProduction && <DevIdentityBar viewer={viewer} members={snapshot.members} />}

      <header className="mb-3 flex items-center justify-between gap-2 border-b border-ln pb-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-mono text-[11px] font-medium tracking-[0.06em] uppercase text-mu">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${status === "live" ? "bg-pos" : status === "polling" ? "bg-warn" : "bg-mu"}`}
              aria-hidden
            />
            {team ? team.name : snapshot.template.eventTag} · {STATUS_LABEL[status]}
          </p>
          <h1 className="truncate text-[17px] leading-tight font-semibold text-fg">
            {snapshot.template.title}
          </h1>
        </div>
        {viewer.isAdmin && team && (
          <nav className="flex gap-0.5 rounded-xl bg-sf2 p-[3px]">
            {(["team", "admin"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  hapticTap();
                  setTab(id);
                }}
                className={`min-h-[32px] rounded-[9px] px-3 text-xs font-medium ${tab === id ? "bg-sf font-semibold text-fg shadow-xs" : "text-mu"}`}
              >
                {id === "team" ? "Команда" : "Пульт"}
              </button>
            ))}
          </nav>
        )}
      </header>

      {error && (
        <button
          type="button"
          onClick={() => setError(null)}
          className="mb-3 w-full rounded-xl border border-neg/30 bg-neg/10 p-3 text-left text-xs text-neg"
        >
          {error}
        </button>
      )}

      {showAdmin ? (
        <AdminConsolePage snapshot={snapshot} clockOffsetMs={clockOffsetMs} run={run} />
      ) : team ? (
        <TeamDashboardPage snapshot={snapshot} team={team} clockOffsetMs={clockOffsetMs} run={run} />
      ) : (
        <JoinPage snapshot={snapshot} run={run} onJoined={() => setTab("team")} />
      )}
    </div>
  );
}
