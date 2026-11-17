import type { CardItem } from "@stem/shared";
import { Compass, ShoppingBag, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import type { GameSnapshot, TeamWithStats } from "../../../entities/game/index.js";
import { undoLastPurchase } from "../../../features/purchase/index.js";
import { type RunAction, useCountdown, useTelegramBackButton } from "../../../shared/lib/index.js";
import { BottomSheet, ToastWithUndo } from "../../../shared/ui/index.js";
import { SettingsSheet } from "../../../widgets/settings-sheet/index.js";
import { Shop } from "../../../widgets/shop/index.js";
import { buildRulesSections, type HelpKey } from "../lib/rules-sections.js";
import { HomeScreen } from "./home-screen.js";
import { LoreBriefingSheet } from "./lore-sheet.js";
import { Onboarding } from "./onboarding.js";
import { RulesRows } from "./rules-rows.js";
import { RulesScreen } from "./rules-screen.js";
import { TrackScreen } from "./track-screen.js";

type Screen = "home" | "market" | "race";

const TABS: Array<{ id: Screen; label: string; icon: typeof Wrench }> = [
  { id: "home", label: "Ангар", icon: Wrench },
  { id: "market", label: "Рынок", icon: ShoppingBag },
  { id: "race", label: "Маршрут и FAQ", icon: Compass },
];

const ONBOARDED_KEY = "stem_onboarded";

function readOnboarded(templateId: string) {
  try {
    return localStorage.getItem(`${ONBOARDED_KEY}:${templateId}`) === "1";
  } catch {
    return true;
  }
}

function readSeenDayLore(templateId: string, day: number) {
  try {
    return localStorage.getItem(`stem_lore:${templateId}:${day}`) === "1";
  } catch {
    return true;
  }
}

interface TeamDashboardPageProps {
  snapshot: GameSnapshot;
  team: TeamWithStats;
  clockOffsetMs: number;
  settingsOpen: boolean;
  onCloseSettings: () => void;
  loreOpen: boolean;
  onOpenLore: () => void;
  onCloseLore: () => void;
  run: RunAction;
}

export function TeamDashboardPage({
  snapshot,
  team,
  clockOffsetMs,
  settingsOpen,
  onCloseSettings,
  loreOpen,
  onOpenLore,
  onCloseLore,
  run,
}: TeamDashboardPageProps) {
  const { template, gameState, viewer } = snapshot;
  const [screen, setScreen] = useState<Screen>("home");
  const [onboarded, setOnboarded] = useState(() => readOnboarded(template.id));
  const [slotFilter, setSlotFilter] = useState("all");
  const [helpKey, setHelpKey] = useState<HelpKey | null>(null);
  const [toast, setToast] = useState<{ text: string; canUndo?: boolean } | null>(null);

  useEffect(() => {
    setOnboarded(readOnboarded(template.id));
  }, [template.id]);

  useEffect(() => {
    if (!onboarded || !template.features.storyBriefings) return;
    const hasBriefing = template.dayBriefings.some((b) => b.day === gameState.currentDay);
    if (hasBriefing && !readSeenDayLore(template.id, gameState.currentDay)) {
      try {
        localStorage.setItem(`stem_lore:${template.id}:${gameState.currentDay}`, "1");
      } catch {}
      onOpenLore();
    }
  }, [
    onboarded,
    template.id,
    template.features.storyBriefings,
    template.dayBriefings,
    gameState.currentDay,
    onOpenLore,
  ]);

  const countdown = useCountdown(gameState.phaseEndsAt, clockOffsetMs);
  const secondsLeft = gameState.phaseEndsAt ? countdown : null;
  const marketOpen = gameState.purchasePhaseActive && (secondsLeft === null || secondsLeft > 0);
  const isCaptain = viewer.role === "captain";
  const sections = buildRulesSections(template, gameState, gameState.dailyPurchaseLimit);
  const helpSection = helpKey ? sections.find((s) => s.key === helpKey) : undefined;
  const openAuctionCount = snapshot.auctions.filter((a) => a.status === "open").length;

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), toast.canUndo ? 6000 : 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  useTelegramBackButton(Boolean(helpKey || loreOpen || settingsOpen), () => {
    if (helpKey) setHelpKey(null);
    else if (loreOpen) onCloseLore();
    else if (settingsOpen) onCloseSettings();
  });

  const finishOnboarding = () => {
    try {
      localStorage.setItem(`${ONBOARDED_KEY}:${template.id}`, "1");
    } catch {}
    setOnboarded(true);
  };

  if (!onboarded) return <Onboarding template={template} team={team} onDone={finishOnboarding} />;

  const captain = team.captainUsername || "капитану";
  const onCardBought = (card: CardItem) => {
    setScreen("home");
    setToast({ text: `«${card.name}» в сборке · −${card.price} ${template.currencyName}`, canUndo: true });
  };
  const handleUndo = () => {
    setToast(null);
    void run(async () => {
      const result = await undoLastPurchase();
      setToast({ text: `Покупка отменена, ${template.currencyName} возвращены` });
      return result;
    });
  };

  return (
    <div className="space-y-3.5">
      <div className="sticky z-20 -mx-1 bg-bg py-1" style={{ top: "var(--app-safe-top, 0px)" }}>
        <nav aria-label="Разделы игрока" className="grid grid-cols-3 gap-1 rounded-xl bg-sf2 p-1">
          {TABS.map((t) => {
            const TabIcon = t.icon;
            const showBadge = t.id === "market" && openAuctionCount > 0 && template.features.auctions;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setScreen(t.id)}
                className={`relative flex min-h-[46px] flex-col items-center justify-center gap-0.5 rounded-[9px] text-[13px] font-medium transition ${
                  screen === t.id ? "bg-sf font-semibold text-fg shadow-xs" : "text-mu"
                }`}
              >
                <TabIcon className="h-4 w-4" />
                <span>{t.label}</span>
                {showBadge && (
                  <span
                    className="absolute top-1.5 right-2.5 h-2 w-2 rounded-full bg-warn"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>
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
          onOpenTrack={() => setScreen("race")}
          onOpenLore={onOpenLore}
          onToast={(text) => setToast({ text })}
        />
      )}

      {screen === "market" && (
        <Shop
          team={team}
          template={template}
          currentDay={gameState.currentDay}
          isOpen={marketOpen}
          gameState={gameState}
          p2pListings={snapshot.listings}
          auctions={snapshot.auctions}
          clockOffsetMs={clockOffsetMs}
          slotFilter={slotFilter}
          onChangeSlotFilter={setSlotFilter}
          role={isCaptain ? "captain" : "member"}
          onCardBought={onCardBought}
          onCardProposed={() => setToast({ text: `Предложение отправлено ${captain}` })}
          onToast={(text) => setToast({ text })}
          run={run}
        />
      )}

      {screen === "race" && (
        <div className="space-y-5">
          <TrackScreen teams={snapshot.teams} myTeamId={team.id} template={template} />
          <RulesScreen sections={sections} rulesNote={gameState.rulesUpdatedNote} />
        </div>
      )}

      <BottomSheet
        open={Boolean(helpSection)}
        onClose={() => setHelpKey(null)}
        title={helpSection?.title ?? "Справка"}
      >
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

      <LoreBriefingSheet
        open={loreOpen}
        onClose={onCloseLore}
        template={template}
        currentDay={gameState.currentDay}
      />

      <SettingsSheet
        open={settingsOpen}
        onClose={onCloseSettings}
        onOpenOnboarding={() => setOnboarded(false)}
      />

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
