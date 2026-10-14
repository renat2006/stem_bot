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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-[2px]">
        {Array.from({ length: max }, (_, idx) => {
          const cellNum = idx + 1;
          const isMe = cellNum === position;
          const isPassed = cellNum <= position;
          const isForecast = cellNum > position && cellNum <= target;
          const rivalsHere = rivalPositions.filter((pos) => pos === cellNum).length;

          return (
            <div key={cellNum} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex min-h-[12px] flex-col items-center justify-end gap-[2px]">
                {[1, 2].slice(0, Math.min(rivalsHere, 2)).map((dotId) => (
                  <span key={`rival-${cellNum}-${dotId}`} className="h-[5px] w-[5px] rounded-full bg-mu" />
                ))}
                {isMe && (
                  <span
                    className="h-[9px] w-[9px] rounded-full bg-ac"
                    style={{ boxShadow: "0 0 0 2px var(--sf)" }}
                  />
                )}
              </div>
              <div
                className={`w-full rounded-[2px] ${isMe ? "h-3" : "h-2"}`}
                style={{
                  background: isPassed ? "var(--ac)" : isForecast ? "transparent" : "var(--sf2)",
                  boxShadow: isForecast ? "inset 0 0 0 1.5px var(--ac)" : "none",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between font-mono text-[11px] text-mu">
        <span>старт · {label.toLowerCase()}</span>
        <span className="font-semibold text-fg">
          клетка {position} {stepForecast > 0 ? `→ ${target}` : ""}
        </span>
        <span>финиш {max}</span>
      </div>
    </div>
  );
}
