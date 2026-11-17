import { Sparkles } from "lucide-react";
import { PackIllustration } from "../../../entities/assembly/index.js";
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
  const intro = template.dayBriefings.find((b) => b.day === 0) ?? template.dayBriefings[0] ?? undefined;

  return (
    <div className="space-y-4 pt-1">
      <div className="overflow-hidden rounded-2xl border border-ln bg-sf">
        <PackIllustration
          template={template}
          kind="hero"
          label={template.title}
          className="h-44 w-full object-cover"
        />
        <div className="space-y-2 p-4">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-[0.06em] uppercase text-ac">
            <Sparkles className="h-3.5 w-3.5" />
            {template.eventTag}
          </span>
          <h2 className="text-[22px] leading-tight font-semibold text-fg">{template.title}</h2>
          <p className="text-xs leading-relaxed text-mu">{intro ? intro.story : template.theme}</p>
        </div>
      </div>

      {template.facts.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {template.facts.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-1 rounded-xl border border-ln bg-sf p-3">
              <span className="font-mono text-lg leading-none font-semibold text-fg">{fact.value}</span>
              <span className="text-[11px] text-mu">{fact.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-ln bg-sf p-4">
        <JoinForm defaultName={viewer.displayName} run={run} onJoined={onJoined} />
      </div>
    </div>
  );
}
