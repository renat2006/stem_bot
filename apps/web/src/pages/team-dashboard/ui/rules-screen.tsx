import { useState } from "react";
import type { RulesSection } from "../lib/rules-sections.js";
import { RulesRows } from "./rules-rows.js";

export function RulesScreen({ sections, rulesNote }: { sections: RulesSection[]; rulesNote: string }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = sections.filter(
    (sec) =>
      !q || sec.title.toLowerCase().includes(q) || sec.rows.some((r) => r.label.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по правилам"
        aria-label="Поиск по правилам"
        className="h-11 w-full rounded-xl border border-ln bg-sf px-3.5 text-sm text-fg placeholder:text-mu focus:border-ac focus:outline-none"
      />
      {rulesNote && (
        <div className="flex items-center gap-2.5 rounded-xl border border-ac bg-ac/10 px-3.5 py-2.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-ac" />
          <span className="text-[13px] font-medium text-fg">{rulesNote}</span>
        </div>
      )}
      {visible.map((sec) => (
        <div key={sec.key} className="flex flex-col gap-2.5 rounded-2xl border border-ln bg-sf p-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-ac" />
            <span className="flex-1 text-[15px] font-semibold text-fg">{sec.title}</span>
            <span className="font-mono text-[11px] font-medium tracking-[0.05em] text-mu">{sec.module}</span>
          </div>
          <RulesRows rows={sec.rows} />
        </div>
      ))}
      {visible.length === 0 && <p className="text-sm text-mu">Ничего не нашлось</p>}
    </div>
  );
}
