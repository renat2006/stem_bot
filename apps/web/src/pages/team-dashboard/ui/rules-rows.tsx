import { StatGlyph } from "../../../shared/ui/index.js";
import type { RulesRow } from "../lib/rules-sections.js";

export function RulesRows({ rows, tone = "sf2" }: { rows: RulesRow[]; tone?: "sf" | "sf2" }) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div
          key={row.label}
          className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-3 py-2.5 ${
            tone === "sf" ? "bg-sf" : "bg-sf2"
          }`}
        >
          {row.stat ? (
            <StatGlyph shape={row.stat.shape} color={row.stat.color} size={11} />
          ) : (
            <span className="h-2 w-2 rounded-[2px] bg-ac" />
          )}
          <span className="text-[13.5px] leading-snug text-fg">{row.label}</span>
          {row.value && <span className="font-mono text-[13.5px] font-semibold text-fg">{row.value}</span>}
        </div>
      ))}
    </div>
  );
}
