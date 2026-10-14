import type { StatDefinition } from "@stem/shared";

interface StatDeltaListProps {
  stats: StatDefinition[];
  deltas: Record<string, number>;
}

export function StatDeltaList({ stats, deltas }: StatDeltaListProps) {
  return (
    <div className="mt-1 flex gap-2 text-xs">
      {stats.map((stat) => {
        const value = deltas[stat.id] ?? 0;
        if (value === 0) return null;
        return (
          <span key={stat.id} className={value > 0 ? "text-positive" : "text-destructive"}>
            {stat.icon} {value > 0 ? `+${value}` : value}
          </span>
        );
      })}
    </div>
  );
}
