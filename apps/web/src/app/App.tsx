import { type GameSnapshot, type LiveState, resolveLexicon, resolveMissionDay } from "@stem/shared";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { toast as sonnerToast, Toaster } from "sonner";
import { PackIllustration } from "../entities/assembly/index.js";
import { useLiveGame } from "../entities/game/index.js";
import { JoinPage } from "../pages/join/index.js";
import { PlaygroundSheet, TeamDashboardPage } from "../pages/team-dashboard/index.js";
import { getSurfaceQuery, type RunAction, syncPreferencesToDom, useTelegram } from "../shared/lib/index.js";
import { Mark, sectorName } from "../shared/ui/index.js";
import { DevIdentityBar } from "../widgets/dev-identity/index.js";
import { SettingsSheet } from "../widgets/settings-sheet/index.js";

const AdminConsolePage = lazy(() =>
  import("../pages/admin-console/index.js").then((m) => ({ default: m.AdminConsolePage })),
);
const ProjectorBoardPage = lazy(() =>
  import("../pages/projector-board/index.js").then((m) => ({ default: m.ProjectorBoardPage })),
);
const DesignLabPage = lazy(() =>
  import("../pages/design-lab/index.js").then((m) => ({ default: m.DesignLabPage })),
);

function hasDesignLabQuery(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("design");
}

function hasPlaygroundQuery(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("playground");
}

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
  const isDesignLab = hasDesignLabQuery();
  if (isDesignLab) {
    return (
      <Suspense fallback={<div className="p-8 text-center text-sm text-mu">Загрузка концептов…</div>}>
        <DesignLabPage />
      </Suspense>
    );
  }
  return <LiveApp />;
}

function LiveApp() {
  const { hapticSuccess, hapticError } = useTelegram();
  const { snapshot, clockOffsetMs, error, setError, applyState, applySnapshot } = useLiveGame();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loreOpen, setLoreOpen] = useState(false);
  const [playgroundOpen, setPlaygroundOpen] = useState(hasPlaygroundQuery);

  const eventKey = snapshot?.template.eventKey ?? "rovers";
  const surfaceQuery = getSurfaceQuery();

  useEffect(() => {
    syncPreferencesToDom();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-event", eventKey);
  }, [eventKey]);

  const handleOpenSettings = useCallback(() => setSettingsOpen(true), []);
  const handleCloseSettings = useCallback(() => setSettingsOpen(false), []);
  const handleOpenLore = useCallback(() => setLoreOpen(true), []);
  const handleCloseLore = useCallback(() => setLoreOpen(false), []);
  const handleOpenPlayground = useCallback(() => setPlaygroundOpen(true), []);

  if (!snapshot) {
    return (
      <div className="flex min-h-[var(--tg-viewport-stable-height,100dvh)] items-center justify-center p-4 text-center text-sm text-mu">
        {error ?? "Загрузка Полевого атласа…"}
      </div>
    );
  }

  if (surfaceQuery === "projector") {
    return (
      <Suspense fallback={<div className="p-8 text-center text-sm text-mu">Загрузка табло…</div>}>
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

  const { viewer, template, gameState } = snapshot;
  const lexicon = snapshot.lexicon ?? resolveLexicon(template);
  const missionDay =
    snapshot.currentMissionDay?.day === gameState.currentDay
      ? snapshot.currentMissionDay
      : resolveMissionDay(template, gameState.currentDay);
  const team = snapshot.teams.find((t) => t.id === viewer.teamId);
  const showAdmin = viewer.isAdmin && (viewer.botSurface === "admin" || surfaceQuery === "admin" || !team);
  const cleanTitle = missionDay.title.replace(/^День \d+\s*[·•-]\s*/, "");

  return (
    <main className="atlas-desk">
      <Toaster position="top-center" richColors />

      {!viewer.isProduction && <DevIdentityBar viewer={viewer} members={snapshot.members} />}

      {error && (
        <div className="mx-auto mb-3 max-w-[1000px] px-4">
          <button
            type="button"
            onClick={() => setError(null)}
            className="w-full rounded-xl border border-neg/30 bg-neg/10 p-3 text-left text-xs font-semibold text-neg"
          >
            {error}
          </button>
        </div>
      )}

      {showAdmin ? (
        <Suspense fallback={<div className="p-6 text-center text-sm text-mu">Загрузка студии…</div>}>
          <AdminConsolePage
            snapshot={snapshot}
            clockOffsetMs={clockOffsetMs}
            run={run}
            onOpenSettings={handleOpenSettings}
          />
          <SettingsSheet open={settingsOpen} onClose={handleCloseSettings} />
        </Suspense>
      ) : (
        <div className="field-spread">
          <aside className="mission-jacket" aria-label="Задача команды">
            <div className="jacket-brand">
              <Mark kind="team" />
              <span>{template.title}</span>
            </div>
            <div className="jacket-heading">
              <span>
                День {gameState.currentDay} из {template.totalDays}
              </span>
              <h2>{cleanTitle}</h2>
            </div>
            <PackIllustration
              template={template}
              kind="story"
              label={lexicon.objectName}
              className="jacket-image"
            />
            <div className="jacket-foot">
              <div className="rounded-xl border border-ln bg-sf p-3">
                <span className="text-[11px] font-bold text-mu">Участок A</span>
                <p className="mt-0.5 text-sm font-bold text-fg">{sectorName(lexicon.sectorALabel)}</p>
              </div>
              <div className="rounded-xl border border-ln bg-sf p-3">
                <span className="text-[11px] font-bold text-mu">Участок B</span>
                <p className="mt-0.5 text-sm font-bold text-fg">{sectorName(lexicon.sectorBLabel)}</p>
              </div>
            </div>
          </aside>

          <div className="atlas-phone">
            {team ? (
              <TeamDashboardPage
                snapshot={snapshot}
                team={team}
                clockOffsetMs={clockOffsetMs}
                settingsOpen={settingsOpen}
                onOpenSettings={handleOpenSettings}
                onCloseSettings={handleCloseSettings}
                loreOpen={loreOpen}
                onOpenLore={handleOpenLore}
                onCloseLore={handleCloseLore}
                onOpenPlayground={handleOpenPlayground}
                run={run}
              />
            ) : (
              <>
                <JoinPage
                  snapshot={snapshot}
                  run={run}
                  onJoined={() => {}}
                  onOpenPlayground={handleOpenPlayground}
                  onOpenSettings={handleOpenSettings}
                />
                <SettingsSheet open={settingsOpen} onClose={handleCloseSettings} />
              </>
            )}
          </div>
        </div>
      )}

      <PlaygroundSheet
        open={playgroundOpen}
        onClose={() => setPlaygroundOpen(false)}
        template={template}
        onToast={(msg) => sonnerToast.success(msg)}
      />
    </main>
  );
}
