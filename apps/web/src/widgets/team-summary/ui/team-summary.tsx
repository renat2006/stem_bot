import type { GameState, GameTemplate, ShiftPhase } from "@stem/shared";
import type { TeamWithStats } from "../../../entities/game/index.js";
import { BuySlots, Coin } from "../../../shared/ui/index.js";

interface TeamSummaryProps {
  team: TeamWithStats;
  template: GameTemplate;
  gameState?: GameState;
  teamRank?: number;
  totalTeams?: number;
  secondsLeft?: number | null;
  isCaptain?: boolean;
}

const PHASES: Array<{ id: ShiftPhase; label: string }> = [
  { id: "scoring", label: "Начисление" },
  { id: "market", label: "Рынок" },
  { id: "turn", label: "Ход" },
  { id: "summary", label: "Итоги" },
];

export function TeamSummary({
  team,
  template,
  gameState,
  teamRank = 1,
  totalTeams = 4,
  secondsLeft = null,
  isCaptain = true,
}: TeamSummaryProps) {
  const limit = gameState?.dailyPurchaseLimit ?? template.dailyPurchaseLimit ?? 2;
  const leftBuys = Math.max(0, limit - team.purchasesToday);
  const currentPhase: ShiftPhase =
    gameState?.currentPhase ?? (gameState?.purchasePhaseActive ? "market" : "scoring");
  const activeIdx = PHASES.findIndex((p) => p.id === currentPhase);
  const day = gameState?.currentDay ?? 1;
  const point = gameState?.currentPoint ?? day;
  const duration = Math.max(60, template.phaseDurationSeconds || 1800);
  const hasTimer = secondsLeft !== null;
  const remaining = secondsLeft ?? 0;
  const timerStr = hasTimer
    ? `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`
    : `Д${day}`;
  const pct = hasTimer ? Math.max(0, Math.min(100, (remaining / duration) * 100)) : 100;

  const phaseMode = hasTimer ? "ОКНО ПО ТАЙМЕРУ" : "ПО КНОПКЕ ВЕДУЩЕГО";
  const phaseLine =
    template.totalDays > 1
      ? `ДЕНЬ ${day}/${template.totalDays} · ${phaseMode}`
      : `ОКНО ${point}/${template.totalPoints} · ${phaseMode}`;

  let nowTitle = "Ожидание фазы";
  let nowSub = `Дальше ${template.nextPhaseLabel}`;
  if (currentPhase === "scoring") {
    nowTitle = `Начисление ${template.currencyName}`;
    nowSub = "Ведущие оценивают учебный блок · дальше откроется рынок";
  } else if (currentPhase === "market") {
    nowTitle = !isCaptain
      ? "Предложите детали капитану"
      : leftBuys > 0
        ? `Выберите до ${leftBuys} деталей`
        : "Лимит покупок выполнен";
    nowSub = `Рынок открыт · дальше ${template.nextPhaseLabel}`;
  } else if (currentPhase === "turn") {
    nowTitle = `Ход: +${team.computedStats.step.total} шаг`;
    nowSub = `Движение команд по маршруту «${template.trackName}»`;
  } else if (currentPhase === "summary") {
    nowTitle = "Итоги дня";
    nowSub = "Позиции команд зафиксированы на табло";
  }

  return (
    <div className="space-y-2.5">
      <section className="flex flex-col gap-3 rounded-2xl border border-ln bg-sf p-3.5">
        <div className="flex items-center gap-3.5">
          <div
            className="relative h-16 w-16 shrink-0 rounded-full"
            style={{
              background: `conic-gradient(${hasTimer ? "var(--warn)" : "var(--ac)"} ${pct}%, var(--sf2) 0)`,
            }}
          >
            <div className="absolute inset-[5px] flex flex-col items-center justify-center rounded-full bg-sf">
              <span className="font-mono text-sm leading-none font-semibold text-fg">{timerStr}</span>
              <span className="mt-1 text-[10px] text-mu">{hasTimer ? "осталось" : "день"}</span>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-mu">{phaseLine}</span>
            <h2 className="text-lg leading-tight font-semibold text-fg">{nowTitle}</h2>
            <p className="text-xs leading-snug text-mu">{nowSub}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {PHASES.map((phase, idx) => {
            const isPast = idx < activeIdx;
            const isActive = idx === activeIdx;
            return (
              <div key={phase.id} className="flex flex-col gap-1">
                <div
                  className="h-1.5 rounded-[3px]"
                  style={{
                    background: isPast ? "var(--fg)" : isActive ? "var(--warn)" : "var(--sf2)",
                    opacity: isPast ? 0.35 : 1,
                  }}
                />
                <span className={`text-xs ${isActive ? "font-semibold text-fg" : "font-normal text-mu"}`}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-ln bg-sf p-3.5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ac font-mono text-sm font-semibold text-acfg">
          {team.monogram}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate text-base font-semibold text-fg">{team.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-mu">
            <span className="rounded-md bg-sf2 px-2 py-0.5 font-mono text-xs font-semibold text-fg">
              {teamRank} место из {totalTeams}
            </span>
            {team.heldCurrency > 0 && (
              <span className="rounded-md bg-warn/15 px-2 py-0.5 font-mono text-[11px] font-medium text-warn">
                в ставке: {team.heldCurrency}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="flex items-center gap-1.5 font-mono text-2xl leading-none font-semibold text-fg">
            {team.currency - (team.heldCurrency ?? 0)}
            <Coin size={18} />
          </span>
          <div className="flex items-center gap-1.5">
            <BuySlots used={team.purchasesToday} limit={limit} />
            <span className="text-xs text-mu">покупки</span>
          </div>
        </div>
      </section>
    </div>
  );
}
