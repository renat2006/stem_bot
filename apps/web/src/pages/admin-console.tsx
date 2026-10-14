import type { BalanceReport, GameState, GameTemplate } from "@stem/shared";
import type { TeamWithStats } from "../shared/index.js";

interface Props {
  gameState: GameState;
  template: GameTemplate;
  availableTemplates: Array<{
    id: string;
    title: string;
    theme: string;
    currencyName: string;
    currencyIcon: string;
  }>;
  balanceReport: BalanceReport;
  teams: TeamWithStats[];
  onReward: (teamId: string, amount: number) => void;
  onMoveTrack: (teamId: string, delta: number) => void;
  onUpdateState: (patch: Partial<GameState>) => void;
  onSwitchTemplate: (templateId: string) => void;
}

export function AdminConsolePage({
  gameState,
  template,
  availableTemplates,
  balanceReport,
  teams,
  onReward,
  onMoveTrack,
  onUpdateState,
  onSwitchTemplate,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Конструктор игровых систем (Сеттинг)</h2>
        <div className="mt-2.5 grid grid-cols-1 gap-2">
          {availableTemplates.map((item) => {
            const active = item.id === template.id;
            return (
              <button
                key={item.id}
                onClick={() => !active && onSwitchTemplate(item.id)}
                className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-indigo-500 bg-indigo-500/15"
                    : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {item.currencyIcon} {item.title}
                  </p>
                  <p className="text-xs text-slate-400">{item.theme}</p>
                </div>
                <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300">
                  {active ? "Активен" : "Выбрать"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Управление сменой и магазином</h3>
          <button
            onClick={() => onUpdateState({ purchasePhaseActive: !gameState.purchasePhaseActive })}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              gameState.purchasePhaseActive
                ? "bg-rose-600 text-white hover:bg-rose-500"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {gameState.purchasePhaseActive ? "Закрыть магазин" : "Открыть магазин"}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-slate-400">День смены:</span>
          {Array.from({ length: template.totalDays }, (_, idx) => idx + 1).map((day) => (
            <button
              key={day}
              onClick={() => onUpdateState({ currentDay: day })}
              className={`h-8 w-8 rounded-lg text-xs font-bold ${
                gameState.currentDay === day
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <h3 className="text-sm font-semibold text-slate-200">Управление командами</h3>
        <div className="mt-3 space-y-3">
          {teams.map((team) => (
            <div key={team.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">{team.name}</p>
                  <p className="text-xs text-slate-400">
                    {template.trackName}: {team.trackPosition}/{template.trackMax} · Покупок:{" "}
                    {team.purchasesToday}
                  </p>
                </div>
                <span className="text-sm font-bold text-emerald-400">
                  {template.currencyIcon} {team.currency}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button
                  onClick={() => onReward(team.id, 1)}
                  className="rounded-lg bg-emerald-600/20 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30"
                >
                  +1 {template.currencyName}
                </button>
                <button
                  onClick={() => onReward(team.id, 3)}
                  className="rounded-lg bg-emerald-600/20 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30"
                >
                  +3 {template.currencyName}
                </button>
                <button
                  onClick={() => onReward(team.id, -1)}
                  className="rounded-lg bg-rose-600/20 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-600/30"
                >
                  -1 {template.currencyName}
                </button>
                <button
                  onClick={() => onMoveTrack(team.id, 1)}
                  className="rounded-lg bg-indigo-600/20 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-600/30"
                >
                  +1 Шаг трека
                </button>
                <button
                  onClick={() => onMoveTrack(team.id, -1)}
                  className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  -1 Шаг трека
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Авто-проверка баланса (SDK Validator)</h3>
          <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-bold text-indigo-300">
            Score: {balanceReport.score}/100
          </span>
        </div>

        <p className="mt-1 text-xs text-slate-400">
          Карточек в пуле: {balanceReport.metrics.totalCards} · Статус:{" "}
          {balanceReport.isBalanced ? "Сбалансировано" : "Требует правок"}
        </p>

        {balanceReport.issues.length > 0 ? (
          <ul className="mt-2.5 space-y-1.5 text-xs text-amber-300">
            {balanceReport.issues.map((issue, i) => (
              <li key={i} className="rounded-lg bg-amber-500/10 p-2">
                [{issue.code}] {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-emerald-400">Отклонений в стоимости и слотах не обнаружено.</p>
        )}
      </div>
    </div>
  );
}
