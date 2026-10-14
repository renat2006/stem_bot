import type { StatDefinition } from "@stem/shared";

interface StatGridProps {
  stats: StatDefinition[];
  values: Record<string, number>;
}

export function StatGrid({ stats, values }: StatGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((stat) => (
        <div key={stat.id} className="rounded-xl bg-secondary p-2.5 text-center">
          <div className="text-xs text-hint">
            {stat.icon} {stat.label}
          </div>
          <div className="mt-0.5 text-lg font-bold text-text">{values[stat.id] ?? 0}</div>
        </div>
      ))}
    </div>
  );
}
