import type { StatDefinition } from "@stem/shared";
import { formatSigned, StatGlyph } from "../../../shared/ui/index.js";

interface StatDeltaListProps {
  stats: StatDefinition[];
  deltas: Record<string, number>;
  size?: "sm" | "lg";
}

export function StatDeltaList({ stats, deltas, size = "sm" }: StatDeltaListProps) {
  const activeStats = stats.filter((s) => (deltas[s.id] ?? 0) !== 0);
  if (activeStats.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {activeStats.map((stat) => {
        const value = deltas[stat.id] ?? 0;
        return (
          <span
            key={stat.id}
            className={`inline-flex items-center gap-[5px] rounded-[6px] bg-sf2 font-mono font-semibold ${
              size === "lg" ? "px-2 py-1 text-[13px]" : "px-1.5 py-0.5 text-[11.5px]"
            } ${value > 0 ? "text-pos" : "text-neg"}`}
          >
            <StatGlyph shape={stat.shape} color={stat.color} size={9} />
            {formatSigned(value)}
          </span>
        );
      })}
    </div>
  );
}
