import type { GameTemplate } from "@stem/shared";
import type { TeamWithStats } from "../../../entities/game/index.js";

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
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[21px] leading-tight font-semibold text-fg">{template.trackName}</h2>
        <p className="mt-0.5 text-[13px] text-mu">Прозрачная часть полосы — ваш прогноз на этот ход</p>
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
              className={`flex items-center gap-3 border-b border-ln px-4 py-3 last:border-b-0 ${isMe ? "bg-sf2" : ""}`}
            >
              <span className="w-5 text-right font-mono text-[15px] font-semibold text-fg">{idx + 1}</span>
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
