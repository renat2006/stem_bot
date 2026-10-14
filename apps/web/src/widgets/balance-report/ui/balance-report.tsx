import type { BalanceReport as BalanceReportData } from "@stem/shared";
import { Badge, Section } from "../../../shared/ui/index.js";

export function BalanceReport({ report }: { report: BalanceReportData }) {
  return (
    <Section title="Проверка баланса" aside={<Badge tone="accent">Score: {report.score}/100</Badge>}>
      <p className="text-xs text-hint">
        Карточек в пуле: {report.metrics.totalCards} · Статус:{" "}
        {report.isBalanced ? "сбалансировано" : "требует правок"}
      </p>
      {report.issues.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5 text-xs text-warning">
          {report.issues.map((issue) => (
            <li key={`${issue.code}:${issue.message}`} className="rounded-lg bg-warning/10 p-2">
              [{issue.code}] {issue.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-positive">Отклонений в стоимости и слотах не обнаружено.</p>
      )}
    </Section>
  );
}
