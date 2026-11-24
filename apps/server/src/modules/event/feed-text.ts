import type { GameTemplate } from "@stem/shared";

type LedgerLike = { kind: string; amount: number | null; data: Record<string, unknown> };

const PHASE_LABELS: Record<string, string> = {
  scoring: "оценка работы",
  market: "рынок открыт",
  turn: "выезд на трассу",
  summary: "подведение итогов",
};

export function describeLedger(entry: LedgerLike, template: GameTemplate): string {
  const d = entry.data;
  const currency = template.currencyName;
  const amount = entry.amount ?? 0;
  const signed = amount > 0 ? `+${amount}` : `${amount}`;
  const card = template.cards.find((c) => c.id === d.cardId)?.name ?? String(d.cardName ?? d.cardId ?? "");
  switch (entry.kind) {
    case "reward":
      return `${signed} ${currency}: ${String(d.reason ?? "начисление")}`;
    case "purchase":
      return `Установлена деталь «${card}» за ${-amount} ${currency}`;
    case "undo":
      return `Покупка «${card}» отменена, возвращено ${amount} ${currency}`;
    case "equip-swap":
      return d.cardId ? `Со склада установлена деталь «${card}»` : `Слот освобождён на склад`;
    case "p2p-list":
      return `На биржу выставлена деталь «${card}» за ${String(d.price)} ${currency}`;
    case "p2p-cancel":
      return `Деталь «${card}» снята с биржи на склад`;
    case "p2p-buy":
      return `Куплено на бирже «${card}» у команды «${String(d.sellerName ?? "")}» за ${-amount} ${currency}`;
    case "p2p-sold":
      return `Продажа на бирже «${card}»: +${amount} ${currency}`;
    case "auction-start":
      return `Открыт аукцион за «${card}» (старт ${String(d.startingPrice)} ${currency})`;
    case "auction-bid":
      return `Ставка ${String(d.amount)} ${currency} на «${card}»`;
    case "auction-won":
      return `Выигран аукцион за «${card}» (${-amount} ${currency})`;
    case "perk":
      return `Активирован модуль «${String(d.perkName ?? "")}» за ${-amount} ${currency}`;
    case "step":
      return d.summary ? String(d.summary) : `Ход ${signed}: сектор ${String(d.from)} → ${String(d.to)}`;
    case "track":
      return `Смещение по маршруту ${signed}${d.reason ? `: ${String(d.reason)}` : ""}`;
    case "proposal":
      return `${String(d.fromName ?? "Участник")} советует взять «${card}»`;
    case "join":
      return `В команде: ${String(d.displayName ?? "участник")}${d.role === "captain" ? " (капитан)" : ""}`;
    case "phase":
      return `Фаза: ${PHASE_LABELS[String(d.phase)] ?? String(d.phase)}${d.minutes ? ` (${String(d.minutes)} мин)` : ""}`;
    case "day":
      return `День ${String(d.day)} открыт`;
    case "lore-push":
      return `Сюжетная сводка: ${String(d.title ?? "")}`;
    case "team":
      return `Добавлена команда «${String(d.name ?? "")}»`;
    case "card-upserted":
      return `Обновлена деталь «${card}»`;
    case "features-updated":
      return "Обновлены переключатели механик смены";
    case "quick-fix":
      return `Автобаланс: ${String(d.note ?? "корректировка")}`;
    case "market-published":
      return `В магазин добавлен новый набор (${String((d.cardIds as unknown[])?.length ?? 0)} дет.)`;
    case "shift-created":
      return `Запущена смена «${String(d.title ?? template.title)}»`;
    case "reset":
      return "Смена перезапущена";
    case "captain":
      return `Новый капитан: ${String(d.displayName ?? "")}`;
    case "member-removed":
      return "Участник исключён из команды";
    case "settings":
      return `Лимит покупок: ${d.purchaseLimit === null ? "без ограничений" : String(d.purchaseLimit)}`;
    case "reward-undo":
      return `Отменено последнее групповое начисление (${currency})`;
    case "program-start":
      return `Запущена программа раунда (${String(d.engine ?? "mission")})`;
    case "program-order":
      return `${String(d.memberName ?? "Участник")} обновил решение экипажа`;
    case "program-ping":
      return `Запрос обсуждения рычага №${Number(d.slotIndex ?? 0) + 1}`;
    case "diagnosis-probe":
      return `Выполнен приборный замер: ${String(d.probeLabel ?? d.probeId ?? "")}`;
    case "diagnosis-verdict":
      return d.correct
        ? `Точный диагноз команды: +${String(d.points ?? 0)} очк. (бюджет: 0)`
        : `Диагноз команды не совпал с замерами (0 очк.)`;
    case "round-reveal":
      return String(d.summary ?? `Вскрытие раунда: +${amount} очк.`);
    case "transfer-note":
      return `Записан параметр проверки на стенде: «${String(d.note ?? "")}»`;
    case "lexicon-updated":
      return "Обновлён словарь терминов смены";
    case "schedule-updated":
      return "Обновлено расписание механик по дням";
    case "pareto-fix":
      return `Выровнен порог маршрута (${String(d.note ?? "Парето 3.0")})`;
    default:
      return entry.kind;
  }
}
