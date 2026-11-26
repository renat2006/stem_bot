export function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function withUrlQuery(baseUrl: string, queryPath: string): string {
  if (!queryPath || queryPath === "/") return baseUrl;
  const parsed = new URL(baseUrl);
  const extra = new URL(queryPath, "https://local.invalid");
  for (const [key, value] of extra.searchParams.entries()) {
    parsed.searchParams.set(key, value);
  }
  return parsed.toString();
}

export function formatPhaseStatus(
  phase: string,
  roundMode: string | undefined,
  phaseEndsAt: string | null,
): string {
  const leftMin = phaseEndsAt
    ? Math.max(0, Math.ceil((Date.parse(phaseEndsAt) - Date.now()) / 60_000))
    : null;
  const suffix = leftMin && leftMin > 0 ? ` · ещё ${leftMin} мин` : "";
  if (phase === "market") return `Магазин открыт${suffix}`;
  if (phase === "turn") {
    if (roundMode === "blind_draft" || roundMode === "negotiation") return `Идёт раунд${suffix}`;
    if (roundMode === "diagnosis") return `Приборная проверка${suffix}`;
    return `Ход на поле${suffix}`;
  }
  if (phase === "summary") return "Итоги дня";
  return "Идёт занятие";
}

export function formatBroadcastHtml(params: {
  text: string;
  senderName?: string;
  teamName?: string | null;
}): string {
  const header = params.teamName
    ? `<b>Сообщение ведущего · команда «${escapeHtml(params.teamName)}»</b>`
    : "<b>Сообщение от ведущего смены</b>";
  const body = `<blockquote>${escapeHtml(params.text.trim())}</blockquote>`;
  const sign = params.senderName ? `\n<i>${escapeHtml(params.senderName)}</i>` : "";
  return `${header}\n${body}${sign}`;
}

export function formatDeliverySummary(
  report: { attempted: number; delivered: number; blocked: number; teams: number },
  targetLabel: string,
): string {
  if (report.attempted === 0) {
    return (
      `<b>Сообщение записано в ленту, но не доставлено в Telegram</b>\n` +
      `Получатель: ${escapeHtml(targetLabel)}\n` +
      `Пока никто из выбранных участников не открыл клиентского бота через <code>/start</code>.`
    );
  }
  const blockedNote =
    report.blocked > 0 ? `\nНе смогли получить (бот заблокирован): <b>${report.blocked}</b>` : "";
  return (
    `<b>Сообщение отправлено</b>\n` +
    `Кому: ${escapeHtml(targetLabel)}\n` +
    `Доставлено: <b>${report.delivered} из ${report.attempted}</b> (команд: ${report.teams})${blockedNote}`
  );
}
