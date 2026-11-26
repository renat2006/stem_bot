import type { GameTemplate } from "@stem/shared";
import { Copy, QrCode } from "lucide-react";
import { useState } from "react";
import { renderSVG } from "uqr";
import { AssemblyStage } from "../../../entities/assembly/index.js";
import type { TeamMemberInfo, TeamWithStats } from "../../../entities/game/index.js";
import { CreateTeamForm, TeamAdminActions } from "../../../features/manage-team/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import {
  BuySlots,
  Coin,
  formatStatValue,
  ModalDialog,
  ModuleCard,
  StatGlyph,
} from "../../../shared/ui/index.js";

interface TeamsBoardProps {
  teams: TeamWithStats[];
  members: Record<string, TeamMemberInfo[]>;
  template: GameTemplate;
  purchaseLimit: number | null;
  run: RunAction;
}

export function TeamsBoard({ teams, members, template, purchaseLimit, run }: TeamsBoardProps) {
  const ranked = [...teams].sort((a, b) => b.trackPosition - a.trackPosition);
  const [qrTeam, setQrTeam] = useState<TeamWithStats | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const buildJoinUrl = (joinCode: string) => {
    if (typeof window === "undefined") return `?join=${joinCode}`;
    const url = new URL(window.location.origin);
    url.searchParams.set("join", joinCode);
    return url.toString();
  };

  const qrSvg = qrTeam
    ? renderSVG(buildJoinUrl(qrTeam.joinCode), {
        border: 2,
        blackColor: "#14171a",
        whiteColor: "#ffffff",
      })
    : "";

  return (
    <>
      <ModuleCard title="Команды" subtitle={`${teams.length} в смене · коды и QR для входа участников`}>
        <div className="space-y-3">
          <CreateTeamForm run={run} />
          <ul className="space-y-3">
            {ranked.map((team, index) => (
              <li key={team.id} className="border-b border-ln py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ac font-mono text-sm font-semibold text-acfg">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-fg">{team.name}</p>
                      <p className="text-xs text-mu">
                        клетка <span className="font-mono font-semibold text-fg">{team.trackPosition}</span>/
                        {template.trackMax} · шаг +{team.computedStats.step.total}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="flex items-center gap-1.5 font-mono text-xl leading-none font-semibold text-fg">
                      {team.currency}
                      <Coin size={16} />
                    </span>
                    <BuySlots used={team.purchasesToday} limit={purchaseLimit} />
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-dashed border-ac/50 bg-sf px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-mu">Код команды</span>
                    <span className="select-all font-mono text-lg font-semibold tracking-[0.18em] text-fg">
                      {team.joinCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(team.joinCode);
                        setCopiedId(team.id);
                        setTimeout(() => setCopiedId(null), 1500);
                      }}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-ln bg-sf2 px-2.5 text-xs font-medium text-fg"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedId === team.id ? "Скопировано" : "Код"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrTeam(team)}
                      className="inline-flex h-9 items-center gap-1 rounded-lg bg-ac px-2.5 text-xs font-semibold text-acfg"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      QR
                    </button>
                  </div>
                </div>

                <details>
                  <summary className="cursor-pointer py-3 text-sm font-semibold">Состав и управление</summary>
                  <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-sf px-3 py-2">
                    {template.stats.map((stat) => (
                      <span key={stat.id} className="flex items-center gap-1.5 text-xs text-mu">
                        <StatGlyph shape={stat.shape} color={stat.color} size={10} />
                        <span>{stat.label}:</span>
                        <span className="font-mono font-semibold text-fg">
                          {formatStatValue(team.computedStats.total[stat.id] ?? 0)}
                        </span>
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex justify-center">
                    <AssemblyStage
                      template={template}
                      equipped={team.equippedCards}
                      size="card"
                      teamName={team.name}
                    />
                  </div>
                  <TeamAdminActions teamId={team.id} members={members[team.id] ?? []} run={run} />
                </details>
              </li>
            ))}
          </ul>
        </div>
      </ModuleCard>

      <ModalDialog
        open={Boolean(qrTeam)}
        onClose={() => setQrTeam(null)}
        title={qrTeam ? `Вход в команду «${qrTeam.name}»` : "QR-код"}
        subtitle="Покажите участникам на экране"
      >
        {qrTeam && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="h-52 w-52 overflow-hidden rounded-2xl border border-ln bg-white p-3"
              role="img"
              aria-label={`QR-код команды ${qrTeam.name}`}
            >
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`}
                alt={`QR-код команды ${qrTeam.name}`}
                className="h-full w-full"
              />
            </div>
            <p className="font-mono text-2xl font-semibold tracking-[0.22em] text-fg">{qrTeam.joinCode}</p>
            <p className="text-xs text-mu">
              Первый вошедший участник автоматически становится капитаном команды.
            </p>
          </div>
        )}
      </ModalDialog>
    </>
  );
}
