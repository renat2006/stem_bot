import type { BalanceReport as BalanceReportData } from "@stem/shared";
import { Badge, ModuleCard } from "../../../shared/ui/index.js";

export function BalanceReport({ report }: { report: BalanceReportData }) {
  return (
    <ModuleCard
      title="Автопроверка баланса (SDK)"
      badge={<Badge tone="accent">Score: {report.score}/100</Badge>}
    >
      <p className="text-[13px] text-mu">
        Карточек в пуле: <span className="font-mono font-semibold text-fg">{report.metrics.totalCards}</span>{" "}
        · Статус:{" "}
        <span className={report.isBalanced ? "font-medium text-pos" : "font-medium text-warn"}>
          {report.isBalanced ? "сбалансировано" : "требует правок"}
        </span>
      </p>
      {report.issues.length > 0 ? (
        <ul className="mt-3 space-y-2 text-xs text-warn">
          {report.issues.map((issue) => (
            <li
              key={`${issue.code}:${issue.message}`}
              className="rounded-xl border border-warn/30 bg-warn/10 p-3 leading-snug"
            >
              <span className="font-mono font-semibold">[{issue.code}]</span> {issue.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2.5 text-[13px] font-medium text-pos">
          Отклонений в стоимости и покрытии слотов не обнаружено.
        </p>
      )}
    </ModuleCard>
  );
}
