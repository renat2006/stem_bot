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
    <div className="flex items-end gap-[2px]">
      {cells.map((v) => {
        if (v === 0) {
          return (
            <div key="zero" className="flex flex-col items-center gap-[3px]">
              <span className="h-3 text-[9px]" />
              <div className="h-[22px] w-[2px] shrink-0 rounded-[1px] bg-mu" />
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
          opacity = 0.8;
        }

        const outline = mark ? `1.5px solid ${mark.danger ? "var(--warn)" : "var(--ac)"}` : undefined;

        return (
          <div key={v} className="flex flex-1 flex-col items-center gap-[3px]">
            <span
              className={`h-3 whitespace-nowrap font-mono text-[9px] leading-3 font-semibold ${
                mark ? (mark.danger ? "text-warn" : "text-ac") : "text-transparent"
              }`}
            >
              {mark?.label ?? "."}
            </span>
            <div
              className="h-[14px] w-full rounded-[2px]"
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
    <div className="flex items-stretch gap-1.5">
      {step.parts.map((part) => {
        const refPart = referenceStep?.parts.find((r) => r.key === part.key);
        const changed = referenceStep !== undefined && refPart !== undefined && refPart.met !== part.met;
        const stat = part.statId ? statMap.get(part.statId) : undefined;

        const isBase = part.key === "base";
        const topText = isBase ? String(part.value) : part.met ? `+${part.value}` : "0";

        let borderClass = "border-[1.5px] border-transparent";
        if (part.met && changed) borderClass = "border-[1.5px] border-pos";
        else if (!part.met && changed) borderClass = "border-[1.5px] border-dashed border-warn";
        else if (!part.met) borderClass = "border-[1.5px] border-dashed border-ln";

        return (
          <div
            key={part.key}
            className={`flex min-w-0 flex-1 flex-col gap-1 rounded-[10px] px-[7px] py-2 ${
              part.met ? "bg-sf2 opacity-100" : "bg-transparent opacity-75"
            } ${borderClass}`}
          >
            <span className="font-mono text-[17px] leading-none font-semibold text-fg">{topText}</span>
            <span className="flex items-center gap-1 truncate text-[10.5px] leading-tight text-mu">
              {part.isPerk ? (
                <span className="inline-block h-[9px] w-[9px] shrink-0 rotate-45 border-[1.5px] border-ac" />
              ) : stat ? (
                <StatGlyph shape={stat.shape} color={stat.color} size={9} />
              ) : null}
              <span className="truncate">{part.label}</span>
            </span>
          </div>
        );
      })}
      <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-[10px] bg-fg px-[7px] py-2 text-bg">
        <span className="font-mono text-[17px] leading-none font-semibold">= {step.total}</span>
        <span className="text-[10.5px] leading-tight opacity-80">шаг</span>
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
    <div className="flex flex-col gap-3">
      {stats.map((stat) => {
        const val = values[stat.id] ?? 0;
        const marks = template ? getThresholdsForStat(template, activePerkId, stat.id) : [];
        return (
          <div key={stat.id} className="grid grid-cols-[108px_minmax(0,1fr)] items-end gap-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-xs text-mu">
                <StatGlyph shape={stat.shape} color={stat.color} size={11} />
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
