import type { GameState, GameTemplate } from "@stem/shared";
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

const PHASES = ["Начисление", "Рынок", "Ход", "Итоги"];

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
  const isOpen = gameState?.purchasePhaseActive ?? true;
  const day = gameState?.currentDay ?? 1;
  const point = gameState?.currentPoint ?? day;
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const timerStr = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const pct = Math.max(0, Math.min(100, (secondsLeft / template.phaseDurationSeconds) * 100));

  const phaseLine =
    template.totalDays > 1
      ? `ДЕНЬ ${day}/${template.totalDays} · ТОЧКА ${point}/${template.totalPoints} · ${template.phaseMode}`
      : `ОКНО ${point}/${template.totalPoints} · ${template.phaseMode}`;

  const nowTitle = !isOpen ? "Рынок закрыт" : leftBuys > 0 ? `Купите до ${leftBuys} карт` : "Покупки сделаны";

  const nowSub = isOpen
    ? `Рынок открыт · дальше ${template.nextPhaseLabel}`
    : `Дальше ${template.nextPhaseLabel}`;

  return (
    <div className="space-y-3">
      <section className="flex flex-col gap-3.5 rounded-2xl border border-ln bg-sf p-3.5">
        <div className="flex items-center gap-3.5">
          <div
            className="relative h-[66px] w-[66px] shrink-0 rounded-full"
            style={{ background: `conic-gradient(var(--warn) ${pct}%, var(--sf2) 0)` }}
          >
            <div className="absolute inset-[5px] flex flex-col items-center justify-center rounded-full bg-sf">
              <span className="font-mono text-[15px] leading-none font-semibold text-fg">{timerStr}</span>
              <span className="mt-0.5 text-[9.5px] text-mu">осталось</span>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-mono text-[10.5px] font-medium tracking-[0.07em] text-mu">{phaseLine}</span>
            <h2 className="text-[20px] leading-tight font-semibold text-fg">{nowTitle}</h2>
            <p className="text-[13px] text-mu">{nowSub}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1">
          {PHASES.map((label, idx) => {
            const isPast = idx < 1;
            const isActive = idx === 1 && isOpen;
            return (
              <div key={label} className="flex flex-col gap-1">
                <div
                  className="h-1.5 rounded-[3px]"
                  style={{
                    background: isPast ? "var(--fg)" : isActive ? "var(--warn)" : "var(--sf2)",
                    opacity: isPast ? 0.35 : 1,
                  }}
                />
                <span className={`text-[11px] ${isActive ? "font-semibold text-fg" : "font-normal text-mu"}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-0.5">
        <div className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-ac font-mono text-sm font-semibold text-acfg">
          {team.monogram}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate text-base font-semibold text-fg">{team.name}</h3>
          <div className="flex items-center gap-1.5 text-[12.5px] text-mu">
            <span className="rounded-[5px] bg-sf2 px-1.5 py-0.5 font-mono text-xs font-semibold text-fg">
              {teamRank} место
            </span>
            <span>из {totalTeams}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-2 font-mono text-[30px] leading-none font-semibold text-fg">
            {team.currency}
            <Coin size={20} />
          </span>
          <div className="flex items-center gap-1">
            <BuySlots used={team.purchasesToday} limit={limit} />
            <span className="ml-0.5 text-[11px] text-mu">покупки</span>
          </div>
        </div>
      </section>
    </div>
  );
}
