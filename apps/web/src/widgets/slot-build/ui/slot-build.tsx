import { type CardItem, type GameState, type GameTemplate, validateP2PPrice } from "@stem/shared";
import { ArrowLeftRight, Download, Package, ShoppingBag, Store } from "lucide-react";
import { useRef, useState } from "react";
import { AssemblyStage, PackSymbol, PartSticker } from "../../../entities/assembly/index.js";
import { StatDeltaList } from "../../../entities/card/index.js";
import type { TeamWithStats } from "../../../entities/game/index.js";
import { createP2PListing, equipFromInventory } from "../../../features/purchase/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import {
  BottomSheet,
  Coin,
  EffectScopeBadge,
  formatStatValue,
  ModuleCard,
  RarityBadge,
  StatGlyph,
} from "../../../shared/ui/index.js";

interface SlotBuildProps {
  team: TeamWithStats;
  template: GameTemplate;
  gameState?: GameState;
  isCaptain?: boolean;
  marketOpen?: boolean;
  run?: RunAction;
  onSelectEmptySlot?: (slotId: string) => void;
  onHelp?: () => void;
  onToast?: (text: string) => void;
}

export function SlotBuild({
  team,
  template,
  gameState,
  isCaptain = false,
  marketOpen = false,
  run,
  onSelectEmptySlot,
  onHelp,
  onToast,
}: SlotBuildProps) {
  const cardById = new Map(template.cards.map((card) => [card.id, card]));
  const currentDay = gameState?.currentDay ?? 1;
  const stockLeft = gameState?.cardStockLeft ?? {};
  const hasInventory = template.features.slotInventory;
  const hasP2P = template.features.p2pMarket;

  const [mode, setMode] = useState<"equipped" | "inventory">("equipped");
  const [inspectSlotId, setInspectSlotId] = useState<string | null>(null);
  const [sellTarget, setSellTarget] = useState<{ card: CardItem; fromEquippedSlot?: string } | null>(null);
  const [sellPrice, setSellPrice] = useState(4);
  const [exporting, setExporting] = useState(false);
  const passportRef = useRef<HTMLDivElement>(null);

  const equippedCount = template.slots.filter((s) => Boolean(team.equippedCards[s.id])).length;
  const inventoryCards = (team.inventory ?? [])
    .map((id, idx) => ({ key: `${id}-${idx}`, card: cardById.get(id) }))
    .filter((entry): entry is { key: string; card: CardItem } => Boolean(entry.card));

  const buildLine = `${template.objectName.toLowerCase()} · ${equippedCount} из ${template.slots.length}`;
  const activePerk = template.perks.find((p) => p.id === team.activePerkId);

  const inspectedSlot = inspectSlotId ? template.slots.find((s) => s.id === inspectSlotId) : undefined;
  const inspectedCardId = inspectSlotId ? team.equippedCards[inspectSlotId] : null;
  const inspectedCard = inspectedCardId ? cardById.get(inspectedCardId) : undefined;
  const compatibleInWarehouse = inspectSlotId
    ? inventoryCards.filter((entry) => entry.card.slotId === inspectSlotId)
    : [];

  const openSellSheet = (card: CardItem, fromEquippedSlot?: string) => {
    setInspectSlotId(null);
    setSellTarget({ card, fromEquippedSlot });
    setSellPrice(Math.max(1, card.price));
  };

  const priceCheck = sellTarget
    ? validateP2PPrice(sellTarget.card, sellPrice, template.features, template.currencyName)
    : null;

  const handleExportPassport = async () => {
    if (!passportRef.current || exporting) return;
    try {
      setExporting(true);
      const { domToPng } = await import("modern-screenshot");
      const dataUrl = await domToPng(passportRef.current, { scale: 2 });
      const link = document.createElement("a");
      link.download = `${team.name.replace(/\s+/g, "-").toLowerCase()}-passport.png`;
      link.href = dataUrl;
      link.click();
      onToast?.("Паспорт сборки сохранён в PNG");
    } catch {
      onToast?.("Не удалось сохранить картинку");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <ModuleCard
        title="Ангар сборки"
        subtitle={buildLine}
        onHelp={onHelp}
        badge={
          <button
            type="button"
            onClick={handleExportPassport}
            disabled={exporting}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ln bg-sf2 px-2.5 text-xs font-medium text-fg transition hover:border-ac disabled:opacity-50"
            title="Скачать карточку сборки в PNG"
          >
            <Download className="h-3.5 w-3.5 text-ac" />
            <span>{exporting ? "..." : "Паспорт"}</span>
          </button>
        }
        noPadding
      >
        <div className="space-y-3 p-3.5">
          <div ref={passportRef} className="space-y-2.5 rounded-2xl bg-sf">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ln bg-sf2 px-3.5 py-2.5 text-fg">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold tracking-[0.06em] uppercase opacity-80">
                  {template.objectName}
                </span>
                <span className="rounded bg-ac/15 px-2 py-0.5 font-mono text-xs font-semibold text-ac">
                  шаг +{team.computedStats.step.total}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {template.stats.map((stat) => (
                  <span
                    key={stat.id}
                    title={stat.label}
                    className="flex items-center gap-1.5 font-mono text-sm font-semibold"
                  >
                    <StatGlyph shape={stat.shape} color={stat.color} size={11} />
                    {formatStatValue(team.computedStats.total[stat.id] ?? 0)}
                  </span>
                ))}
              </div>
            </div>

            <AssemblyStage
              template={template}
              equipped={team.equippedCards}
              teamName={team.name}
              interactive
              selectedSlotId={inspectSlotId}
              onSlotTap={(slotId) => {
                if (team.equippedCards[slotId]) {
                  setInspectSlotId(slotId);
                } else {
                  onSelectEmptySlot?.(slotId);
                }
              }}
            />
          </div>

          {hasInventory && (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-sf2 p-1">
              <button
                type="button"
                onClick={() => setMode("equipped")}
                className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition ${
                  mode === "equipped" ? "bg-sf text-fg shadow-xs" : "text-mu"
                }`}
              >
                <span>
                  Слоты ({equippedCount}/{template.slots.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("inventory")}
                className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition ${
                  mode === "inventory" ? "bg-sf text-fg shadow-xs" : "text-mu"
                }`}
              >
                <Package className="h-3.5 w-3.5" />
                <span>Склад ({inventoryCards.length})</span>
              </button>
            </div>
          )}

          {mode === "equipped" || !hasInventory ? (
            <div className="grid grid-cols-2 gap-2">
              {template.slots.map((slot) => {
                const equippedId = team.equippedCards[slot.id];
                const card = equippedId ? cardById.get(equippedId) : undefined;
                const availOnMarket = template.cards.filter(
                  (c) =>
                    c.slotId === slot.id && c.dayAvailable <= currentDay && (stockLeft[c.id] ?? c.stock) > 0,
                ).length;

                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => {
                      if (card) setInspectSlotId(slot.id);
                      else onSelectEmptySlot?.(slot.id);
                    }}
                    className={`flex min-h-[90px] flex-col justify-between gap-1.5 rounded-xl p-3 text-left transition active:scale-[0.98] ${
                      card
                        ? "border border-ln bg-sf text-fg shadow-2xs"
                        : "border-[1.5px] border-dashed border-ac/70 bg-sf/50 text-mu"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-mono text-[11px] font-medium tracking-[0.05em] uppercase text-mu">
                          {slot.label}
                        </span>
                        {card && card.rarity !== "common" && <RarityBadge rarity={card.rarity} compact />}
                      </div>
                      <span className="block text-[13.5px] leading-snug font-semibold">
                        {card ? card.name : availOnMarket > 0 ? `+ Выбрать (${availOnMarket})` : "Пусто"}
                      </span>
                    </div>
                    {card && <StatDeltaList stats={template.stats} deltas={card.stats} />}
                  </button>
                );
              })}
            </div>
          ) : inventoryCards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ln p-4 text-center text-xs text-mu">
              На складе пока пусто. Когда вы заменяете установленную деталь новой покупкой, старая остаётся
              здесь — её можно вернуть в сборку или продать на бирже команд.
            </div>
          ) : (
            <div className="space-y-2">
              {inventoryCards.map(({ key, card }) => {
                const slot = template.slots.find((s) => s.id === card.slotId);
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-ln bg-sf p-3"
                  >
                    <PartSticker card={card} template={template} thumbnail />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] uppercase text-mu">
                          {slot?.label ?? card.slotId}
                        </span>
                        <RarityBadge rarity={card.rarity} compact />
                      </div>
                      <p className="truncate text-sm font-semibold text-fg">{card.name}</p>
                      <StatDeltaList stats={template.stats} deltas={card.stats} />
                    </div>
                    {isCaptain && run && (
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            void run(() => equipFromInventory(card.slotId, card.id)).then((ok) => {
                              if (ok) onToast?.(`«${card.name}» установлена в сборку`);
                            })
                          }
                          className="min-h-[36px] rounded-lg bg-ac px-3 text-xs font-semibold text-acfg"
                        >
                          Поставить
                        </button>
                        {hasP2P && (
                          <button
                            type="button"
                            disabled={!marketOpen}
                            onClick={() => openSellSheet(card)}
                            className="min-h-[34px] rounded-lg border border-ln bg-sf2 px-2.5 text-xs font-medium text-fg disabled:opacity-45"
                          >
                            На биржу
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activePerk && (
            <div className="flex items-center gap-3 rounded-xl border border-ln bg-sf p-3">
              <PackSymbol
                template={template}
                kind="perk"
                id={activePerk.id}
                label={activePerk.name}
                size={36}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-semibold text-fg">{activePerk.name}</span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-medium ${
                      team.computedStats.perkConditionMet ? "bg-pos/15 text-pos" : "bg-sf2 text-mu"
                    }`}
                  >
                    {team.computedStats.perkConditionMet ? "активно" : "ждёт порога"}
                  </span>
                </div>
                <span className="text-xs leading-snug text-mu">{activePerk.effectText}</span>
              </div>
            </div>
          )}
        </div>
      </ModuleCard>

      <BottomSheet
        open={Boolean(inspectedSlot && inspectedCard)}
        onClose={() => setInspectSlotId(null)}
        title={inspectedCard?.name ?? "Слот сборки"}
      >
        {inspectedSlot && inspectedCard && (
          <div className="space-y-3.5">
            <div className="flex items-start gap-3">
              <PartSticker card={inspectedCard} template={template} thumbnail />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] uppercase text-mu">{inspectedSlot.label}</span>
                  <RarityBadge rarity={inspectedCard.rarity} compact />
                </div>
                <h3 className="text-lg leading-tight font-semibold text-fg">{inspectedCard.name}</h3>
                {inspectedCard.flavor && <p className="text-xs text-mu">{inspectedCard.flavor}</p>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatDeltaList stats={template.stats} deltas={inspectedCard.stats} size="lg" />
              <EffectScopeBadge scope={inspectedCard.effectScope} />
            </div>

            {hasInventory && compatibleInWarehouse.length > 0 && isCaptain && run && (
              <div className="space-y-2 rounded-xl border border-ln bg-sf p-3">
                <p className="text-xs font-semibold text-mu">Заменить со склада:</p>
                {compatibleInWarehouse.map(({ key, card }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setInspectSlotId(null);
                      void run(() => equipFromInventory(inspectedSlot.id, card.id)).then((ok) => {
                        if (ok) onToast?.(`В слот установлена «${card.name}»`);
                      });
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-sf2 px-3 py-2 text-left text-sm font-medium text-fg"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <ArrowLeftRight className="h-4 w-4 shrink-0 text-ac" />
                      {card.name}
                    </span>
                    <StatDeltaList stats={template.stats} deltas={card.stats} />
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  const id = inspectedSlot.id;
                  setInspectSlotId(null);
                  onSelectEmptySlot?.(id);
                }}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ac px-4 text-sm font-semibold text-acfg"
              >
                <ShoppingBag className="h-4 w-4" />
                Искать замену в магазине
              </button>

              {isCaptain && hasInventory && run && (
                <button
                  type="button"
                  onClick={() => {
                    const id = inspectedSlot.id;
                    setInspectSlotId(null);
                    void run(() => equipFromInventory(id, null)).then((ok) => {
                      if (ok) onToast?.("Деталь снята на склад");
                    });
                  }}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-ln bg-sf px-4 text-sm font-medium text-fg"
                >
                  <Package className="h-4 w-4" />
                  Снять на склад
                </button>
              )}

              {isCaptain && hasP2P && (
                <button
                  type="button"
                  disabled={!marketOpen}
                  onClick={() => openSellSheet(inspectedCard, inspectedSlot.id)}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-ln bg-sf px-4 text-sm font-medium text-fg disabled:opacity-45 sm:col-span-2"
                >
                  <Store className="h-4 w-4 text-ac" />
                  {marketOpen ? "Выставить на биржу команд" : "Биржа доступна в фазу рынка"}
                </button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={Boolean(sellTarget && priceCheck)}
        onClose={() => setSellTarget(null)}
        title="Выставить деталь на биржу"
      >
        {sellTarget && priceCheck && (
          <div className="space-y-4">
            <div>
              <p className="font-mono text-[11px] uppercase text-mu">Продажа другим командам</p>
              <h3 className="text-xl font-semibold text-fg">{sellTarget.card.name}</h3>
              <p className="mt-1 text-xs text-mu">
                Честный коридор цены: от {priceCheck.minPrice} до {priceCheck.maxPrice}{" "}
                {template.currencyName} (базовая цена {sellTarget.card.price}).
              </p>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-ln bg-sf p-4">
              <button
                type="button"
                onClick={() => setSellPrice((p) => Math.max(priceCheck.minPrice, p - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-sf2 font-mono text-xl font-semibold text-fg"
              >
                −
              </button>
              <div className="flex flex-col items-center">
                <span className="flex items-center gap-2 font-mono text-3xl font-semibold text-fg">
                  {sellPrice}
                  <Coin size={20} />
                </span>
                <span className="mt-1 text-xs text-mu">
                  команда получит {priceCheck.sellerReceives} {template.currencyName}
                  {priceCheck.fee > 0 ? ` (комиссия ${priceCheck.fee})` : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSellPrice((p) => Math.min(priceCheck.maxPrice, p + 1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-sf2 font-mono text-xl font-semibold text-fg"
              >
                +
              </button>
            </div>

            {!priceCheck.ok && priceCheck.reason && (
              <p className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
                {priceCheck.reason}
              </p>
            )}

            <button
              type="button"
              disabled={!priceCheck.ok || !run}
              onClick={() => {
                if (!run) return;
                const payload = {
                  cardId: sellTarget.card.id,
                  price: sellPrice,
                  fromEquippedSlot: sellTarget.fromEquippedSlot,
                };
                setSellTarget(null);
                void run(() => createP2PListing(payload)).then((ok) => {
                  if (ok) onToast?.("Лот опубликован на бирже команд");
                });
              }}
              className="h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg disabled:opacity-45"
            >
              Выставить за {sellPrice} {template.currencyName}
            </button>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
