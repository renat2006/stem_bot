import type { BalanceReport as BalanceReportData, LiveBalanceDashboard } from "@stem/shared";
import { AlertTriangle, CheckCircle2, Sparkles, Wand2 } from "lucide-react";
import { applyQuickFix } from "../../../features/control-shift/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { Badge, ModuleCard } from "../../../shared/ui/index.js";

export function BalanceReport({
  report,
  advisor,
  run,
}: {
  report: BalanceReportData;
  advisor?: LiveBalanceDashboard;
  run?: RunAction;
}) {
  const health = advisor?.healthScore ?? report.score;
  const alerts = advisor?.alerts ?? [];

  return (
    <ModuleCard
      title="Советник баланса и динамики"
      subtitle={advisor?.momentumLabel ?? "Следит за темпом команд, рынком и ценами"}
      badge={<Badge tone={health >= 80 ? "accent" : "warning"}>Здоровье: {health}/100</Badge>}
    >
      <div className="space-y-3.5">
        {advisor && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-ln bg-sf2 p-2.5">
              <p className="text-[11px] text-mu">Отрыв лидера</p>
              <p className="mt-0.5 font-mono text-base font-semibold text-fg">
                {advisor.metrics.leaderGap} кл.
              </p>
            </div>
            <div className="rounded-xl border border-ln bg-sf2 p-2.5">
              <p className="text-[11px] text-mu">Средний баланс</p>
              <p className="mt-0.5 font-mono text-base font-semibold text-fg">
                {advisor.metrics.avgCurrency}
              </p>
            </div>
            <div className="rounded-xl border border-ln bg-sf2 p-2.5">
              <p className="text-[11px] text-mu">Средний шаг</p>
              <p className="mt-0.5 font-mono text-base font-semibold text-fg">+{advisor.metrics.avgStep}</p>
            </div>
          </div>
        )}

        {alerts.length > 0 ? (
          <div className="space-y-2.5">
            {alerts.map((alert) => {
              const isCrit = alert.severity === "critical";
              const isWarn = alert.severity === "warning";
              const fixAction = alert.fix;
              return (
                <div
                  key={alert.id}
                  className={`space-y-2 rounded-xl border p-3.5 ${
                    isCrit
                      ? "border-neg/40 bg-neg/10"
                      : isWarn
                        ? "border-warn/40 bg-warn/10"
                        : "border-ac/35 bg-ac/8"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {isCrit || isWarn ? (
                      <AlertTriangle
                        className={`mt-0.5 h-4 w-4 shrink-0 ${isCrit ? "text-neg" : "text-warn"}`}
                      />
                    ) : (
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ac" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-fg">{alert.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-mu">{alert.explanation}</p>
                      <p className="mt-1.5 text-xs font-medium text-fg">Совет: {alert.suggestion}</p>
                    </div>
                  </div>
                  {fixAction && alert.fixLabel && run && (
                    <button
                      type="button"
                      onClick={() => void run(() => applyQuickFix(fixAction))}
                      className="inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-lg bg-ac px-3 text-xs font-semibold text-acfg transition active:scale-[0.99]"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      {alert.fixLabel}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-pos/30 bg-pos/10 p-3 text-xs font-medium text-pos">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{advisor?.summary ?? "Темп смены ровный: перекосов по очкам и рынку нет."}</span>
          </div>
        )}

        {report.issues.length > 0 && (
          <details className="rounded-xl border border-ln bg-sf2 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-fg">
              Замечания к набору карт ({report.issues.length})
            </summary>
            <ul className="mt-2 space-y-1.5 text-xs text-mu">
              {report.issues.map((issue) => (
                <li key={`${issue.code}:${issue.message}`} className="leading-snug">
                  • {issue.message}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </ModuleCard>
  );
}
