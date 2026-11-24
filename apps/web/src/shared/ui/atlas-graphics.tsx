import type { StatDefinition } from "@stem/shared";
import { Check, CloudLightning, Compass, Gauge, Package, ShieldAlert, Sun, Zap } from "lucide-react";
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
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d={paths[kind]} />
    </svg>
  );
}

export function sectorName(label: string) {
  return label.split(" · ").at(-1) || label;
}

const CONTOUR_LINES = Array.from({ length: 16 }, (_, row) => {
  const y = row * 14 - 20;
  return `M-20 ${y} C42 ${y + 8} 56 ${y - 84 + row * 3} 117 ${y - 66} S183 ${y + 54 - row * 4} 242 ${y + 10} S302 ${y - 56} 395 ${y - 18}`;
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
    <div className="atlas-route-card">
      <div className="atlas-route-canvas" aria-hidden="true">
        <svg viewBox="0 0 360 124" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <title>Топографическая схема маршрута</title>
          <defs>
            <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M14 12v4m-2-2h4" stroke="#b8c2a6" strokeWidth=".8" />
            </pattern>
          </defs>
          <rect width="360" height="124" fill="#e5ead3" />
          <rect width="360" height="124" fill={`url(#${id})`} />
          <g fill="none" stroke="#b0bc9f" strokeWidth=".85">
            {CONTOUR_LINES.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <path
            d="M28 92 C88 92 104 64 166 64 S246 38 332 34"
            stroke="#5d7564"
            fill="none"
            strokeWidth="2.5"
            strokeDasharray="5 5"
          />
          <circle
            cx="96"
            cy="78"
            r={target === "A" ? "15" : "11"}
            fill={target === "A" ? "#1d4d38" : "#fdfcf4"}
            stroke="#1d4d38"
            strokeWidth="2"
          />
          <text
            x="96"
            y="82"
            textAnchor="middle"
            fontSize="12"
            fontWeight="800"
            fill={target === "A" ? "#ffffff" : "#1d4d38"}
          >
            A
          </text>
          <circle
            cx="266"
            cy="44"
            r={target === "B" ? "15" : "11"}
            fill={target === "B" ? "#1d4d38" : "#fdfcf4"}
            stroke="#1d4d38"
            strokeWidth="2"
          />
          <text
            x="266"
            y="48"
            textAnchor="middle"
            fontSize="12"
            fontWeight="800"
            fill={target === "B" ? "#ffffff" : "#1d4d38"}
          >
            B
          </text>
        </svg>
      </div>

      <div className="atlas-route-picks">
        {(["A", "B"] as const).map((v, i) => {
          const active = target === v;
          const title = sectorName(labels[i] ?? v);
          if (!onSelect) {
            return (
              <div key={v} className="atlas-sector-pill" data-active={active}>
                <span className="atlas-sector-letter">{v}</span>
                <span className="min-w-0 flex-1 truncate">{title}</span>
                {active && <span className="atlas-boost-chip">+2</span>}
              </div>
            );
          }
          return (
            <button
              key={v}
              type="button"
              aria-label={`Усилить ${labels[i]}`}
              aria-pressed={active}
              onClick={() => onSelect(v)}
              className="atlas-sector-pill"
            >
              <span className="atlas-sector-letter">{v}</span>
              <span className="min-w-0 flex-1 truncate">{title}</span>
              {active && <span className="atlas-boost-chip">+2</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ResourceMeter({ value, threshold }: { value: number; threshold: number }) {
  const range = Math.max(value, threshold, 1) + 1;
  const pct = Math.min(100, (value / range) * 100);
  const threshPct = Math.min(96, (threshold / range) * 100);
  const passed = value >= threshold;
  return (
    <div className="atlas-meter-track" aria-hidden="true">
      <div className={`atlas-meter-fill ${passed ? "is-pass" : "is-warn"}`} style={{ width: `${pct}%` }} />
      <span className="atlas-meter-tick" style={{ left: `${threshPct}%` }} />
    </div>
  );
}

export function StatImpactPills({
  stats,
  deltas,
  actionBadge,
}: {
  stats: StatDefinition[];
  deltas: Record<string, number>;
  actionBadge?: string;
}) {
  const entries = stats.filter((s) => Boolean(deltas[s.id]));
  if (entries.length === 0 && !actionBadge) {
    return <span className="text-xs font-medium text-mu">Без изменения характеристик</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map((s) => {
        const val = deltas[s.id] ?? 0;
        const pos = val > 0;
        return (
          <span
            key={s.id}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${
              pos ? "bg-pos/14 text-pos" : "bg-warn/15 text-warn"
            }`}
          >
            <span>{s.label}</span>
            <span className="tabular-nums">{pos ? `+${val}` : val}</span>
          </span>
        );
      })}
      {actionBadge && (
        <span className="inline-flex items-center rounded-lg border border-ac/30 bg-ac/10 px-2.5 py-1 text-xs font-bold text-ac">
          {actionBadge}
        </span>
      )}
    </div>
  );
}

const STATION_ICONS = [Compass, Gauge, Gauge, Package, Zap] as const;

export function CrewStationsStrip({ readySlots, labels }: { readySlots: number[]; labels?: string[] }) {
  return (
    <ol className="grid list-none grid-cols-5 gap-1.5 p-0" aria-label="Готовность пультов экипажа">
      {[0, 1, 2, 3, 4].map((idx) => {
        const ready = readySlots.includes(idx);
        const StationIcon = STATION_ICONS[idx] ?? Compass;
        return (
          <li
            key={idx}
            title={labels?.[idx] ?? `Пульт ${idx + 1}`}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2 ${
              ready ? "border-ac bg-ac text-acfg" : "border-ln bg-sf2 text-mu"
            }`}
          >
            {ready ? <Check className="h-4 w-4" /> : <StationIcon className="h-4 w-4 opacity-75" />}
            <span className="text-[11px] font-bold tabular-nums">#{idx + 1}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ForecastCards({
  items,
}: {
  items: Array<{ id: string; label: string; probabilityPercent: number; totalPoints: number }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((item, idx) => {
        const WeatherIcon = idx === 0 ? Sun : CloudLightning;
        return (
          <div key={item.id} className="rounded-2xl border border-ln bg-sf p-3.5">
            <div className="flex items-center justify-between gap-1.5 text-xs font-semibold text-mu">
              <span className="inline-flex items-center gap-1.5">
                <WeatherIcon className="h-3.5 w-3.5 text-ac" />
                <span>{item.probabilityPercent}%</span>
              </span>
              <span className="h-1.5 w-10 overflow-hidden rounded-full bg-sf2">
                <span
                  className="block h-full rounded-full bg-ac"
                  style={{ width: `${item.probabilityPercent}%` }}
                />
              </span>
            </div>
            <strong className="mt-2 block text-3xl font-extrabold tracking-tight tabular-nums text-fg">
              +{item.totalPoints}
            </strong>
            <span className="mt-0.5 block text-xs font-medium leading-snug text-mu">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ProbeDiagram({
  available,
  measurements,
  maxProbes = 2,
}: {
  available: boolean[];
  measurements: number;
  maxProbes?: number;
}) {
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
        <span>
          Замеров: {measurements} из {maxProbes}
        </span>
        <strong>Версий в работе: {available.filter(Boolean).length}</strong>
      </figcaption>
    </figure>
  );
}

export function TrainingSketch({ diagnosis = false }: { diagnosis?: boolean }) {
  return (
    <svg className="training-sketch" viewBox="0 0 160 64" aria-hidden="true">
      {diagnosis ? (
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="28" y="8" width="96" height="46" rx="8" />
          <path d="M38 37h16l8-15 9 22 9-16 7 9h25" />
          <circle cx="112" cy="18" r="2.5" fill="currentColor" />
        </g>
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 50l36-30 28 16 38-24 26 18" opacity=".32" />
          <path d="M24 46h32l18-22h38l20-10" strokeDasharray="4 4" />
          <circle cx="56" cy="46" r="6" fill="currentColor" fillOpacity=".16" />
          <circle cx="112" cy="24" r="6" fill="currentColor" fillOpacity=".16" />
        </g>
      )}
    </svg>
  );
}

export interface SpiralToken {
  id: string;
  name: string;
  position: number;
  highlight?: boolean;
}

export function SpiralBoard({
  labels,
  tokens,
  spiral,
}: {
  labels: string[];
  tokens: SpiralToken[];
  spiral: boolean;
}) {
  const size = Math.ceil(Math.sqrt(labels.length));
  const side = spiral ? size : Math.max(2, Math.ceil(labels.length / 4) + 1);
  let x = 0;
  let y = 0;
  let dx = 1;
  let dy = 0;
  const used = new Set<string>();

  return (
    <div className="fieldboard" style={{ gridTemplateColumns: `repeat(${side}, minmax(0, 1fr))` }}>
      {labels.map((label, i) => {
        const style = { gridColumn: x + 1, gridRow: y + 1 };
        used.add(`${x},${y}`);
        if (x + dx < 0 || x + dx >= side || y + dy < 0 || y + dy >= side || used.has(`${x + dx},${y + dy}`)) {
          [dx, dy] = [-dy, dx];
        }
        x += dx;
        y += dy;
        const cellTokens = tokens.filter((t) => t.position === i + 1);
        return (
          <div
            className="fieldcell"
            key={`${style.gridColumn}-${style.gridRow}`}
            data-event={spiral ? undefined : label}
            style={style}
            title={label}
          >
            <b>{i + 1}</b>
            {!spiral && <small>{label}</small>}
            {cellTokens.length > 0 && (
              <span className="fieldtokens">
                {cellTokens.map((t, idx) => (
                  <i
                    role="img"
                    key={t.id}
                    data-alt={idx % 2 === 1 ? "1" : undefined}
                    data-mine={t.highlight ? "1" : undefined}
                    aria-label={t.name}
                  >
                    {t.name[0]}
                  </i>
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CircuitAlertPill({
  label,
  peakLoad,
  capacity,
  heat,
  maxHeat,
  tripped,
}: {
  label: string;
  peakLoad: number;
  capacity: number;
  heat: number;
  maxHeat: number;
  tripped: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
        tripped ? "border-neg/30 bg-neg/10 text-neg" : "border-ln bg-sf2 text-fg"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        {tripped ? (
          <ShieldAlert className="h-4 w-4 shrink-0" />
        ) : (
          <Zap className="h-4 w-4 shrink-0 text-ac" />
        )}
        <span>{tripped ? "Защита: перегрузка шины" : label}</span>
      </span>
      <span className="tabular-nums text-mu">
        Ток {peakLoad}/{capacity} · Нагрев {heat}/{maxHeat}
      </span>
    </div>
  );
}
