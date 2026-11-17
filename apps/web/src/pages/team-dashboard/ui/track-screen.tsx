import type { BoardCell, GameTemplate } from "@stem/shared";
import { Award } from "lucide-react";
import { AssemblyStage } from "../../../entities/assembly/index.js";
import type { TeamWithStats } from "../../../entities/game/index.js";

const BADGE_NAMES: Record<string, string> = {
  full_rig: "Полная сборка",
  pioneer: "Первопроходец",
  legend_owner: "Хранитель легенды",
  trader: "Торговец биржи",
};

function describeCellEffect(cell: BoardCell, template: GameTemplate): string {
  const stat = cell.statId ? template.stats.find((s) => s.id === cell.statId) : undefined;
  if (stat && cell.minStat !== undefined) {
    return `${stat.label} от ${cell.minStat}: при успехе +${cell.rewardTrack || cell.rewardCurrency}`;
  }
  if (cell.rewardCurrency > 0) return `Бонус +${cell.rewardCurrency} ${template.currencyName}`;
  if (cell.rewardTrack > 0) return `Ускорение +${cell.rewardTrack} кл.`;
  if (cell.penaltyTrack < 0) return `Риск отката ${cell.penaltyTrack} кл.`;
  return "Точка маршрута";
}

export function TrackScreen({
  teams,
  myTeamId,
  template,
}: {
  teams: TeamWithStats[];
  myTeamId: string;
  template: GameTemplate;
}) {
  const ranked = [...teams].sort((a, b) => b.trackPosition - a.trackPosition);
  const specialCells = template.boardCells.filter((c) => c.type !== "start").slice(0, 6);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[20px] leading-tight font-semibold text-fg">{template.trackName}</h2>
        <p className="mt-0.5 text-xs text-mu">Позиции всех команд и прогноз вашего следующего шага</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ln bg-sf">
        {ranked.map((item, idx) => {
          const isMe = item.id === myTeamId;
          const target = Math.min(template.trackMax, item.trackPosition + item.computedStats.step.total);
          const barPct = Math.min(100, (item.trackPosition / template.trackMax) * 100);
          const forecastPct = Math.min(100, (target / template.trackMax) * 100);
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 border-b border-ln px-4 py-3 last:border-b-0 ${isMe ? "bg-sf2/80" : ""}`}
            >
              <span className="w-5 text-right font-mono text-[15px] font-semibold text-fg">{idx + 1}</span>
              <AssemblyStage
                template={template}
                equipped={item.equippedCards}
                size="token"
                teamName={item.name}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm text-fg ${isMe ? "font-semibold" : ""}`}>
                    {isMe ? `${item.name} · вы` : item.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-mu">
                    {item.trackPosition}/{template.trackMax} · +{item.computedStats.step.total}
                  </span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-sf2">
                  {isMe && (
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-ac opacity-30"
                      style={{ width: `${forecastPct}%` }}
                    />
                  )}
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${isMe ? "bg-ac" : "bg-mu opacity-55"}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                {item.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {item.badges.map((badge) => (
                      <span
                        key={badge}
                        className="inline-flex items-center gap-1 rounded-full bg-ac/12 px-2 py-0.5 text-[10px] font-medium text-ac"
                      >
                        <Award className="h-2.5 w-2.5" />
                        {BADGE_NAMES[badge] ?? badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {template.features.dayEvents && specialCells.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-ln bg-sf p-3.5">
          <p className="font-mono text-[11px] font-semibold uppercase text-mu">Ключевые точки маршрута</p>
          <div className="grid grid-cols-2 gap-2">
            {specialCells.map((cell) => (
              <div key={cell.position} className="rounded-xl bg-sf2 px-3 py-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs font-semibold text-ac">Кл. {cell.position}</span>
                  <span className="truncate text-xs font-semibold text-fg">{cell.label}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-mu">
                  {describeCellEffect(cell, template)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
