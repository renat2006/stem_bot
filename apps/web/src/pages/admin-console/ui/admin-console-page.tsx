import { Gauge, Layers, PlayCircle, Sparkles, Tv, Users } from "lucide-react";
import { useState } from "react";
import type { GameSnapshot } from "../../../entities/game/index.js";
import { ShiftControls, TemplateSwitcher } from "../../../features/control-shift/index.js";
import { RewardPanel } from "../../../features/manage-team/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { EventFeed } from "../../../widgets/event-feed/index.js";
import { TeamsBoard } from "../../../widgets/teams-board/index.js";
import { BriefingEditor } from "./briefing-editor.js";
import { CardsStudioTab } from "./cards-studio-tab.js";
import { MechanicsTab } from "./mechanics-tab.js";
import { ShiftWizardSheet } from "./shift-wizard.js";

type AdminTab = "round" | "cards" | "balance" | "teams";

const ADMIN_TABS: Array<{ id: AdminTab; label: string; icon: typeof PlayCircle }> = [
  { id: "round", label: "Раунд", icon: PlayCircle },
  { id: "cards", label: "Карты", icon: Layers },
  { id: "balance", label: "Баланс", icon: Gauge },
  { id: "teams", label: "Команды", icon: Users },
];

interface AdminConsolePageProps {
  snapshot: GameSnapshot;
  clockOffsetMs: number;
  run: RunAction;
}

function initialWizardState(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("tab") === "wizard";
}

export function AdminConsolePage({ snapshot, clockOffsetMs, run }: AdminConsolePageProps) {
  const { template, gameState } = snapshot;
  const [tab, setTab] = useState<AdminTab>("round");
  const [wizardOpen, setWizardOpen] = useState(initialWizardState);

  const criticalAlerts = snapshot.liveBalance.alerts.filter((a) => a.severity !== "info").length;

  const openProjector = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "projector");
    window.open(url.toString(), "_blank", "noopener");
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-ln bg-sf px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ac px-3 text-xs font-semibold text-acfg"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Новая смена
        </button>
        <button
          type="button"
          onClick={openProjector}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ln bg-sf2 px-3 text-xs font-medium text-fg"
        >
          <Tv className="h-3.5 w-3.5 text-ac" />
          Табло 16:9
        </button>
      </div>

      <nav aria-label="Разделы студии ведущего" className="grid grid-cols-4 gap-1 rounded-xl bg-sf2 p-1">
        {ADMIN_TABS.map((item) => {
          const TabIcon = item.icon;
          const hasAlert = item.id === "balance" && criticalAlerts > 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`relative flex min-h-[46px] flex-col items-center justify-center gap-0.5 rounded-[9px] text-xs font-medium transition ${
                tab === item.id ? "bg-sf font-semibold text-fg shadow-xs" : "text-mu"
              }`}
            >
              <TabIcon className="h-4 w-4" />
              <span>{item.label}</span>
              {hasAlert && (
                <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-warn" aria-hidden />
              )}
            </button>
          );
        })}
      </nav>

      {tab === "round" && (
        <div className="space-y-4">
          <ShiftControls
            gameState={gameState}
            totalDays={template.totalDays}
            clockOffsetMs={clockOffsetMs}
            run={run}
          />
          {template.features.storyBriefings && (
            <BriefingEditor template={template} currentDay={gameState.currentDay} run={run} />
          )}
          {snapshot.teams.length > 0 && <RewardPanel teams={snapshot.teams} template={template} run={run} />}
          <EventFeed feed={snapshot.feed} teams={snapshot.teams} title="Журнал смены" />
        </div>
      )}

      {tab === "cards" && <CardsStudioTab snapshot={snapshot} run={run} />}

      {tab === "balance" && <MechanicsTab snapshot={snapshot} run={run} />}

      {tab === "teams" && (
        <div className="space-y-4">
          <TeamsBoard
            teams={snapshot.teams}
            members={snapshot.members}
            template={template}
            purchaseLimit={gameState.dailyPurchaseLimit}
            run={run}
          />
          <TemplateSwitcher templates={snapshot.availableTemplates} activeId={template.id} run={run} />
        </div>
      )}

      <ShiftWizardSheet
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        templates={snapshot.availableTemplates}
        run={run}
        onCreated={() => setTab("teams")}
      />
    </div>
  );
}
