import type { CardItem } from "@stem/shared";
import { useEffect, useState } from "react";
import type { GameSnapshot, TeamWithStats } from "../../../entities/game/index.js";
import { undoLastPurchase } from "../../../features/purchase/index.js";
import { type RunAction, useCountdown, useTelegramBackButton } from "../../../shared/lib/index.js";
import { BottomSheet, ToastWithUndo } from "../../../shared/ui/index.js";
import { Shop } from "../../../widgets/shop/index.js";
import { buildRulesSections, type HelpKey } from "../lib/rules-sections.js";
import { HomeScreen } from "./home-screen.js";
import { Onboarding } from "./onboarding.js";
import { RulesRows } from "./rules-rows.js";
import { RulesScreen } from "./rules-screen.js";
import { TrackScreen } from "./track-screen.js";

type Screen = "home" | "market" | "track" | "rules";

const TABS: Array<{ id: Screen; label: string }> = [
  { id: "home", label: "Команда" },
  { id: "market", label: "Рынок" },
  { id: "track", label: "Трек" },
  { id: "rules", label: "Правила" },
];
const ONBOARDED_KEY = "stem_onboarded";

function readOnboarded() {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return true;
  }
}

interface TeamDashboardPageProps {
  snapshot: GameSnapshot;
  team: TeamWithStats;
  clockOffsetMs: number;
  run: RunAction;
}

export function TeamDashboardPage({ snapshot, team, clockOffsetMs, run }: TeamDashboardPageProps) {
  const { template, gameState, viewer } = snapshot;
  const [screen, setScreen] = useState<Screen>("home");
  const [onboarded, setOnboarded] = useState(readOnboarded);
  const [slotFilter, setSlotFilter] = useState("all");
  const [helpKey, setHelpKey] = useState<HelpKey | null>(null);
  const [toast, setToast] = useState<{ text: string; canUndo?: boolean } | null>(null);

  const countdown = useCountdown(gameState.phaseEndsAt, clockOffsetMs);
  const secondsLeft = gameState.phaseEndsAt ? countdown : null;
  const marketOpen = gameState.purchasePhaseActive && (secondsLeft === null || secondsLeft > 0);
  const isCaptain = viewer.role === "captain";
  const sections = buildRulesSections(template, gameState, gameState.dailyPurchaseLimit);
  const helpSection = helpKey ? sections.find((s) => s.key === helpKey) : undefined;

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), toast.canUndo ? 6000 : 3000);
    return () => clearTimeout(timeout);
  }, [toast]);

  useTelegramBackButton(Boolean(helpKey), () => setHelpKey(null));

  const finishOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {}
    setOnboarded(true);
  };

  if (!onboarded) return <Onboarding template={template} team={team} onDone={finishOnboarding} />;

  const captain = team.captainUsername || "команды";
  const onCardBought = (card: CardItem) => {
    setScreen("home");
    setToast({ text: `«${card.name}» в сборке · −${card.price} ${template.currencyName}`, canUndo: true });
  };
  const handleUndo = () => {
    setToast(null);
    void run(async () => {
      const result = await undoLastPurchase();
      setToast({ text: `Покупка отменена, ${template.currencyName} вернулись` });
      return result;
    });
  };

  return (
    <div className="space-y-3.5">
      <div className="sticky z-20 -mx-1 bg-bg py-1" style={{ top: "var(--app-safe-top, 0px)" }}>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-sf2 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setScreen(t.id)}
              className={`min-h-[40px] rounded-[9px] text-[13.5px] font-medium transition ${
                screen === t.id ? "bg-sf font-semibold text-fg shadow-xs" : "text-mu"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {screen === "home" && (
        <HomeScreen
          snapshot={snapshot}
          team={team}
          secondsLeft={secondsLeft}
          marketOpen={marketOpen}
          isCaptain={isCaptain}
          run={run}
          onHelp={setHelpKey}
          onOpenMarket={(slotId) => {
            setSlotFilter(slotId);
            setScreen("market");
          }}
          onOpenTrack={() => setScreen("track")}
        />
      )}

      {screen === "market" && (
        <Shop
          team={team}
          template={template}
          currentDay={gameState.currentDay}
          isOpen={marketOpen}
          gameState={gameState}
          slotFilter={slotFilter}
          onChangeSlotFilter={setSlotFilter}
          role={isCaptain ? "captain" : "member"}
          onCardBought={onCardBought}
          onCardProposed={() => setToast({ text: `Предложение ушло капитану ${captain}` })}
          run={run}
        />
      )}

      {screen === "track" && <TrackScreen teams={snapshot.teams} myTeamId={team.id} template={template} />}
      {screen === "rules" && <RulesScreen sections={sections} rulesNote={gameState.rulesUpdatedNote} />}

      <BottomSheet open={Boolean(helpSection)} onClose={() => setHelpKey(null)}>
        {helpSection && (
          <>
            <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-mu">
              {helpSection.module}
            </span>
            <h3 className="text-xl leading-tight font-semibold text-fg">{helpSection.title}</h3>
            <RulesRows rows={helpSection.rows} tone="sf" />
            <button
              type="button"
              onClick={() => setHelpKey(null)}
              className="mt-1 h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg"
            >
              Понятно
            </button>
          </>
        )}
      </BottomSheet>

      {toast && (
        <ToastWithUndo
          text={toast.text}
          canUndo={toast.canUndo}
          onUndo={toast.canUndo ? handleUndo : undefined}
        />
      )}
    </div>
  );
}
