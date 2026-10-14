interface TrackProgressProps {
  label: string;
  position: number;
  max: number;
  stepForecast?: number;
  rivalPositions?: number[];
}

export function TrackProgress({
  label,
  position,
  max,
  stepForecast = 0,
  rivalPositions = [],
}: TrackProgressProps) {
  const target = Math.min(max, position + stepForecast);
  const currentPct = Math.min(100, Math.max(3, (position / max) * 100));
  const targetPct = Math.min(100, Math.max(currentPct, (target / max) * 100));
  const uniqueRivalPositions = Array.from(new Set(rivalPositions)).filter(
    (pos) => pos >= 1 && pos <= max && pos !== position,
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="relative pt-3 pb-1">
        <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-sf2">
          {stepForecast > 0 && (
            <div
              className="absolute inset-y-0 left-0 rounded-full border-[1.5px] border-ac bg-ac/25 transition-all"
              style={{ width: `${targetPct}%` }}
            />
          )}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-ac transition-all"
            style={{ width: `${currentPct}%` }}
          />
        </div>

        {uniqueRivalPositions.map((pos) => {
          const leftPct = Math.min(98, Math.max(2, (pos / max) * 100));
          return (
            <span
              key={`rival-pos-${pos}`}
              title={`Соперник: клетка ${pos}`}
              className="absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-mu"
              style={{ left: `${leftPct}%` }}
            />
          );
        })}

        <span
          className="absolute top-2 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-sf bg-ac shadow-xs transition-all"
          style={{ left: `${currentPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between font-mono text-xs text-mu">
        <span>{label}</span>
        <span className="font-semibold text-fg">
          клетка {position} {stepForecast > 0 ? `→ ${target}` : ""} из {max}
        </span>
      </div>
    </div>
  );
}
