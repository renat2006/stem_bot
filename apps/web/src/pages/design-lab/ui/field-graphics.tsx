import { useId } from "react";

export function Mark({ kind }: { kind: "team" | "reserve" | "practice" | "route" | "clock" }) {
  const paths = {
    team: "M3 16 10 3h5L8 16Zm8 4 7-13 4 7-4 6Z",
    reserve: "m3 14 8-11h8l-7 8h8L8 22l3-8Z",
    practice: "m3 17 7-13 4 7-5 9Zm12 3 4-8 3 5-2 3Z",
    route: "M2 17h5l6-12h8v4h-5l-6 12H2Z",
    clock: "M8 2h8v3H8Zm4 4a8 8 0 1 1-.01 0Zm-1 3v6h6v-2h-4V9Z",
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d={paths[kind]} />
    </svg>
  );
}
export function sectorName(label: string) {
  return label.split(" · ").at(-1) || label;
}
const contourLines = Array.from({ length: 19 }, (_, row) => {
  const y = row * 14 - 28;
  return `M-20 ${y} C42 ${y + 8} 56 ${y - 91 + row * 3} 117 ${y - 72} S183 ${y + 60 - row * 4} 242 ${y + 12} S302 ${y - 62} 395 ${y - 22}`;
});
export function RouteMap({
  target,
  labels,
  onSelect,
}: {
  target: "A" | "B";
  labels: [string, string];
  onSelect?: (target: "A" | "B") => void;
}) {
  const id = useId();
  return (
    <div className="field-map">
      <svg viewBox="0 0 360 168" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M14 12v4m-2-2h4" stroke="#bec5aa" strokeWidth=".75" />
          </pattern>
        </defs>
        <rect width="360" height="168" fill="#e6e9cd" />
        <rect width="360" height="168" fill={`url(#${id})`} />
        <g fill="none" stroke="#abb79b" strokeWidth=".85">
          {contourLines.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <path
          d="M-5 130 43 122 75 88 115 88 142 60 190 60 217 86 247 86 276 55 324 55 361 17"
          stroke="#758670"
          fill="none"
          strokeWidth="2.5"
          strokeDasharray="5 5"
        />
      </svg>
      {(["A", "B"] as const).map((v, i) => {
        const content = (
          <>
            <b>{v}</b>
            <span>{sectorName(labels[i] ?? v)}</span>
            {v === target && <i>+2</i>}
          </>
        );
        return onSelect ? (
          <button
            className={`map-pin pin-${v}`}
            type="button"
            key={v}
            aria-label={`Усилить ${labels[i]}`}
            aria-pressed={target === v}
            onClick={() => onSelect(v)}
          >
            {content}
          </button>
        ) : (
          <div key={v} className={`map-pin pin-${v}`} data-active={target === v}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function ResourceMeter({ value, threshold }: { value: number; threshold: number }) {
  const range = Math.max(value, threshold, 1) + 1;
  return (
    <svg className="resource-meter" viewBox="0 0 140 16" preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y="5" width="140" height="6" rx="3" fill="#d8dece" />
      <rect
        x="0"
        y="5"
        width={(140 * value) / range}
        height="6"
        rx="3"
        fill={value >= threshold ? "#376146" : "#9b5931"}
      />
      <path d={`M${(140 * threshold) / range} 1v14`} stroke="#182b23" strokeWidth="2" />
    </svg>
  );
}

export function ProbeDiagram({ available, measurements }: { available: boolean[]; measurements: number }) {
  return (
    <figure className="probe-diagram">
      <svg viewBox="0 0 300 84" aria-hidden="true">
        <path d="M12 42h22l7-17 8 34 8-25 5 8h36" fill="none" stroke="#dbedac" strokeWidth="3" />
        <circle cx="103" cy="42" r="5" fill="#dbedac" />
        {available.map((active, index) => {
          const y = 12 + index * 20;
          return (
            <g key={y} opacity={active ? 1 : 0.32}>
              <path
                d={`M109 42 C140 42 148 ${y} 166 ${y} H240`}
                fill="none"
                stroke={active ? "#dbedac" : "#c6cfbf"}
                strokeWidth="2"
                strokeDasharray={active ? undefined : "3 4"}
              />
              <circle cx="250" cy={y} r="7" fill={active ? "#dbedac" : "none"} stroke="#dbedac" />
              {!active && <path d={`m246 ${y - 4} 8 8m-8 0 8-8`} stroke="#fff" />}
            </g>
          );
        })}
      </svg>
      <figcaption>
        Замеров: {measurements} из 2 <strong>Версий осталось: {available.filter(Boolean).length}</strong>
      </figcaption>
    </figure>
  );
}

export function TrainingSketch({ diagnosis = false }: { diagnosis?: boolean }) {
  return (
    <svg className="training-sketch" viewBox="0 0 160 68" aria-hidden="true">
      {diagnosis ? (
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="31" y="9" width="89" height="48" rx="6" />
          <path d="M37 40h17l8-16 9 24 9-18 7 9h22M50 61h54" />
          <circle cx="110" cy="18" r="2" />
        </g>
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 54l39-36 31 18 39-27 23 19M10 60l42-31 28 15 40-22 23 13" opacity=".35" />
          <path d="M23 50h32l18-25h40l17-12" strokeDasharray="4 3" />
          <circle cx="55" cy="50" r="6" />
          <circle cx="113" cy="25" r="6" />
        </g>
      )}
    </svg>
  );
}
