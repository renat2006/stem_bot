import type { GameTemplate, StatDefinition, TeamStepBreakdown } from "@stem/shared";
import { formatStatValue, StatGlyph } from "../../../shared/ui/index.js";

const METER_MIN = -4;
const METER_MAX = 7;

export interface MeterMark {
  at: number;
  label: string;
  danger?: boolean;
}

export function getThresholdsForStat(
  template: GameTemplate,
  activePerkId: string | null,
  statId: string,
): MeterMark[] {
  const marks: Array<{ at: number; bonus: number }> = template.stepThresholds
    .filter((t) => t.statId === statId)
    .map((t) => ({ at: t.min, bonus: t.bonus }));

  const activePerk = template.perks.find((p) => p.id === activePerkId);
  if (activePerk?.stepBonus && activePerk.minStatsCondition?.[statId] !== undefined) {
    const min = activePerk.minStatsCondition[statId];
    const existing = marks.find((m) => m.at === min);
    if (existing) {
      existing.bonus += activePerk.stepBonus;
    } else {
      marks.push({ at: min, bonus: activePerk.stepBonus });
    }
  }

  return marks.map((m) => ({ at: m.at, label: `+${m.bonus}` }));
}

export function StatMeter({
  stat,
  value,
  afterValue,
  marks = [],
}: {
  stat: StatDefinition;
  value: number;
  afterValue?: number;
  marks?: MeterMark[];
}) {
  const after = afterValue ?? value;
  const cells: number[] = [];
  for (let v = METER_MIN; v <= METER_MAX; v++) {
    cells.push(v);
  }

  return (
    <div className="flex w-full items-end gap-[3px]">
      {cells.map((v) => {
        if (v === 0) {
          return (
            <div key="zero" className="flex flex-col items-center">
              <span className="h-4" />
              <div className="h-[22px] w-[2px] shrink-0 rounded-full bg-mu" />
            </div>
          );
        }

        const nowFilled = v > 0 ? value >= v : value <= v;
        const afterFilled = v > 0 ? after >= v : after <= v;
        const fillCol = v > 0 ? stat.color : "var(--neg)";
        const mark = marks.find((m) => m.at === v);

        let bg = "var(--sf2)";
        let boxShadow = "none";
        let opacity = 1;

        if (nowFilled && afterFilled) {
          bg = fillCol;
        } else if (!nowFilled && afterFilled) {
          bg = `repeating-linear-gradient(135deg, ${fillCol} 0 2px, transparent 2px 4px)`;
          boxShadow = `inset 0 0 0 1px ${fillCol}`;
        } else if (nowFilled && !afterFilled) {
          bg = "transparent";
          boxShadow = "inset 0 0 0 1.5px var(--neg)";
          opacity = 0.85;
        }

        const outline = mark ? `1.5px solid ${mark.danger ? "var(--warn)" : "var(--ac)"}` : undefined;
        const badgeText = mark ? (mark.label.length > 4 ? `≥${v}` : mark.label) : "";

        return (
          <div key={v} className="relative flex flex-1 flex-col items-center gap-1">
            <span
              className={`h-3.5 font-mono text-[10px] leading-none font-semibold ${
                mark ? (mark.danger ? "text-warn" : "text-ac") : "text-transparent"
              }`}
            >
              {badgeText || "."}
            </span>
            <div
              className="h-4 w-full rounded-[3px]"
              style={{
                background: bg,
                boxShadow,
                opacity,
                outline,
                outlineOffset: mark ? 1 : undefined,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function StepBlocks({
  step,
  referenceStep,
  stats,
}: {
  step: TeamStepBreakdown;
  referenceStep?: TeamStepBreakdown;
  stats: StatDefinition[];
}) {
  const statMap = new Map(stats.map((s) => [s.id, s]));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {step.parts.map((part) => {
          const refPart = referenceStep?.parts.find((r) => r.key === part.key);
          const changed = referenceStep !== undefined && refPart !== undefined && refPart.met !== part.met;
          const stat = part.statId ? statMap.get(part.statId) : undefined;
          const isBase = part.key === "base";
          const topText = isBase ? `+${part.value}` : part.met ? `+${part.value}` : "0";

          let borderClass = "border-[1.5px] border-transparent";
          if (part.met && changed) borderClass = "border-[1.5px] border-pos";
          else if (!part.met && changed) borderClass = "border-[1.5px] border-dashed border-warn";
          else if (!part.met) borderClass = "border-[1.5px] border-dashed border-ln";

          const titleText = isBase
            ? "Базовый шаг"
            : part.isPerk
              ? part.label
              : stat
                ? `${stat.label} ${part.label}`
                : part.label;

          return (
            <div
              key={part.key}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 ${
                part.met ? "bg-sf2 opacity-100" : "bg-transparent opacity-75"
              } ${borderClass}`}
            >
              <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-fg">
                {part.isPerk ? (
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rotate-45 border-[1.5px] border-ac" />
                ) : stat ? (
                  <StatGlyph shape={stat.shape} color={stat.color} size={11} />
                ) : (
                  <span className="inline-block h-2 w-2 shrink-0 rounded-[2px] bg-ac" />
                )}
                <span className="truncate">{titleText}</span>
              </span>
              <span className="shrink-0 font-mono text-base font-semibold text-fg">{topText}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-fg px-3.5 py-2.5 text-bg">
        <span className="text-xs font-medium opacity-85">Итого за этот ход</span>
        <span className="font-mono text-lg leading-none font-semibold">= {step.total} шаг</span>
      </div>
    </div>
  );
}

interface StatGridProps {
  stats: StatDefinition[];
  values: Record<string, number>;
  template?: GameTemplate;
  activePerkId?: string | null;
}

export function StatGrid({ stats, values, template, activePerkId = null }: StatGridProps) {
  return (
    <div className="flex flex-col gap-3.5">
      {stats.map((stat) => {
        const val = values[stat.id] ?? 0;
        const marks = template ? getThresholdsForStat(template, activePerkId, stat.id) : [];
        return (
          <div key={stat.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="flex items-center gap-2 text-[13.5px] font-medium text-fg">
                <StatGlyph shape={stat.shape} color={stat.color} size={12} />
                {stat.label}
              </span>
              <span className="font-mono text-2xl leading-none font-semibold text-fg">
                {formatStatValue(val)}
              </span>
            </div>
            <StatMeter stat={stat} value={val} marks={marks} />
          </div>
        );
      })}
    </div>
  );
}
