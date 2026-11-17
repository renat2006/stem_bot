import { type CardItem, type GameTemplate, previewCardEffect, validateP2PPrice } from "@stem/shared";
import { Plus, Store, Trash2 } from "lucide-react";
import { useState } from "react";
import { AssemblyStage, PartSticker } from "../../../entities/assembly/index.js";
import { StatDeltaList } from "../../../entities/card/index.js";
import type { P2PListing, TeamWithStats } from "../../../entities/game/index.js";
import {
  buyP2PListing,
  cancelP2PListing,
  createP2PListing,
  proposeCard,
} from "../../../features/purchase/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import { BottomSheet, Coin, EffectScopeBadge, formatSigned, RarityBadge } from "../../../shared/ui/index.js";

export function P2PMarketView({
  listings,
  team,
  template,
  isOpen,
  isCaptain,
  run,
  onToast,
}: {
  listings: P2PListing[];
  team: TeamWithStats;
  template: GameTemplate;
  isOpen: boolean;
  isCaptain: boolean;
  run: RunAction;
  onToast?: (text: string) => void;
}) {
  const cardById = new Map(template.cards.map((c) => [c.id, c]));
  const slotLabel = new Map(template.slots.map((s) => [s.id, s.label]));
  const activeListings = listings;

  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedSellKey, setSelectedSellKey] = useState<string>("");
  const [sellPrice, setSellPrice] = useState(4);

  const sellCandidates: Array<{
    key: string;
    card: CardItem;
    fromEquippedSlot?: string;
    sourceLabel: string;
  }> = [];
  for (const [idx, cardId] of (team.inventory ?? []).entries()) {
    const card = cardById.get(cardId);
    if (card) sellCandidates.push({ key: `inv-${idx}-${cardId}`, card, sourceLabel: "Со склада" });
  }
  for (const slot of template.slots) {
    const cardId = team.equippedCards[slot.id];
    const card = cardId ? cardById.get(cardId) : undefined;
    if (card) {
      sellCandidates.push({
        key: `eq-${slot.id}`,
        card,
        fromEquippedSlot: slot.id,
        sourceLabel: `Из слота «${slot.label}»`,
      });
    }
  }

  const chosenSell = sellCandidates.find((c) => c.key === selectedSellKey) ?? sellCandidates[0];
  const priceCheck = chosenSell
    ? validateP2PPrice(chosenSell.card, sellPrice, template.features, template.currencyName)
    : null;

  const selectedListing = selectedListingId
    ? activeListings.find((l) => l.id === selectedListingId)
    : undefined;
  const selectedCard = selectedListing ? cardById.get(selectedListing.cardId) : undefined;
  const selectedPreview = selectedCard ? previewCardEffect(team, selectedCard, template) : undefined;
  const availableCurrency = team.currency - (team.heldCurrency ?? 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-ln bg-sf p-3.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">Прямые сделки между командами</p>
          <p className="mt-0.5 text-xs text-mu">
            Цены ограничены честным коридором ({Math.round(template.features.p2pMinPriceRatio * 100)}%–
            {Math.round(template.features.p2pMaxPriceRatio * 100)}% от номинала)
            {template.features.p2pFeePercent > 0 ? ` · комиссия ${template.features.p2pFeePercent}%` : ""}.
          </p>
        </div>
        {isCaptain && (
          <button
            type="button"
            disabled={!isOpen || sellCandidates.length === 0}
            onClick={() => {
              const first = sellCandidates[0];
              if (first) {
                setSelectedSellKey(first.key);
                setSellPrice(Math.max(1, first.card.price));
                setCreateOpen(true);
              }
            }}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-ac px-3.5 text-xs font-semibold text-acfg disabled:opacity-45"
          >
            <Plus className="h-4 w-4" />
            Продать
          </button>
        )}
      </div>

      {activeListings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ln bg-sf/60 px-4 py-7 text-center">
          <Store className="h-7 w-7 text-mu" />
          <p className="text-sm font-semibold text-fg">На бирже пока нет объявлений</p>
          <p className="max-w-[260px] text-xs leading-relaxed text-mu">
            Капитаны могут выставлять лишние детали со склада или из сборки за свою цену.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {activeListings.map((listing) => {
            const card = cardById.get(listing.cardId);
            if (!card) return null;
            const isMine = listing.sellerTeamId === team.id;
            const preview = previewCardEffect(team, card, template);
            return (
              <div
                key={listing.id}
                className="flex flex-col justify-between gap-2.5 rounded-2xl border border-ln bg-sf p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[11px] uppercase text-mu">
                    {isMine ? "ваш лот" : `команда «${listing.sellerTeamName}»`}
                  </span>
                  <RarityBadge rarity={card.rarity} compact />
                </div>

                <div className="flex items-center gap-3">
                  <PartSticker card={card} template={template} thumbnail />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-snug font-semibold text-fg">{card.name}</p>
                    <p className="text-xs text-mu">{slotLabel.get(card.slotId) ?? card.slotId}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-xl font-semibold text-fg">
                    {listing.price}
                    <Coin size={15} />
                  </span>
                </div>

                <StatDeltaList stats={template.stats} deltas={card.stats} />

                <div className="flex items-center justify-between gap-2 border-t border-dashed border-ln pt-2.5">
                  <span className="font-mono text-xs text-mu">
                    шаг {preview.afterStats.step.total} (
                    {preview.stepDelta === 0 ? "=" : formatSigned(preview.stepDelta)})
                  </span>
                  {isMine ? (
                    isCaptain && (
                      <button
                        type="button"
                        onClick={() =>
                          void run(() => cancelP2PListing(listing.id)).then((ok) => {
                            if (ok) onToast?.("Объявление снято, деталь вернулась на склад");
                          })
                        }
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-ln bg-sf2 px-3 text-xs font-medium text-fg"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-neg" />
                        Снять
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedListingId(listing.id)}
                      className="min-h-[36px] rounded-lg bg-ac px-3.5 text-xs font-semibold text-acfg"
                    >
                      Осмотреть
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BottomSheet
        open={Boolean(selectedListing && selectedCard && selectedPreview)}
        onClose={() => setSelectedListingId(null)}
        title={selectedCard?.name ?? "Лот биржи"}
      >
        {selectedListing && selectedCard && selectedPreview && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[11px] uppercase text-mu">
                    Продаёт «{selectedListing.sellerTeamName}»
                  </span>
                  <RarityBadge rarity={selectedCard.rarity} compact />
                </div>
                <h3 className="text-xl font-semibold text-fg">{selectedCard.name}</h3>
                <EffectScopeBadge scope={selectedCard.effectScope} />
              </div>
              <span className="flex items-center gap-1.5 font-mono text-2xl font-semibold text-fg">
                {selectedListing.price}
                <Coin size={18} />
              </span>
            </div>

            <div className="flex justify-center">
              <AssemblyStage
                template={template}
                equipped={team.equippedCards}
                size="card"
                preview={{ slotId: selectedCard.slotId, cardId: selectedCard.id }}
              />
            </div>

            <div className="rounded-xl border border-ln bg-sf p-3.5">
              <StatDeltaList stats={template.stats} deltas={selectedCard.stats} size="lg" />
              <p className="mt-2 font-mono text-xs text-mu">
                Ваш шаг: {selectedPreview.beforeStats.step.total} → {selectedPreview.afterStats.step.total} (
                {selectedPreview.stepDelta === 0 ? "без изменений" : formatSigned(selectedPreview.stepDelta)})
              </p>
            </div>

            {isCaptain ? (
              <button
                type="button"
                disabled={!isOpen || availableCurrency < selectedListing.price}
                onClick={() => {
                  const id = selectedListing.id;
                  const name = selectedCard.name;
                  setSelectedListingId(null);
                  void run(() => buyP2PListing(id)).then((ok) => {
                    if (ok) onToast?.(`Куплено на бирже: «${name}»`);
                  });
                }}
                className="h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg disabled:opacity-45"
              >
                {!isOpen
                  ? "Сделки откроются в фазу рынка"
                  : availableCurrency < selectedListing.price
                    ? `Не хватает ${selectedListing.price - availableCurrency} ${template.currencyName}`
                    : `Купить за ${selectedListing.price} ${template.currencyName}`}
              </button>
            ) : (
              <button
                type="button"
                disabled={!isOpen}
                onClick={() => {
                  const cid = selectedCard.id;
                  const lid = selectedListing.id;
                  setSelectedListingId(null);
                  void run(() => proposeCard(cid, lid)).then((ok) => {
                    if (ok) onToast?.("Лот отправлен капитану на подтверждение");
                  });
                }}
                className="h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg disabled:opacity-45"
              >
                Предложить капитану
              </button>
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Выставить деталь на биржу">
        {chosenSell && priceCheck && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="p2p-part-select" className="text-xs font-semibold text-mu">
                Выберите деталь команды
              </label>
              <select
                id="p2p-part-select"
                value={chosenSell.key}
                onChange={(e) => {
                  const next = sellCandidates.find((c) => c.key === e.target.value);
                  setSelectedSellKey(e.target.value);
                  if (next) setSellPrice(Math.max(1, next.card.price));
                }}
                className="h-11 w-full rounded-xl border border-ln bg-sf px-3 text-sm font-medium text-fg"
              >
                {sellCandidates.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.card.name} ({item.sourceLabel} · номинал {item.card.price})
                  </option>
                ))}
              </select>
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
                  коридор {priceCheck.minPrice}–{priceCheck.maxPrice} · получите {priceCheck.sellerReceives}
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

            <button
              type="button"
              disabled={!priceCheck.ok}
              onClick={() => {
                setCreateOpen(false);
                void run(() =>
                  createP2PListing({
                    cardId: chosenSell.card.id,
                    price: sellPrice,
                    fromEquippedSlot: chosenSell.fromEquippedSlot,
                  }),
                ).then((ok) => {
                  if (ok) onToast?.(`«${chosenSell.card.name}» выставлена на биржу`);
                });
              }}
              className="h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg disabled:opacity-45"
            >
              Опубликовать за {sellPrice} {template.currencyName}
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
