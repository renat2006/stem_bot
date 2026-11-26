import type { CardItem, CardRarity, EffectScope } from "@stem/shared";
import { CheckCircle2, Flame, Gavel, Plus, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PartSticker } from "../../../entities/assembly/index.js";
import { StatDeltaList } from "../../../entities/card/index.js";
import type { GameSnapshot } from "../../../entities/game/index.js";
import {
  closeAuctionNow,
  decideMarketDraft,
  fetchMarketDraft,
  generateMarketDraft,
  type MarketDraftRecord,
  removeCard,
  startAuction,
  upsertCard,
} from "../../../features/control-shift/index.js";
import type { RunAction } from "../../../shared/lib/index.js";
import {
  Coin,
  ConfirmButton,
  EffectScopeBadge,
  ModalDialog,
  ModuleCard,
  RARITY_LABEL,
  RarityBadge,
  SCOPE_LABEL,
} from "../../../shared/ui/index.js";

import { ImageField } from "./image-field.js";

const RARITIES: CardRarity[] = ["common", "rare", "legendary"];
const SCOPES: EffectScope[] = ["step", "event_shield", "economy", "slot_synergy"];

export function CardsStudioTab({ snapshot, run }: { snapshot: GameSnapshot; run: RunAction }) {
  const { template, gameState, auctions } = snapshot;
  const [section, setSection] = useState("catalog");
  const [rarityFilter, setRarityFilter] = useState<"all" | CardRarity>("all");
  const [slotFilter, setSlotFilter] = useState<string>("all");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{
    id?: string;
    imageId?: string;
    name: string;
    slotId: string;
    rarity: CardRarity;
    price: number;
    dayAvailable: number;
    stock: number;
    stockLeft: number;
    stats: Record<string, number>;
    effectScope?: EffectScope;
    flavor: string;
  } | null>(null);

  const [genPrompt, setGenPrompt] = useState(template.theme);
  const [genCount, setGenCount] = useState(12);
  const [debuffStrength, setDebuffStrength] = useState<"mild" | "balanced" | "strict">("balanced");
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<MarketDraftRecord | null>(null);

  const [auctionCardId, setAuctionCardId] = useState(
    () => template.cards.find((c) => c.rarity !== "common")?.id ?? template.cards[0]?.id ?? "",
  );
  const [auctionStartPrice, setAuctionStartPrice] = useState(6);
  const [auctionMinutes, setAuctionMinutes] = useState(5);

  useEffect(() => {
    void fetchMarketDraft()
      .then((res) => setDraft(res.draft))
      .catch(() => {});
  }, []);

  const openEditor = (card?: CardItem) => {
    if (card) {
      setEditing({
        id: card.id,
        imageId: card.imageId,
        name: card.name,
        slotId: card.slotId,
        rarity: card.rarity,
        price: card.price,
        dayAvailable: card.dayAvailable,
        stock: card.stock,
        stockLeft: gameState.cardStockLeft[card.id] ?? card.stock,
        stats: { ...card.stats },
        effectScope: card.effectScope,
        flavor: card.flavor ?? "",
      });
    } else {
      const firstSlot = template.slots[0]?.id ?? "body";
      setEditing({
        name: "",
        slotId: firstSlot,
        rarity: "rare",
        price: 6,
        dayAvailable: gameState.currentDay,
        stock: 2,
        stockLeft: 2,
        stats: Object.fromEntries(template.stats.map((s, idx) => [s.id, idx === 0 ? 3 : idx === 1 ? -1 : 0])),
        effectScope: undefined,
        flavor: "",
      });
    }
  };

  const filtered = template.cards.filter(
    (c) =>
      (rarityFilter === "all" || c.rarity === rarityFilter) &&
      (slotFilter === "all" || c.slotId === slotFilter),
  );

  const openAuctions = auctions.filter((a) => a.status === "open");
  const slotLabel = new Map(template.slots.map((s) => [s.id, s.label]));

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const created = await generateMarketDraft({
        theme: genPrompt.trim() || template.theme,
        templateId: template.id,
        count: genCount,
        debuffStrength,
        rareSharePercent: 30,
        legendarySharePercent: 15,
        allowedScopes: ["step", "event_shield", "economy", "slot_synergy"],
      });
      setDraft(created);
    } finally {
      setGenerating(false);
    }
  };

  const posSum = editing
    ? Object.values(editing.stats)
        .filter((v) => v > 0)
        .reduce((a, b) => a + b, 0)
    : 0;
  const negSum = editing
    ? Object.values(editing.stats)
        .filter((v) => v < 0)
        .reduce((a, b) => a + Math.abs(b), 0)
    : 0;

  return (
    <div className="space-y-4">
      <nav className="studio-steps" aria-label="Работа с картами">
        {[
          ["catalog", "Каталог"],
          ["generator", "Генератор"],
          ...(template.features.auctions ? [["auction", "Аукцион"]] : []),
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-current={section === id ? "page" : undefined}
            onClick={() => setSection(id ?? "catalog")}
          >
            {label}
          </button>
        ))}
      </nav>

      {section === "catalog" && (
        <ModuleCard
          title="Каталог и настройка деталей"
          subtitle={`${template.cards.length} в колоде · нажмите на карточку, чтобы подкрутить характеристики`}
          badge={
            <button
              type="button"
              onClick={() => openEditor()}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-ac px-3 text-xs font-semibold text-acfg"
            >
              <Plus className="h-3.5 w-3.5" />
              Новая
            </button>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Редкость детали"
                className="studio-field"
                value={rarityFilter}
                onChange={(event) => setRarityFilter(event.target.value as typeof rarityFilter)}
              >
                <option value="all">Все редкости</option>
                {RARITIES.map((r) => (
                  <option key={r} value={r}>
                    {RARITY_LABEL[r]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Слот детали"
                className="studio-field"
                value={slotFilter}
                onChange={(event) => setSlotFilter(event.target.value)}
              >
                <option value="all">Все слоты</option>
                {template.slots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>
            {filtered.length === 0 && <p className="text-sm text-mu">По этим фильтрам деталей нет.</p>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filtered.map((card) => {
                const left = gameState.cardStockLeft[card.id] ?? card.stock;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => openEditor(card)}
                    className="flex items-center gap-3 rounded-xl border border-ln bg-sf2/70 p-3 text-left transition hover:border-ac"
                  >
                    <PartSticker card={card} template={template} thumbnail />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] uppercase text-mu">
                          {slotLabel.get(card.slotId) ?? card.slotId} · д.{card.dayAvailable}
                        </span>
                        <RarityBadge rarity={card.rarity} compact />
                      </div>
                      <p className="truncate text-sm font-semibold text-fg">{card.name}</p>
                      <StatDeltaList stats={template.stats} deltas={card.stats} />
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="flex items-center gap-1 font-mono text-base font-semibold text-fg">
                        {card.price}
                        <Coin size={13} />
                      </span>
                      <span className="font-mono text-[11px] text-mu">
                        {left}/{card.stock} шт.
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </ModuleCard>
      )}

      {section === "generator" && (
        <ModuleCard
          title="Генератор новых деталей"
          subtitle="Создаёт сбалансированный пакет обычных, редких и легендарных карт по теме"
        >
          <div className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-mu">Тема или акцент пакета</span>
              <input
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                placeholder="Например: марсианские песчаные бури и тяжёлые буры"
                className="h-11 rounded-xl border border-ln bg-sf2 px-3.5 text-sm text-fg focus:border-ac focus:outline-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-mu">Количество карт: {genCount}</span>
                <input
                  type="range"
                  min={6}
                  max={18}
                  step={3}
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="accent-[var(--ac)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-mu">Сила штрафов у редких</span>
                <select
                  value={debuffStrength}
                  onChange={(e) => setDebuffStrength(e.target.value as "mild" | "balanced" | "strict")}
                  className="h-9 rounded-xl border border-ln bg-sf2 px-2.5 text-xs font-medium text-fg"
                >
                  <option value="mild">Мягкая</option>
                  <option value="balanced">Сбалансированная</option>
                  <option value="strict">Жёсткий компромисс</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              disabled={generating}
              onClick={handleGenerate}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ac text-sm font-semibold text-acfg disabled:opacity-50"
            >
              <Wand2 className="h-4 w-4" />
              {generating ? "Собираем черновик колоды…" : "Сгенерировать черновик деталей"}
            </button>

            {draft && (
              <div className="space-y-3 rounded-2xl border border-ac/40 bg-ac/8 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg">
                    <CheckCircle2 className="h-4 w-4 text-ac" />
                    Черновик готов ({draft.cards.length} карт)
                  </span>
                  <span className="font-mono text-[11px] text-mu">проверка пройдена</span>
                </div>

                <details className="space-y-1.5">
                  <summary>Посмотреть детали ({draft.cards.length})</summary>
                  {draft.cards.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-sf px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <RarityBadge rarity={c.rarity} compact />
                          <span className="truncate font-semibold text-fg">{c.name}</span>
                        </div>
                        <div className="mt-1">
                          <StatDeltaList stats={template.stats} deltas={c.stats} />
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-fg">{c.price}</span>
                    </div>
                  ))}
                </details>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void run(() => decideMarketDraft(draft.id, "reject")).then((ok) => {
                        if (ok) setDraft(null);
                      })
                    }
                    className="h-10 rounded-xl border border-ln bg-sf text-xs font-medium text-mu"
                  >
                    Сбросить
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void run(() => decideMarketDraft(draft.id, "approve", "append")).then((ok) => {
                        if (ok) setDraft(null);
                      })
                    }
                    className="h-10 rounded-xl border border-ac bg-sf text-xs font-semibold text-ac"
                  >
                    Добавить к рынку
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void run(() => decideMarketDraft(draft.id, "approve", "replace")).then((ok) => {
                        if (ok) setDraft(null);
                      })
                    }
                    className="h-10 rounded-xl bg-ac text-xs font-semibold text-acfg"
                  >
                    Заменить пул
                  </button>
                </div>
              </div>
            )}
          </div>
        </ModuleCard>
      )}

      {section === "auction" && template.features.auctions && (
        <ModuleCard
          title="Управление живым аукционом"
          subtitle="Выставьте редкий лот на открытые торги между капитанами"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs text-mu">Лот для торгов</span>
                <select
                  value={auctionCardId}
                  onChange={(e) => {
                    setAuctionCardId(e.target.value);
                    const found = template.cards.find((c) => c.id === e.target.value);
                    if (found) setAuctionStartPrice(Math.max(2, found.price - 1));
                  }}
                  className="h-11 rounded-xl border border-ln bg-sf2 px-3 text-sm font-medium text-fg"
                >
                  {template.cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{RARITY_LABEL[c.rarity]}] {c.name} (номинал {c.price})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-mu">Старт ({template.currencyName})</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={auctionStartPrice}
                  onChange={(e) => setAuctionStartPrice(Math.max(1, Number(e.target.value)))}
                  className="h-11 rounded-xl border border-ln bg-sf2 px-3 font-mono text-sm font-semibold text-fg"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                {[3, 5, 10].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAuctionMinutes(m)}
                    className={`h-9 rounded-lg px-3 text-xs font-medium ${
                      auctionMinutes === m ? "bg-fg text-bg" : "bg-sf2 text-mu"
                    }`}
                  >
                    {m} мин
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={!auctionCardId}
                onClick={() =>
                  void run(() =>
                    startAuction({
                      cardId: auctionCardId,
                      startingPrice: auctionStartPrice,
                      durationMinutes: auctionMinutes,
                    }),
                  )
                }
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-ac px-4 text-xs font-semibold text-acfg"
              >
                <Gavel className="h-4 w-4" />
                Запустить торг
              </button>
            </div>

            {openAuctions.map((lot) => {
              const card = template.cards.find((c) => c.id === lot.cardId);
              return (
                <div
                  key={lot.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-warn/45 bg-warn/10 p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-warn">
                      <Flame className="h-3.5 w-3.5" />
                      Идёт торг: {card?.name ?? "Модуль"}
                    </p>
                    <p className="text-xs text-fg">
                      Ставка {lot.currentBid} ·{" "}
                      {lot.leaderTeamName ? `лидер «${lot.leaderTeamName}»` : "ставок ещё нет"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void run(() => closeAuctionNow(lot.id))}
                    className="h-9 shrink-0 rounded-lg bg-fg px-3 text-xs font-semibold text-bg"
                  >
                    Завершить лот
                  </button>
                </div>
              );
            })}
          </div>
        </ModuleCard>
      )}

      <ModalDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Настройка детали" : "Новая деталь"}
      >
        {editing && (
          <div className="space-y-3.5">
            <div>
              <h3 className="text-lg font-semibold text-fg">
                {editing.id ? "Настройка параметров карты" : "Создание новой карты"}
              </h3>
              <p className="text-xs text-mu">
                Плюсы: +{posSum} · Компромиссные минусы: −{negSum}
                {editing.rarity !== "common" && negSum === 0
                  ? " · советуем добавить минус хотя бы на 1 сферу"
                  : ""}
              </p>
            </div>

            <ImageField
              label="Изображение детали"
              id={editing.imageId}
              onBusy={setUploading}
              onChange={(imageId) => setEditing((prev) => (prev ? { ...prev, imageId } : null))}
            />
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-mu">Название детали</span>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Например: Плазменный гироскоп"
                className="h-11 rounded-xl border border-ln bg-sf px-3.5 text-sm font-medium text-fg"
              />
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-mu">Слот установки</span>
                <select
                  value={editing.slotId}
                  onChange={(e) => setEditing({ ...editing, slotId: e.target.value })}
                  className="h-10 rounded-xl border border-ln bg-sf px-3 text-xs font-medium text-fg"
                >
                  {template.slots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-mu">Редкость</span>
                <select
                  value={editing.rarity}
                  onChange={(e) => {
                    const rarity = e.target.value as CardRarity;
                    setEditing({
                      ...editing,
                      rarity,
                      effectScope: rarity === "legendary" ? (editing.effectScope ?? "step") : undefined,
                    });
                  }}
                  className="h-10 rounded-xl border border-ln bg-sf px-3 text-xs font-medium text-fg"
                >
                  {RARITIES.map((r) => (
                    <option key={r} value={r}>
                      {RARITY_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-mu">Цена</span>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: Math.max(1, Number(e.target.value)) })}
                  className="h-10 rounded-xl border border-ln bg-sf px-3 font-mono text-sm font-semibold text-fg"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-mu">День откр.</span>
                <input
                  type="number"
                  min={1}
                  max={template.totalDays}
                  value={editing.dayAvailable}
                  onChange={(e) =>
                    setEditing({ ...editing, dayAvailable: Math.max(1, Number(e.target.value)) })
                  }
                  className="h-10 rounded-xl border border-ln bg-sf px-3 font-mono text-sm font-semibold text-fg"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-mu">Остаток на рынке</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={editing.stockLeft}
                  onChange={(e) => {
                    const left = Math.max(0, Number(e.target.value));
                    setEditing({
                      ...editing,
                      stockLeft: left,
                      stock: Math.max(editing.stock, left, 1),
                    });
                  }}
                  className="h-10 rounded-xl border border-ln bg-sf px-3 font-mono text-sm font-semibold text-fg"
                />
              </label>
            </div>

            <div className="space-y-2 rounded-2xl border border-ln bg-sf p-3.5">
              <p className="text-xs font-semibold text-fg">Влияние на характеристики (−4 … +6)</p>
              {template.stats.map((stat) => {
                const val = editing.stats[stat.id] ?? 0;
                return (
                  <div key={stat.id} className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-fg">{stat.label}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            stats: { ...editing.stats, [stat.id]: Math.max(-4, val - 1) },
                          })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-sf2 font-mono text-sm font-semibold text-fg"
                      >
                        −
                      </button>
                      <span
                        className={`w-8 text-center font-mono text-sm font-semibold ${
                          val > 0 ? "text-pos" : val < 0 ? "text-neg" : "text-mu"
                        }`}
                      >
                        {val > 0 ? `+${val}` : val}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            stats: { ...editing.stats, [stat.id]: Math.min(6, val + 1) },
                          })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-sf2 font-mono text-sm font-semibold text-fg"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {editing.rarity === "legendary" && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-mu">Сфера легендарного свойства</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {SCOPES.map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => setEditing({ ...editing, effectScope: sc })}
                      className={`min-h-[38px] rounded-xl border px-2.5 text-left text-xs font-medium ${
                        editing.effectScope === sc
                          ? "border-warn bg-warn/15 text-fg"
                          : "border-ln bg-sf text-mu"
                      }`}
                    >
                      {SCOPE_LABEL[sc]}
                    </button>
                  ))}
                </div>
                <EffectScopeBadge scope={editing.effectScope} />
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-mu">Художественное описание (по желанию)</span>
              <input
                value={editing.flavor}
                onChange={(e) => setEditing({ ...editing, flavor: e.target.value })}
                maxLength={140}
                placeholder="Короткая деталь для погружения…"
                className="h-10 rounded-xl border border-ln bg-sf px-3 text-xs text-fg"
              />
            </label>

            <button
              type="button"
              disabled={uploading || saving || editing.name.trim().length < 2}
              onClick={() => {
                const tier = editing.rarity === "legendary" ? 5 : editing.rarity === "rare" ? 3 : 1;
                const payload = {
                  id: editing.id,
                  name: editing.name.trim(),
                  slotId: editing.slotId,
                  rarity: editing.rarity,
                  tier,
                  price: editing.price,
                  dayAvailable: editing.dayAvailable,
                  stats: editing.stats,
                  trackBonus: template.cards.find((c) => c.id === editing.id)?.trackBonus ?? 0,
                  imageId: editing.imageId,
                  stock: editing.stock,
                  stockLeft: editing.stockLeft,
                  effectScope: editing.rarity === "legendary" ? editing.effectScope : undefined,
                  flavor: editing.flavor.trim() || undefined,
                };
                setSaving(true);
                void run(() => upsertCard(payload)).then((ok) => {
                  setSaving(false);
                  if (ok) setEditing(null);
                });
              }}
              className="h-12 w-full rounded-xl bg-ac text-base font-semibold text-acfg disabled:opacity-45"
            >
              Сохранить деталь
            </button>
            {editing.id && (
              <ConfirmButton
                variant="destructive"
                confirmLabel="Подтвердить удаление детали"
                onConfirm={async () => {
                  const cardId = editing.id;
                  if (cardId && (await run(() => removeCard(cardId)))) setEditing(null);
                }}
              >
                Удалить деталь
              </ConfirmButton>
            )}
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
