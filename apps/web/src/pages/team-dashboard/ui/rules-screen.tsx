import { ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import type { RulesSection } from "../lib/rules-sections.js";
import { RulesRows } from "./rules-rows.js";

export function RulesScreen({ sections, rulesNote }: { sections: RulesSection[]; rulesNote: string }) {
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(sections[0]?.key ?? null);
  const q = query.trim().toLowerCase();
  const visible = sections.filter(
    (sec) =>
      !q || sec.title.toLowerCase().includes(q) || sec.rows.some((r) => r.label.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-fg">Справочник механик (FAQ)</h3>
        <span className="text-xs text-mu">только активные правила</span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-3.5 left-3.5 h-4 w-4 text-mu" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти вопрос: биржа, аукцион, шаг, склад…"
          aria-label="Поиск по справочнику механик"
          className="h-11 w-full rounded-xl border border-ln bg-sf pr-3.5 pl-9 text-sm text-fg placeholder:text-mu focus:border-ac focus:outline-none"
        />
      </div>

      {rulesNote && (
        <div className="flex items-center gap-2.5 rounded-xl border border-ac bg-ac/10 px-3.5 py-2.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-ac" />
          <span className="text-xs font-medium text-fg">{rulesNote}</span>
        </div>
      )}

      {visible.map((sec) => {
        const expanded = Boolean(q) || openKey === sec.key;
        return (
          <div key={sec.key} className="overflow-hidden rounded-2xl border border-ln bg-sf">
            <button
              type="button"
              onClick={() => setOpenKey(expanded && !q ? null : sec.key)}
              className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-ac" />
              <span className="flex-1 text-sm font-semibold text-fg">{sec.title}</span>
              <span className="font-mono text-[10px] font-medium tracking-[0.05em] text-mu">
                {sec.module}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-mu transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
            {expanded && (
              <div className="border-t border-ln px-4 py-3">
                <RulesRows rows={sec.rows} />
              </div>
            )}
          </div>
        );
      })}
      {visible.length === 0 && <p className="text-center text-xs text-mu">По запросу ничего не найдено</p>}
    </div>
  );
}
