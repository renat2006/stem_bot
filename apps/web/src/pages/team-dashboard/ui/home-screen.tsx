import {
  BUILTIN_CARD_TAGS,
  type CardItem,
  computeEffectiveMissionStats,
  computeEquippedCircuitLoad,
  defaultPowerCircuit,
  evaluateDualForecast,
  resolveLexicon,
  resolveMissionDay,
  TeamRoundStateSchema,
  validateP2PPrice,
} from "@stem/shared";
import { Download, Flag, Package, ShoppingBag, Store, Zap } from "lucide-react";
import { useRef, useState } from "react";
import { AssemblyStage, PackIllustration, PartSticker } from "../../../entities/assembly/index.js";
import type { GameSnapshot, TeamWithStats } from "../../../entities/game/index.js";
import {
  buyCard,
  createP2PListing,
  equipFromInventory,
  proposeCard,
} from "../../../features/purchase/index.js";
import { type RunAction, useTelegram } from "../../../shared/lib/index.js";
import { BottomSheet, Coin, ResourceMeter, StatImpactPills, sectorName } from "../../../shared/ui/index.js";
import { ProposalsInbox } from "../../../widgets/proposals-inbox/index.js";
import type { HelpKey } from "../lib/rules-sections.js";
import { RoundScreen } from "./round-screen.js";

interface HomeScreenProps {
  snapshot: GameSnapshot;
  team: TeamWithStats;
  secondsLeft: number | null;
  marketOpen: boolean;
  isCaptain: boolean;
  run: RunAction;
  onHelp: (key: HelpKey) => void;
  onOpenMarket: (slotId: string) => void;
  onOpenTrack: () => void;
  onOpenLore: () => void;
  onCardBought: (card: CardItem) => void;
  onToast: (text: string) => void;
}

export function HomeScreen({
  snapshot,
  team,
  secondsLeft,
  marketOpen,
  isCaptain,
  run,
  onOpenMarket,
  onOpenLore,
  onCardBought,
  onToast,
}: HomeScreenProps) {
  const { hapticTap } = useTelegram();
  const { template, gameState } = snapshot;
  const lexicon = snapshot.lexicon ?? resolveLexicon(template);
  const missionDay =
    snapshot.currentMissionDay?.day === gameState.currentDay
      ? snapshot.currentMissionDay
      : resolveMissionDay(template, gameState.currentDay);
  const roundState = TeamRoundStateSchema.parse(team.roundState ?? {});
  const stats = computeEffectiveMissionStats(team, template);
  const dualForecast = evaluateDualForecast({
    stats,
    day: missionDay,
    orders: roundState.orders,
    circuit: defaultPowerCircuit(template),
    equippedLoad: computeEquippedCircuitLoad(team.equippedCards, template),
  });

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [sellTarget, setSellTarget] = useState<{ card: CardItem; fromEquippedSlot?: string } | null>(null);
  const [sellPrice, setSellPrice] = useState(4);
  const [exporting, setExporting] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const cardById = new Map(template.cards.map((c) => [c.id, c]));
  const equippedCount = template.slots.filter((s) => Boolean(team.equippedCards[s.id])).length;
  const inventoryCards = (team.inventory ?? [])
    .map((id, idx) => ({ key: `${id}-${idx}`, card: cardById.get(id) }))
    .filter((e): e is { key: string; card: CardItem } => Boolean(e.card));

  const activeSlot = selectedSlotId ? template.slots.find((s) => s.id === selectedSlotId) : undefined;
  const currentEquippedInSlot = selectedSlotId ? team.equippedCards[selectedSlotId] : null;
  const currentEquippedCard = currentEquippedInSlot ? cardById.get(currentEquippedInSlot) : undefined;

  const slotCards = selectedSlotId
    ? template.cards.filter((c) => c.slotId === selectedSlotId && c.dayAvailable <= gameState.currentDay)
    : [];
  const previewCard = previewCardId ? cardById.get(previewCardId) : currentEquippedCard;

  const stageEquipped =
    selectedSlotId && previewCard && previewCard.slotId === selectedSlotId
      ? { ...team.equippedCards, [selectedSlotId]: previewCard.id }
      : team.equippedCards;

  const openSlotDrawer = (slotId: string) => {
    hapticTap();
    setSelectedSlotId(slotId);
    setPreviewCardId(team.equippedCards[slotId] ?? null);
  };

  const openSellModal = (card: CardItem, fromEquippedSlot?: string) => {
    hapticTap();
    setSelectedSlotId(null);
    setWarehouseOpen(false);
    setSellTarget({ card, fromEquippedSlot });
    setSellPrice(Math.max(1, card.price));
  };

  const priceCheck = sellTarget
    ? validateP2PPrice(sellTarget.card, sellPrice, template.features, template.currencyName)
    : null;

  const handleExportPassport = async () => {
    if (!stageRef.current || exporting) return;
    try {
      hapticTap();
      setExporting(true);
      const { domToPng } = await import("modern-screenshot");
      const dataUrl = await domToPng(stageRef.current, { scale: 2 });
      const link = document.createElement("a");
      link.download = `${team.name.replace(/\s+/g, "-").toLowerCase()}-passport.png`;
      link.href = dataUrl;
      link.click();
      onToast("Паспорт сборки сохранён в PNG");
    } catch {
      onToast("Не удалось сохранить картинку");
    } finally {
      setExporting(false);
    }
  };

  const isFreshFirstLesson =
    gameState.currentDay === 1 &&
    gameState.currentPhase === "scoring" &&
    team.currency === 0 &&
    equippedCount === 0 &&
    inventoryCards.length === 0;

  const f0 = dualForecast[0];
  const trackPct = Math.min(100, Math.round((team.trackPosition / template.trackMax) * 100));

  return (
    <div className="space-y-5">
      <RoundScreen snapshot={snapshot} team={team} secondsLeft={secondsLeft} run={run} onToast={onToast} />

      <ProposalsInbox
        proposals={snapshot.proposals}
        p2pListings={snapshot.listings}
        team={team}
        template={template}
        marketOpen={marketOpen}
        isCaptain={isCaptain}
        run={run}
      />

      {isFreshFirstLesson ? (
        <section className="space-y-3.5" aria-label="Ангар сборки">
          <div className="overflow-hidden rounded-2xl border border-ln bg-sf2">
            <PackIllustration
              template={template}
              kind="hero"
              label={lexicon.objectName}
              className="h-48 w-full object-cover"
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-bold text-ac">Ангар сборки</span>
            <h1 className="atlas-h1">Команда «{team.name}»</h1>
          </div>
          <p className="atlas-lead">
            Выполните учебное задание и покажите результат наставнику. После начисления{" "}
            {lexicon.currencyLabel.toLowerCase()} откроется сборка {lexicon.objectName.toLowerCase()}.
          </p>
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onOpenLore();
            }}
            className="atlas-quiet"
          >
            Задание дня и правила
          </button>
        </section>
      ) : (
        <section className="space-y-4" aria-label="Ангар сборки">
          <div className="space-y-1">
            <span className="text-xs font-bold text-ac">Ангар сборки · {lexicon.objectName}</span>
            <h1 className="atlas-h1">Сборка модели</h1>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-ln bg-sf p-2.5">
              <span className="flex items-center gap-1 text-[11px] font-bold text-mu">
                <Zap className="h-3 w-3 text-ac" />
                Бюджет
              </span>
              <strong className="mt-0.5 block text-base font-extrabold tabular-nums text-fg">
                {team.currency} {lexicon.currencyUnit}
              </strong>
            </div>
            <div className="rounded-xl border border-ln bg-sf p-2.5">
              <span className="text-[11px] font-bold text-mu">Шаг хода</span>
              <strong className="mt-0.5 block text-base font-extrabold tabular-nums text-fg">
                +{team.computedStats.step.total}
              </strong>
            </div>
            <div className="rounded-xl border border-ln bg-sf p-2.5">
              <span className="flex items-center gap-1 text-[11px] font-bold text-mu">
                <Flag className="h-3 w-3 text-ac" />
                Маршрут
              </span>
              <strong className="mt-0.5 block text-base font-extrabold tabular-nums text-fg">
                {team.trackPosition}/{template.trackMax}
              </strong>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sf2">
                <div className="h-full rounded-full bg-ac" style={{ width: `${trackPct}%` }} />
              </div>
            </div>
          </div>

          {f0 && (
            <details className="rounded-xl border border-ln bg-sf px-3.5 py-2.5 text-sm">
              <summary className="font-bold text-fg">Готовность запаса к маршруту</summary>
              <div className="mt-3 space-y-2.5 text-xs text-mu">
                <div>
                  <div className="flex justify-between font-semibold text-fg">
                    <span>{sectorName(lexicon.sectorALabel)}</span>
                    <span className="tabular-nums">
                      {f0.sectorA.resource} из {f0.sectorA.threshold}
                    </span>
                  </div>
                  <ResourceMeter value={f0.sectorA.resource} threshold={f0.sectorA.threshold} />
                </div>
                <div>
                  <div className="flex justify-between font-semibold text-fg">
                    <span>{sectorName(lexicon.sectorBLabel)}</span>
                    <span className="tabular-nums">
                      {f0.sectorB.resource} из {f0.sectorB.threshold}
                    </span>
                  </div>
                  <ResourceMeter value={f0.sectorB.resource} threshold={f0.sectorB.threshold} />
                </div>
              </div>
            </details>
          )}

          <div ref={stageRef} className="assembly-clean space-y-3">
            <AssemblyStage
              template={template}
              equipped={stageEquipped}
              size="card"
              interactive
              onSlotTap={openSlotDrawer}
              teamName={team.name}
            />

            <div className="slot-list">
              {template.slots.map((slot) => {
                const partId = team.equippedCards[slot.id];
                const part = partId ? cardById.get(partId) : undefined;
                return (
                  <button key={slot.id} type="button" onClick={() => openSlotDrawer(slot.id)}>
                    {part && <PartSticker template={template} card={part} thumbnail />}
                    <span className="min-w-0">
                      <span className="block truncate">{slot.label}</span>
                      <small className="truncate">{part?.name ?? "Выбрать узел"}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {template.features.slotInventory && (
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setWarehouseOpen(true);
                }}
                className="atlas-quiet flex-1"
              >
                <Package className="h-4 w-4 text-ac" />
                <span>Склад ({inventoryCards.length})</span>
              </button>
            )}
            <button
              type="button"
              disabled={exporting}
              onClick={handleExportPassport}
              className="atlas-quiet flex-1"
            >
              <Download className="h-4 w-4 text-ac" />
              <span>{exporting ? "Сохраняем…" : "Паспорт PNG"}</span>
            </button>
          </div>
        </section>
      )}

      <BottomSheet
        open={Boolean(activeSlot)}
        onClose={() => setSelectedSlotId(null)}
        title={activeSlot?.label ?? "Узел сборки"}
      >
        {activeSlot && (
          <div className="space-y-3.5">
            <p className="text-xs text-mu">
              {marketOpen
                ? "Мастерская открыта. Узлы со склада переставляются бесплатно."
                : "Покупки сейчас закрыты, но узлы со склада можно менять."}
            </p>

            <div className="space-y-2">
              {slotCards.map((c) => {
                const isEquipped = currentEquippedInSlot === c.id;
                const inWarehouse = (team.inventory ?? []).includes(c.id);
                const selected = (previewCard?.id ?? "") === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      hapticTap();
                      setPreviewCardId(c.id);
                    }}
                    className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border border-ln bg-sf p-2.5 text-left text-sm font-bold text-fg aria-pressed:border-ac aria-pressed:bg-sf2"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <PartSticker template={template} card={c} thumbnail />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-sf2 px-2 py-1 text-xs font-bold tabular-nums text-mu">
                      {isEquipped ? "В слоте" : inWarehouse ? "Склад" : `${c.price} ${lexicon.currencyUnit}`}
                    </span>
                  </button>
                );
              })}
            </div>

            {previewCard && (
              <div className="space-y-3 border-t border-ln pt-3">
                <StatImpactPills stats={template.stats} deltas={previewCard.stats} />

                {template.features.actionTags !== false &&
                  (previewCard.actionBadge || BUILTIN_CARD_TAGS[previewCard.id]?.badgeLabel) && (
                    <p className="rounded-lg bg-sf2 px-2.5 py-1.5 text-xs font-bold text-ac">
                      {previewCard.actionBadge ?? BUILTIN_CARD_TAGS[previewCard.id]?.badgeLabel}
                    </p>
                  )}

                {currentEquippedInSlot === previewCard.id ? (
                  <div className="flex flex-wrap gap-2">
                    {isCaptain && template.features.slotInventory && (
                      <button
                        type="button"
                        onClick={() => {
                          const slotId = activeSlot.id;
                          setSelectedSlotId(null);
                          void run(() => equipFromInventory(slotId, null)).then((ok) => {
                            if (ok) onToast("Деталь снята на склад");
                          });
                        }}
                        className="atlas-quiet flex-1"
                      >
                        Снять на склад
                      </button>
                    )}
                    {isCaptain && template.features.p2pMarket && (
                      <button
                        type="button"
                        disabled={!marketOpen}
                        onClick={() => openSellModal(previewCard, activeSlot.id)}
                        className="atlas-quiet flex-1 disabled:opacity-45"
                      >
                        <Store className="h-4 w-4 text-ac" />
                        <span>На биржу</span>
                      </button>
                    )}
                  </div>
                ) : (team.inventory ?? []).includes(previewCard.id) ? (
                  isCaptain && (
                    <button
                      type="button"
                      onClick={() => {
                        const slotId = activeSlot.id;
                        const card = previewCard;
                        setSelectedSlotId(null);
                        void run(() => equipFromInventory(slotId, card.id)).then((ok) => {
                          if (ok) onToast(`«${card.name}» установлена со склада`);
                        });
                      }}
                      className="atlas-primary"
                    >
                      Поставить со склада
                    </button>
                  )
                ) : isCaptain ? (
                  <button
                    type="button"
                    disabled={!marketOpen || team.currency < previewCard.price}
                    onClick={() => {
                      const card = previewCard;
                      setSelectedSlotId(null);
                      void run(() => buyCard(card.id)).then((ok) => {
                        if (ok) onCardBought(card);
                      });
                    }}
                    className="atlas-primary"
                  >
                    Купить за {previewCard.price} {lexicon.currencyUnit}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!marketOpen}
                    onClick={() => {
                      const card = previewCard;
                      setSelectedSlotId(null);
                      void run(() => proposeCard(card.id)).then((ok) => {
                        if (ok) onToast("Предложение отправлено капитану");
                      });
                    }}
                    className="atlas-primary"
                  >
                    Предложить команде
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                hapticTap();
                const slotId = activeSlot.id;
                setSelectedSlotId(null);
                onOpenMarket(slotId);
              }}
              className="atlas-quiet w-full"
            >
              <ShoppingBag className="h-4 w-4 text-ac" />
              <span>Открыть весь каталог и биржу</span>
            </button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={warehouseOpen}
        onClose={() => setWarehouseOpen(false)}
        title={`Склад команды (${inventoryCards.length})`}
      >
        <div className="space-y-3">
          {inventoryCards.length === 0 ? (
            <p className="text-sm text-mu">
              Склад пуст. Снятые или заменённые узлы сохраняются здесь бесплатно.
            </p>
          ) : (
            inventoryCards.map(({ key, card }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl border border-ln bg-sf p-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <PartSticker template={template} card={card} thumbnail />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-fg">{card.name}</p>
                    <p className="text-xs text-mu">
                      {template.slots.find((s) => s.id === card.slotId)?.label}
                    </p>
                  </div>
                </div>
                {isCaptain && (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setWarehouseOpen(false);
                        void run(() => equipFromInventory(card.slotId, card.id)).then((ok) => {
                          if (ok) onToast(`«${card.name}» установлена в сборку`);
                        });
                      }}
                      className="min-h-[40px] rounded-xl bg-ac px-3 text-xs font-bold text-acfg"
                    >
                      Поставить
                    </button>
                    {template.features.p2pMarket && (
                      <button
                        type="button"
                        disabled={!marketOpen}
                        onClick={() => openSellModal(card)}
                        className="min-h-[40px] rounded-xl border border-ln bg-sf2 px-2.5 text-xs font-bold text-fg disabled:opacity-45"
                      >
                        На биржу
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </BottomSheet>

      <BottomSheet
        open={Boolean(sellTarget && priceCheck)}
        onClose={() => setSellTarget(null)}
        title="Выставить деталь на биржу"
      >
        {sellTarget && priceCheck && (
          <div className="space-y-4">
            <div>
              <h3 className="atlas-h2">{sellTarget.card.name}</h3>
              <p className="mt-1 text-xs text-mu">
                Ценовой коридор: от {priceCheck.minPrice} до {priceCheck.maxPrice} {template.currencyName}.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-ln bg-sf p-4">
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setSellPrice((p) => Math.max(priceCheck.minPrice, p - 1));
                }}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-sf2 text-xl font-bold text-fg"
              >
                −
              </button>
              <div className="flex flex-col items-center">
                <span className="flex items-center gap-2 text-3xl font-extrabold tabular-nums text-fg">
                  {sellPrice}
                  <Coin size={20} />
                </span>
                <span className="mt-1 text-xs text-mu">
                  к зачислению {priceCheck.sellerReceives} {template.currencyName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setSellPrice((p) => Math.min(priceCheck.maxPrice, p + 1));
                }}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-sf2 text-xl font-bold text-fg"
              >
                +
              </button>
            </div>

            <button
              type="button"
              disabled={!priceCheck.ok}
              onClick={() => {
                const payload = {
                  cardId: sellTarget.card.id,
                  price: sellPrice,
                  fromEquippedSlot: sellTarget.fromEquippedSlot,
                };
                setSellTarget(null);
                void run(() => createP2PListing(payload)).then((ok) => {
                  if (ok) onToast("Лот опубликован на бирже команд");
                });
              }}
              className="atlas-primary"
            >
              Выставить за {sellPrice} {template.currencyName}
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
