import type { GameSnapshot } from "../../../entities/game/index.js";
import { JoinForm } from "../../../features/join-team/index.js";
import type { RunAction } from "../../../shared/lib/index.js";

interface JoinPageProps {
  snapshot: GameSnapshot;
  run: RunAction;
  onJoined: () => void;
}

export function JoinPage({ snapshot, run, onJoined }: JoinPageProps) {
  const { template, viewer } = snapshot;
  return (
    <div className="space-y-4 pt-1">
      <div
        className="flex min-h-[132px] items-end rounded-2xl border border-ln p-4"
        style={{ background: "repeating-linear-gradient(135deg, var(--sf2) 0 8px, var(--sf) 8px 16px)" }}
      >
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-mu">
            {template.eventTag}
          </span>
          <span className="text-[22px] leading-tight font-semibold text-fg">{template.title}</span>
          <span className="text-[13px] text-mu">{template.theme}</span>
        </div>
      </div>

      {template.facts.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {template.facts.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-1 rounded-xl border border-ln bg-sf p-3">
              <span className="font-mono text-xl leading-none font-semibold text-fg">{fact.value}</span>
              <span className="text-xs text-mu">{fact.label}</span>
            </div>
          ))}
        </div>
      )}

      <JoinForm defaultName={viewer.displayName} run={run} onJoined={onJoined} />
    </div>
  );
}
