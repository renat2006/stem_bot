import { type GameTemplate, previewCardEffect } from "@stem/shared";
import type { ProposalInfo, TeamWithStats } from "../../../entities/game/index.js";
import { resolveProposal } from "../../../features/purchase/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { Button, ModuleCard } from "../../../shared/ui/index.js";

interface ProposalsInboxProps {
  proposals: ProposalInfo[];
  team: TeamWithStats;
  template: GameTemplate;
  isCaptain: boolean;
  marketOpen: boolean;
  run: RunAction;
}

export function ProposalsInbox({
  proposals,
  team,
  template,
  isCaptain,
  marketOpen,
  run,
}: ProposalsInboxProps) {
  if (proposals.length === 0) return null;
  return (
    <ModuleCard
      title={isCaptain ? "Команда предлагает" : "Предложения капитану"}
      subtitle={`${proposals.length} шт.`}
    >
      <ul className="space-y-2">
        {proposals.map((proposal) => {
          const card = template.cards.find((c) => c.id === proposal.cardId);
          if (!card) return null;
          const preview = previewCardEffect(team, card, template);
          const delta = preview.stepDelta;
          return (
            <li key={proposal.id} className="space-y-2 rounded-xl border border-ln bg-sf2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">{card.name}</p>
                  <p className="text-xs text-mu">
                    от {proposal.fromName} · {card.price} {template.currencyName} · шаг{" "}
                    <span className={delta > 0 ? "text-pos" : delta < 0 ? "text-neg" : "text-mu"}>
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  </p>
                </div>
              </div>
              {isCaptain && (
                <div className="grid grid-cols-2 gap-1.5">
                  <Button variant="ghost" onClick={() => run(() => resolveProposal(proposal.id, false))}>
                    Отклонить
                  </Button>
                  <Button
                    disabled={!marketOpen}
                    onClick={() => run(() => resolveProposal(proposal.id, true))}
                  >
                    Купить
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </ModuleCard>
  );
}
