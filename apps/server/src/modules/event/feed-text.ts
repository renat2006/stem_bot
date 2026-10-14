import type { GameTemplate } from "@stem/shared";

type LedgerLike = { kind: string; amount: number | null; data: Record<string, unknown> };

const PHASE_LABELS: Record<string, string> = {
  scoring: "оценка учебного блока",
  market: "рынок",
  turn: "ход по треку",
  summary: "итоги",
};

export function describeLedger(entry: LedgerLike, template: GameTemplate): string {
  const d = entry.data;
  const currency = template.currencyName;
  const amount = entry.amount ?? 0;
  const signed = amount > 0 ? `+${amount}` : `${amount}`;
  const card = template.cards.find((c) => c.id === d.cardId)?.name ?? String(d.cardId ?? "");
  switch (entry.kind) {
    case "reward":
      return `${signed} ${currency}: ${String(d.reason ?? "начисление")}`;
    case "purchase":
      return `Куплено «${card}» за ${-amount} ${currency}`;
    case "undo":
      return `Покупка «${card}» отменена, возвращено ${amount} ${currency}`;
    case "perk":
      return `Свойство «${String(d.perkName ?? "")}» за ${-amount} ${currency}`;
    case "step":
      return `Шаг по треку ${signed}: ${String(d.from)} → ${String(d.to)}`;
    case "track":
      return `Позиция на треке ${signed}${d.reason ? `: ${String(d.reason)}` : ""}`;
    case "proposal":
      return `${String(d.fromName ?? "Участник")} предлагает «${card}»`;
    case "join":
      return `В команде: ${String(d.displayName ?? "участник")}${d.role === "captain" ? " (капитан)" : ""}`;
    case "phase":
      return `Фаза: ${PHASE_LABELS[String(d.phase)] ?? String(d.phase)}${d.minutes ? ` на ${String(d.minutes)} мин` : ""}`;
    case "day":
      return `Начался день ${String(d.day)}`;
    case "team":
      return `Создана команда «${String(d.name ?? "")}»`;
    case "reset":
      return "Смена сброшена";
    case "captain":
      return `Капитан команды: ${String(d.displayName ?? "")}`;
    case "member-removed":
      return "Участник удалён из команды";
    case "settings":
      return `Лимит покупок: ${d.purchaseLimit === null ? "без лимита" : String(d.purchaseLimit)}`;
    default:
      return entry.kind;
  }
}
