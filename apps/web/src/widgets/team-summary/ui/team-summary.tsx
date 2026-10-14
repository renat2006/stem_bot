import type { GameState, GameTemplate, ShiftPhase } from "@stem/shared";
import type { TeamWithStats } from "../../../entities/game/index.js";
import { BuySlots, Coin } from "../../../shared/ui/index.js";

interface TeamSummaryProps {
  team: TeamWithStats;
  template: GameTemplate;
  gameState?: GameState;
  teamRank?: number;
  totalTeams?: number;
  secondsLeft?: number;
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
  secondsLeft = 522,
}: TeamSummaryProps) {
  const limit = gameState?.dailyPurchaseLimit ?? template.dailyPurchaseLimit ?? 2;
  const leftBuys = Math.max(0, limit - team.purchasesToday);
  const currentPhase: ShiftPhase =
    gameState?.currentPhase ?? (gameState?.purchasePhaseActive ? "market" : "scoring");
  const activeIdx = PHASES.findIndex((p) => p.id === currentPhase);
  const day = gameState?.currentDay ?? 1;
  const point = gameState?.currentPoint ?? day;
  const duration = Math.max(60, template.phaseDurationSeconds || 1800);
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const timerStr = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const pct = Math.max(0, Math.min(100, (secondsLeft / duration) * 100));

  const phaseLine =
    template.totalDays > 1
      ? `ДЕНЬ ${day}/${template.totalDays} · ТОЧКА ${point}/${template.totalPoints} · ${template.phaseMode}`
      : `ОКНО ${point}/${template.totalPoints} · ${template.phaseMode}`;

  let nowTitle = "Ожидание фазы";
  let nowSub = `Дальше ${template.nextPhaseLabel}`;
  if (currentPhase === "scoring") {
    nowTitle = `Начисление ${template.currencyName}`;
    nowSub = "Ассистенты оценивают учебный блок · дальше откроется рынок";
  } else if (currentPhase === "market") {
    nowTitle = leftBuys > 0 ? `Купите до ${leftBuys} карт` : "Покупки сделаны";
    nowSub = `Рынок открыт · дальше ${template.nextPhaseLabel}`;
  } else if (currentPhase === "turn") {
    nowTitle = `Ход: +${team.computedStats.step.total} шаг`;
    nowSub = `Бросок кубика и движение по треку «${template.trackName}»`;
  } else if (currentPhase === "summary") {
    nowTitle = "Итоги раунда";
    nowSub = "Фиксация позиций на общем табло";
  }

  return (
    <div className="space-y-3">
      <section className="flex flex-col gap-3.5 rounded-2xl border border-ln bg-sf p-4">
        <div className="flex items-center gap-3.5">
          <div
            className="relative h-[68px] w-[68px] shrink-0 rounded-full"
            style={{ background: `conic-gradient(var(--warn) ${pct}%, var(--sf2) 0)` }}
          >
            <div className="absolute inset-[5px] flex flex-col items-center justify-center rounded-full bg-sf">
              <span className="font-mono text-base leading-none font-semibold text-fg">{timerStr}</span>
              <span className="mt-1 text-[11px] text-mu">таймер</span>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-mu">{phaseLine}</span>
            <h2 className="text-xl leading-tight font-semibold text-fg">{nowTitle}</h2>
            <p className="text-[13px] leading-snug text-mu">{nowSub}</p>
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
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ac font-mono text-base font-semibold text-acfg">
          {team.monogram}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate text-base font-semibold text-fg">{team.name}</h3>
          <div className="flex items-center gap-1.5 text-xs text-mu">
            <span className="rounded-md bg-sf2 px-2 py-0.5 font-mono text-xs font-semibold text-fg">
              {teamRank} место
            </span>
            <span>из {totalTeams}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="flex items-center gap-2 font-mono text-[28px] leading-none font-semibold text-fg">
            {team.currency}
            <Coin size={20} />
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
