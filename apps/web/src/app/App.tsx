import { useState } from "react";
import { useGameSnapshot } from "../entities/game/index.js";
import { AdminConsolePage } from "../pages/admin-console/index.js";
import { TeamDashboardPage } from "../pages/team-dashboard/index.js";
import { type RunAction, useTelegram } from "../shared/lib/index.js";
import { Button } from "../shared/ui/index.js";

type Tab = "team" | "admin";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "team", label: "Игрок" },
  { id: "admin", label: "Админ" },
];

export function App() {
  const { hapticSuccess, hapticError, hapticTap } = useTelegram();
  const { snapshot, error, setError, reload } = useGameSnapshot();
  const [tab, setTab] = useState<Tab>("team");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  if (!snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-sm text-hint">
        {error ?? "Загрузка STEM Конструктора..."}
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

  const team = snapshot.teams.find((t) => t.id === selectedTeamId) ?? snapshot.teams[0];

  return (
    <div className="mx-auto max-w-md px-4 py-4 pb-12">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-accent">
            STEM Game SDK · День {snapshot.gameState.currentDay}
          </p>
          <h1 className="text-base font-bold text-text">{snapshot.template.title}</h1>
        </div>
        <nav className="flex gap-1 rounded-xl bg-surface p-1">
          {TABS.map(({ id, label }) => (
            <Button
              key={id}
              variant={tab === id ? "primary" : "ghost"}
              onClick={() => {
                hapticTap();
                setTab(id);
              }}
            >
              {label}
            </Button>
          ))}
        </nav>
      </header>

      {error && <div className="mb-3 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

      {tab === "team" && team ? (
        <>
          <div className="mb-3 flex gap-1.5">
            {snapshot.teams.map((t) => (
              <Button
                key={t.id}
                variant={t.id === team.id ? "accent" : "ghost"}
                onClick={() => setSelectedTeamId(t.id)}
              >
                {t.name}
              </Button>
            ))}
          </div>
          <TeamDashboardPage snapshot={snapshot} team={team} run={run} />
        </>
      ) : (
        <AdminConsolePage snapshot={snapshot} run={run} />
      )}
    </div>
  );
}
