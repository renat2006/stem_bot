import { useEffect, useState } from "react";
import { api, useTelegram, type GameSnapshotResponse } from "../shared/index.js";
import { TeamDashboardPage } from "../pages/team-dashboard.js";
import { AdminConsolePage } from "../pages/admin-console.js";

export function App() {
  const { hapticSuccess, hapticTap } = useTelegram();
  const [snapshot, setSnapshot] = useState<GameSnapshotResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"team" | "admin">("team");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("team-alpha");
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = async () => {
    try {
      const data = await api.getState();
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  };

  useEffect(() => {
    void loadSnapshot();
  }, []);

  if (!snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-sm text-slate-400">
        {error ?? "Загрузка STEM Конструктора..."}
      </div>
    );
  }

  const currentTeam =
    snapshot.teams.find((t) => t.id === selectedTeamId) ?? snapshot.teams[0];

  const handleAction = async (fn: () => Promise<unknown>) => {
    try {
      setError(null);
      await fn();
      hapticSuccess();
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка операции");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-4 pb-12">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-indigo-400">
            STEM Game SDK · День {snapshot.gameState.currentDay}
          </p>
          <h1 className="text-base font-bold text-white">{snapshot.template.title}</h1>
        </div>

        <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
          <button
            onClick={() => {
              hapticTap();
              setActiveTab("team");
            }}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              activeTab === "team" ? "bg-indigo-600 text-white" : "text-slate-400"
            }`}
          >
            Игрок
          </button>
          <button
            onClick={() => {
              hapticTap();
              setActiveTab("admin");
            }}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              activeTab === "admin" ? "bg-indigo-600 text-white" : "text-slate-400"
            }`}
          >
            Админ
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {activeTab === "team" && currentTeam ? (
        <>
          <div className="mb-3 flex gap-1.5">
            {snapshot.teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  t.id === currentTeam.id
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          <TeamDashboardPage
            team={currentTeam}
            template={snapshot.template}
            currentDay={snapshot.gameState.currentDay}
            purchasePhaseActive={snapshot.gameState.purchasePhaseActive}
            onBuyCard={(cardId) => handleAction(() => api.buyCard(currentTeam.id, cardId))}
            onBuyPerk={(perkId) => handleAction(() => api.buyPerk(currentTeam.id, perkId))}
          />
        </>
      ) : (
        <AdminConsolePage
          gameState={snapshot.gameState}
          template={snapshot.template}
          availableTemplates={snapshot.availableTemplates}
          balanceReport={snapshot.balanceReport}
          teams={snapshot.teams}
          onReward={(teamId, amount) => handleAction(() => api.rewardTeam(teamId, amount))}
          onMoveTrack={(teamId, delta) => handleAction(() => api.moveTrack(teamId, delta))}
          onUpdateState={(patch) => handleAction(() => api.updateGameState(patch))}
          onSwitchTemplate={(templateId) => handleAction(() => api.switchTemplate(templateId))}
        />
      )}
    </div>
  );
}
