import type { TeamMemberInfo } from "../../../entities/game/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { Button, ConfirmButton } from "../../../shared/ui/index.js";
import { adjustTrack, removeMember, setCaptain } from "../api/manage-team-api.js";

interface TeamAdminActionsProps {
  teamId: string;
  members: TeamMemberInfo[];
  run: RunAction;
}

export function TeamAdminActions({ teamId, members, run }: TeamAdminActionsProps) {
  return (
    <div className="mt-3 space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        <Button variant="accent" onClick={() => run(() => adjustTrack(teamId, 1, "Корректировка ведущего"))}>
          +1 клетка
        </Button>
        <Button variant="ghost" onClick={() => run(() => adjustTrack(teamId, -1, "Корректировка ведущего"))}>
          −1 клетка
        </Button>
      </div>

      {members.length === 0 ? (
        <p className="text-xs text-mu">В команде пока никого. Передайте код капитану.</p>
      ) : (
        <ul className="divide-y divide-ln rounded-lg border border-ln bg-sf">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate text-[13px] text-fg">
                {member.displayName}
                {member.username ? <span className="text-mu"> @{member.username}</span> : null}
              </span>
              {member.role === "captain" ? (
                <span className="shrink-0 rounded-md bg-ac/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-ac">
                  капитан
                </span>
              ) : (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" onClick={() => run(() => setCaptain(teamId, member.userId))}>
                    Капитан
                  </Button>
                  <ConfirmButton
                    confirmLabel="Удалить?"
                    onConfirm={() => run(() => removeMember(member.userId))}
                  >
                    ✕
                  </ConfirmButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
