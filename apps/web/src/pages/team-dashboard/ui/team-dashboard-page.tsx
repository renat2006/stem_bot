import { type CardItem, resolveDayEngine, resolveLexicon, usesPhysicalBoard } from "@stem/shared";
import { Compass, Settings, ShoppingBag, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import type { GameSnapshot, TeamWithStats } from "../../../entities/game/index.js";
import { undoLastPurchase } from "../../../features/purchase/index.js";
import {
  type RunAction,
  useCountdown,
  useTelegram,
  useTelegramBackButton,
} from "../../../shared/lib/index.js";
import { BottomSheet, Mark, SpiralBoard, TabletopBoard, ToastWithUndo } from "../../../shared/ui/index.js";
import { PlayerGuide } from "../../../widgets/player-guide/index.js";
import { SettingsSheet } from "../../../widgets/settings-sheet/index.js";
import { Shop } from "../../../widgets/shop/index.js";
import { buildRulesSections, type HelpKey } from "../lib/rules-sections.js";
import { HomeScreen } from "./home-screen.js";
import { LoreBriefingSheet } from "./lore-sheet.js";
import { RulesRows } from "./rules-rows.js";
import { RulesScreen } from "./rules-screen.js";

type Screen = "home" | "market" | "race";

const TABS: Array<{ id: Screen; label: string; icon: typeof Wrench }> = [
  { id: "home", label: "Ангар", icon: Wrench },
  { id: "market", label: "Рынок", icon: ShoppingBag },
  { id: "race", label: "Маршрут и FAQ", icon: Compass },
];

const ONBOARDED_KEY = "stem_onboarded";

function initialScreen(): Screen {
  if (typeof window === "undefined") return "home";
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (tab === "market" || tab === "race" || tab === "home") return tab;
  return "home";
}

function readOnboarded(templateId: string) {
  try {
    return localStorage.getItem(`${ONBOARDED_KEY}:${templateId}`) === "1";
  } catch {
    return true;
  }
}

interface TeamDashboardPageProps {
  snapshot: GameSnapshot;
  team: TeamWithStats;
  clockOffsetMs: number;
  settingsOpen: boolean;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  loreOpen: boolean;
  onOpenLore: () => void;
  onCloseLore: () => void;
  onOpenPlayground: () => void;
  run: RunAction;
}

export function TeamDashboardPage({
  snapshot,
  team,
  clockOffsetMs,
  settingsOpen,
  onOpenSettings,
  onCloseSettings,
  loreOpen,
  onOpenLore,
  onCloseLore,
  onOpenPlayground,
  run,
}: TeamDashboardPageProps) {
  const { hapticTap } = useTelegram();
  const { template, gameState, viewer } = snapshot;
  const lexicon = snapshot.lexicon ?? resolveLexicon(template);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [onboarded, setOnboarded] = useState(() => readOnboarded(template.id));
  const [slotFilter, setSlotFilter] = useState("all");
  const [helpKey, setHelpKey] = useState<HelpKey | null>(null);
  const [toast, setToast] = useState<{ text: string; canUndo?: boolean } | null>(null);

  useEffect(() => {
    setOnboarded(readOnboarded(template.id));
  }, [template.id]);

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

  if (!onboarded) {
    return <PlayerGuide template={template} teamName={team.name} onDone={finishOnboarding} />;
  }

  const captain = team.captainUsername || "капитану";
  const onCardBought = (card: CardItem) => {
    setScreen("home");
    setToast({ text: `«${card.name}» в сборке (−${card.price} ${template.currencyName})`, canUndo: true });
  };
  const handleUndo = () => {
    setToast(null);
    void run(async () => {
      const result = await undoLastPurchase();
      setToast({ text: `Покупка отменена, ${template.currencyName} возвращены` });
      return result;
    });
  };

  const physical = usesPhysicalBoard(
    template,
    gameState.roundEngine ?? resolveDayEngine(template, gameState.currentDay),
  );

  const switchScreen = (next: Screen) => {
    hapticTap();
    setScreen(next);
  };

  const mobileLabels: Record<Screen, string> = { home: "Команда", market: "Магазин", race: "Поле и правила" };
  const rankedTeams = [...snapshot.teams].sort((a, b) => b.trackPosition - a.trackPosition);

  return (
    <article className="atlas-player">
      <header>
        <button
          type="button"
          className="story-btn"
          aria-label="Сюжетная сводка дня"
          onClick={() => {
            hapticTap();
            onOpenLore();
          }}
        >
          <Mark kind="team" />
        </button>
        <div className="min-w-0">
          <span className="block truncate text-sm font-extrabold text-fg">{team.name}</span>
          <span className="block text-xs font-semibold text-mu">
            День {gameState.currentDay} · {team.currency} {lexicon.currencyUnit}
          </span>
        </div>
        <div className="header-actions">
          {!physical && template.features.offClassPlayground !== false && (
            <button
              type="button"
              aria-label="Тренировка без зачёта"
              onClick={() => {
                hapticTap();
                onOpenPlayground();
              }}
              className="atlas-icon-btn"
            >
              <Mark kind="practice" />
            </button>
          )}
          <button
            type="button"
            aria-label="Настройки отображения"
            onClick={() => {
              hapticTap();
              onOpenSettings();
            }}
            className="atlas-icon-btn"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <nav aria-label="Разделы игрока" className="atlas-desktop-tabs">
        {TABS.map((t) => {
          const TabIcon = t.icon;
          const showBadge = t.id === "market" && openAuctionCount > 0 && template.features.auctions;
          return (
            <button
              key={t.id}
              type="button"
              aria-current={screen === t.id ? "page" : undefined}
              onClick={() => switchScreen(t.id)}
            >
              <TabIcon className="h-4 w-4" />
              <span>{t.label}</span>
              {showBadge && <span className="h-2 w-2 rounded-full bg-warn" aria-hidden="true" />}
            </button>
          );
        })}
      </nav>

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
          onCardBought={onCardBought}
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
          <div className="tablepage">
            {physical && template.boardCells.length === 16 ? (
              <>
                <div>
                  <h2 className="atlas-h2">Квадрат событий</h2>
                  <p className="mt-1 text-sm text-mu">
                    Нажмите на любую клетку 1–16, чтобы увидеть её правило и расчёт для вашей сборки. Внутри —{" "}
                    {template.trackName} до {template.trackMax}.
                  </p>
                </div>
                <TabletopBoard
                  template={template}
                  boardTokens={snapshot.teams.map((t) => ({
                    id: t.id,
                    name: t.name,
                    position: t.boardPosition,
                    highlight: t.id === team.id,
                  }))}
                  spiralTokens={snapshot.teams.map((t) => ({
                    id: t.id,
                    name: t.name,
                    position: t.trackPosition,
                    highlight: t.id === team.id,
                  }))}
                  viewerTeam={team}
                  compact
                />
              </>
            ) : (
              <>
                <h2 className="atlas-h2">{template.trackName}</h2>
                <SpiralBoard
                  labels={Array.from({ length: template.trackMax }, (_, i) => String(i + 1))}
                  tokens={snapshot.teams.map((t) => ({
                    id: t.id,
                    name: t.name,
                    position: t.trackPosition,
                    highlight: t.id === team.id,
                  }))}
                  spiral
                />
              </>
            )}

            <div className="space-y-1.5 pt-1">
              {rankedTeams.map((t, idx) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg bg-sf px-3 py-2 text-xs font-bold text-fg"
                >
                  <span>
                    #{idx + 1} {t.name}
                  </span>
                  <span className="tabular-nums text-ac">
                    {t.trackPosition}/{template.trackMax}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {snapshot.feed.some((entry) => entry.kind === "step") && (
            <section className="space-y-2 rounded-xl border border-ln bg-sf p-4">
              <h2 className="atlas-h2">Последние ходы</h2>
              {snapshot.feed
                .filter((entry) => entry.kind === "step")
                .slice(0, 8)
                .map((entry) => (
                  <p className="text-sm text-mu" key={entry.id}>
                    {snapshot.teams.find((t) => t.id === entry.teamId)?.name} · {entry.text}
                  </p>
                ))}
            </section>
          )}
          <RulesScreen sections={sections} rulesNote={gameState.rulesUpdatedNote} />
        </div>
      )}

      <nav aria-label="Нижняя панель игрока" className="atlas-mobile-dock">
        {TABS.map((t) => {
          const TabIcon = t.icon;
          const showBadge = t.id === "market" && openAuctionCount > 0 && template.features.auctions;
          return (
            <button
              key={t.id}
              type="button"
              aria-current={screen === t.id ? "page" : undefined}
              onClick={() => switchScreen(t.id)}
            >
              <TabIcon className="h-5 w-5" />
              <span>{mobileLabels[t.id]}</span>
              {showBadge && (
                <span className="absolute top-2 right-5 h-2 w-2 rounded-full bg-warn" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </nav>

      <BottomSheet
        open={Boolean(helpSection)}
        onClose={() => setHelpKey(null)}
        title={helpSection?.title ?? "Справка"}
      >
        {helpSection && (
          <>
            <span className="text-xs font-bold text-ac">{helpSection.module}</span>
            <h3 className="atlas-h2">{helpSection.title}</h3>
            <RulesRows rows={helpSection.rows} tone="sf" />
            <button type="button" onClick={() => setHelpKey(null)} className="atlas-primary mt-2">
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
    </article>
  );
}
