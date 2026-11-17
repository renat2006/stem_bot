import type { GameSnapshot, LiveState } from "@stem/shared";
import { BookOpen, Settings } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { toast as sonnerToast, Toaster } from "sonner";
import { type ConnectionStatus, useLiveGame } from "../entities/game/index.js";
import { JoinPage } from "../pages/join/index.js";
import { TeamDashboardPage } from "../pages/team-dashboard/index.js";
import { getSurfaceQuery, type RunAction, syncPreferencesToDom, useTelegram } from "../shared/lib/index.js";
import { DevIdentityBar } from "../widgets/dev-identity/index.js";
import { SettingsSheet } from "../widgets/settings-sheet/index.js";

const AdminConsolePage = lazy(() =>
  import("../pages/admin-console/index.js").then((m) => ({ default: m.AdminConsolePage })),
);
const ProjectorBoardPage = lazy(() =>
  import("../pages/projector-board/index.js").then((m) => ({ default: m.ProjectorBoardPage })),
);

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: "подключение…",
  live: "онлайн",
  reconnecting: "переподключение…",
  polling: "обновление…",
};

function isGameSnapshot(value: unknown): value is GameSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    "gameState" in value &&
    "template" in value &&
    "rulesVersion" in value
  );
}

function isLiveState(value: unknown): value is LiveState {
  return typeof value === "object" && value !== null && "version" in value && "gameState" in value;
}

export function App() {
  const { hapticSuccess, hapticError, hapticTap } = useTelegram();
  const { snapshot, status, clockOffsetMs, error, setError, applyState, applySnapshot } = useLiveGame();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loreOpen, setLoreOpen] = useState(false);

  const eventKey = snapshot?.template.eventKey ?? "rovers";
  const surfaceQuery = getSurfaceQuery();

  useEffect(() => {
    syncPreferencesToDom();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-event", eventKey);
  }, [eventKey]);

  const handleOpenLore = useCallback(() => setLoreOpen(true), []);
  const handleCloseLore = useCallback(() => setLoreOpen(false), []);
  const handleCloseSettings = useCallback(() => setSettingsOpen(false), []);

  if (!snapshot) {
    return (
      <div className="flex min-h-[var(--tg-viewport-stable-height,100dvh)] items-center justify-center p-4 text-center font-mono text-sm text-mu">
        {error ?? "Загрузка смены…"}
      </div>
    );
  }

  if (surfaceQuery === "projector") {
    return (
      <Suspense fallback={<div className="p-8 text-center font-mono text-sm text-mu">Загрузка табло…</div>}>
        <ProjectorBoardPage snapshot={snapshot} clockOffsetMs={clockOffsetMs} />
      </Suspense>
    );
  }

  const run: RunAction = async (action) => {
    try {
      setError(null);
      const result = await action();
      if (isGameSnapshot(result)) applySnapshot(result);
      else if (isLiveState(result)) applyState(result);
      hapticSuccess();
      return true;
    } catch (err) {
      hapticError();
      const message = err instanceof Error ? err.message : "Ошибка операции";
      setError(message);
      sonnerToast.error(message);
      return false;
    }
  };

  const { viewer } = snapshot;
  const team = snapshot.teams.find((t) => t.id === viewer.teamId);
  const showAdmin = viewer.isAdmin && (viewer.botSurface === "admin" || surfaceQuery === "admin" || !team);

  return (
    <div
      className="mx-auto max-w-[460px] px-3.5 pt-2.5"
      style={{ paddingBottom: "calc(4rem + var(--app-safe-bottom, 0px))" }}
    >
      <Toaster position="top-center" richColors />

      {!viewer.isProduction && <DevIdentityBar viewer={viewer} members={snapshot.members} />}

      <header className="mb-3 flex items-center justify-between gap-2 border-b border-ln pb-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-mono text-[11px] font-medium tracking-[0.06em] uppercase text-mu">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${status === "live" ? "bg-pos" : status === "polling" ? "bg-warn" : "bg-mu"}`}
              aria-hidden
            />
            {showAdmin
              ? `Студия ведущего · ${STATUS_LABEL[status]}`
              : `${team ? team.name : snapshot.template.eventTag} · ${STATUS_LABEL[status]}`}
          </p>
          <h1 className="truncate text-[17px] leading-tight font-semibold text-fg">
            {snapshot.template.title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!showAdmin && team && snapshot.template.features.storyBriefings && (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setLoreOpen(true);
              }}
              aria-label="Сюжетная сводка дня"
              title="Легенда дня"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-ln bg-sf text-fg transition hover:border-ac"
            >
              <BookOpen className="h-4 w-4 text-ac" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              hapticTap();
              setSettingsOpen(true);
            }}
            aria-label="Настройки отображения"
            title="Настройки"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-ln bg-sf text-fg transition hover:border-ac"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
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
        <Suspense
          fallback={<div className="p-6 text-center font-mono text-sm text-mu">Загрузка студии…</div>}
        >
          <AdminConsolePage snapshot={snapshot} clockOffsetMs={clockOffsetMs} run={run} />
          <SettingsSheet open={settingsOpen} onClose={handleCloseSettings} />
        </Suspense>
      ) : team ? (
        <TeamDashboardPage
          snapshot={snapshot}
          team={team}
          clockOffsetMs={clockOffsetMs}
          settingsOpen={settingsOpen}
          onCloseSettings={handleCloseSettings}
          loreOpen={loreOpen}
          onOpenLore={handleOpenLore}
          onCloseLore={handleCloseLore}
          run={run}
        />
      ) : (
        <>
          <JoinPage snapshot={snapshot} run={run} onJoined={() => {}} />
          <SettingsSheet open={settingsOpen} onClose={handleCloseSettings} />
        </>
      )}
    </div>
  );
}
