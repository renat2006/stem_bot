import { useEffect, useState } from "react";
import { useGameSnapshot } from "../entities/game/index.js";
import { AdminConsolePage } from "../pages/admin-console/index.js";
import { TeamDashboardPage } from "../pages/team-dashboard/index.js";
import { type RunAction, useTelegram, useTelegramTheme } from "../shared/lib/index.js";

type Tab = "team" | "admin";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "team", label: "Игрок" },
  { id: "admin", label: "Админ" },
];

export function App() {
  const { hapticSuccess, hapticError, hapticTap } = useTelegram();
  const { themeMode, toggleTheme } = useTelegramTheme();
  const { snapshot, error, setError, reload } = useGameSnapshot();
  const [tab, setTab] = useState<Tab>("team");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const isDebugQuery =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
  const [debugMode, setDebugMode] = useState<boolean>(isDebugQuery);

  const eventKey = snapshot?.template.eventKey ?? "neurofauna";

  useEffect(() => {
    document.documentElement.setAttribute("data-event", eventKey);
  }, [eventKey]);

  if (!snapshot) {
    return (
      <div className="flex min-h-[var(--tg-viewport-stable-height,100dvh)] items-center justify-center p-4 font-mono text-sm text-mu">
        {error ?? "Загрузка..."}
      </div>
    );
  }

  const run: RunAction = async (action) => {
    try {
      setError(null);
      await action();
      hapticSuccess();
      await reload();
    } catch (err) {
      hapticError();
      setError(err instanceof Error ? err.message : "Ошибка операции");
    }
  };

  const canSeeAdmin = Boolean(snapshot.viewer?.isAdmin) || debugMode;
  const effectiveTeamId = selectedTeamId ?? snapshot.viewer?.teamId ?? null;
  const team = snapshot.teams.find((t) => t.id === effectiveTeamId) ?? snapshot.teams[0];

  return (
    <div
      className="mx-auto max-w-[430px] px-3.5 pt-2.5"
      style={{ paddingBottom: "calc(4rem + var(--app-safe-bottom, 0px))" }}
    >
      {(canSeeAdmin || !snapshot.viewer?.isProduction) && (
        <header className="mb-3 flex items-center justify-between gap-2 border-b border-ln pb-2.5">
          <div className="min-w-0">
            <p className="truncate font-mono text-[11px] font-medium tracking-[0.06em] uppercase text-mu">
              {snapshot.template.eventTag}
            </p>
            <h1 className="truncate text-[17px] leading-tight font-semibold text-fg">
              {snapshot.template.title}
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            {!snapshot.viewer?.isProduction && (
              <button
                type="button"
                onClick={() => setDebugMode((v) => !v)}
                className={`h-8 rounded-lg border px-2.5 font-mono text-[11px] font-medium ${
                  debugMode ? "border-ac bg-ac/15 text-ac" : "border-ln bg-sf text-mu"
                }`}
              >
                {debugMode ? "DEV" : "PROD"}
              </button>
            )}

            {debugMode && (
              <button
                type="button"
                aria-label="Переключить тему"
                onClick={toggleTheme}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-ln bg-sf font-mono text-xs text-fg"
              >
                {themeMode === "light" ? "☀" : "☾"}
              </button>
            )}

            {canSeeAdmin && (
              <nav className="flex gap-0.5 rounded-xl bg-sf2 p-[3px]">
                {TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      hapticTap();
                      setTab(id);
                    }}
                    className={`min-h-[32px] rounded-[9px] px-3 text-xs font-medium transition ${
                      tab === id ? "bg-sf font-semibold text-fg shadow-xs" : "text-mu"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </header>
      )}

      {error && (
        <div className="mb-3 rounded-xl border border-neg/30 bg-neg/10 p-3 text-xs text-neg">{error}</div>
      )}

      {(tab === "team" || !canSeeAdmin) && team ? (
        <>
          {debugMode && (
            <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5">
              {snapshot.teams.map((t) => {
                const active = t.id === team.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTeamId(t.id)}
                    className={`flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      active ? "border-ac bg-ac/15 text-fg" : "border-ln bg-sf text-mu"
                    }`}
                  >
                    <span className="font-mono text-[11px] font-semibold">{t.monogram}</span>
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          )}
          <TeamDashboardPage snapshot={snapshot} team={team} debugMode={debugMode} run={run} />
        </>
      ) : (
        <AdminConsolePage snapshot={snapshot} run={run} />
      )}
    </div>
  );
}
