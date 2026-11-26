import { resolveDayEngine } from "@stem/shared";
import { and, eq } from "drizzle-orm";
import { type Bot, type Context, InlineKeyboard } from "grammy";
import { type AdminComposeDraft, events, members } from "../db/schema.js";
import { broadcastMessage } from "../modules/admin/service.js";
import { activeEventId, loadEvent } from "../modules/event/repository.js";
import { buildLiveState, normalizeTemplate } from "../modules/event/snapshot.js";
import { runtime } from "../shared/runtime.js";
import {
  escapeHtml,
  formatBroadcastHtml,
  formatDeliverySummary,
  formatPhaseStatus,
  withUrlQuery,
} from "./format.js";

const QUICK_PRESETS = [
  { label: "Магазин через 5 мин", text: "Через 5 минут открываем магазин — готовьте план покупок." },
  { label: "2 мин до конца раунда", text: "Осталось 2 минуты — проверьте сборку и подтвердите выбор." },
  { label: "Готовимся к ходу на поле", text: "Магазин скоро закрывается. Готовимся к выезду на поле." },
] as const;

async function editOrReplyHtml(ctx: Context, text: string, keyboard?: InlineKeyboard) {
  try {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  }
}

async function saveAdminDraft(eventId: string, adminId: number, draft: AdminComposeDraft | null) {
  const event = await loadEvent(runtime().db, eventId);
  const currentMap = { ...(event.roundState?.adminCompose ?? {}) };
  if (draft) currentMap[String(adminId)] = draft;
  else delete currentMap[String(adminId)];

  await runtime()
    .db.update(events)
    .set({
      roundState: {
        ...(event.roundState ?? {}),
        adminCompose: currentMap,
      },
    })
    .where(eq(events.id, eventId));
}

async function readAdminDraft(eventId: string, adminId: number): Promise<AdminComposeDraft | null> {
  const event = await loadEvent(runtime().db, eventId);
  return event.roundState?.adminCompose?.[String(adminId)] ?? null;
}

async function loadReachableStats(eventId: string) {
  const rows = await runtime()
    .db.select({ teamId: members.teamId, botBlocked: members.botBlocked })
    .from(members)
    .where(eq(members.eventId, eventId));

  const byTeam = new Map<string, { total: number; reachable: number }>();
  let total = 0;
  let reachable = 0;
  for (const row of rows) {
    total += 1;
    const ok = !row.botBlocked;
    if (ok) reachable += 1;
    const prev = byTeam.get(row.teamId) ?? { total: 0, reachable: 0 };
    byTeam.set(row.teamId, { total: prev.total + 1, reachable: prev.reachable + (ok ? 1 : 0) });
  }
  return { total, reachable, byTeam };
}

async function renderAdminHome(adminWebAppUrl: string) {
  const wizardUrl = withUrlQuery(adminWebAppUrl, "/?tab=wizard");
  const projectorUrl = withUrlQuery(adminWebAppUrl, "/?view=projector");
  const keyboard = new InlineKeyboard()
    .webApp("Пульт живого урока", adminWebAppUrl)
    .row()
    .text("Написать командам", "adm:msg")
    .text("Обновить пульс", "adm:pulse")
    .row()
    .webApp("Табло 16:9", projectorUrl)
    .webApp("Новая смена", wizardUrl)
    .row()
    .webApp("Настроить текущую смену", withUrlQuery(adminWebAppUrl, "/?mode=constructor"))
    .row()
    .text("Советник баланса", "adm:balance");

  const eventId = await activeEventId(runtime().db);
  if (!eventId) {
    return {
      text: "<b>Студия организатора готова</b>\nЗапустите смену через Конструктор.",
      keyboard,
    };
  }

  const [state, event, reach] = await Promise.all([
    buildLiveState(runtime().db, eventId),
    loadEvent(runtime().db, eventId),
    loadReachableStats(eventId),
  ]);
  const template = normalizeTemplate(event.template);
  const engine = resolveDayEngine(template, state.gameState.currentDay);
  const engineTitle =
    engine === "diagnosis" ? "Диагностика" : engine === "legacy_track" ? "Поле" : "Миссия 2:00";
  const phaseLine = formatPhaseStatus(
    state.gameState.currentPhase,
    state.gameState.roundMode,
    state.gameState.phaseEndsAt,
  );

  const text =
    `<b>Студия ведущего · ${escapeHtml(event.title)}</b>\n` +
    `День ${state.gameState.currentDay} из ${template.totalDays} (${engineTitle}) · ${escapeHtml(phaseLine)}\n\n` +
    `Команд: <b>${state.teams.length}</b> · в клиентском боте: <b>${reach.reachable} из ${reach.total}</b>\n` +
    `Баланс смены: <b>${state.liveBalance.healthScore}/100</b> (${escapeHtml(state.liveBalance.momentumLabel)})\n` +
    escapeHtml(state.liveBalance.summary);

  return { text, keyboard };
}

async function renderAdminPulse(adminWebAppUrl: string) {
  const eventId = await activeEventId(runtime().db);
  if (!eventId) {
    return {
      text: "Активная смена не найдена.",
      keyboard: new InlineKeyboard().webApp("Открыть пульт урока", adminWebAppUrl),
    };
  }
  const [state, reach] = await Promise.all([
    buildLiveState(runtime().db, eventId),
    loadReachableStats(eventId),
  ]);
  const readySlots = state.teams.reduce((acc, t) => acc + (t.roundState?.readySlots.length ?? 0), 0);
  const phaseLine = formatPhaseStatus(
    state.gameState.currentPhase,
    state.gameState.roundMode,
    state.gameState.phaseEndsAt,
  );
  const keyboard = new InlineKeyboard()
    .webApp("Открыть пульт урока", adminWebAppUrl)
    .row()
    .text("Написать командам", "adm:msg")
    .text("Обновить", "adm:pulse")
    .row()
    .text("К главному меню", "adm:home");

  const text =
    `<b>Пульс зала · День ${state.gameState.currentDay}</b>\n` +
    `• Статус: <b>${escapeHtml(phaseLine)}</b>\n` +
    `• Команд: <b>${state.teams.length}</b> · в боте на связи: <b>${reach.reachable}/${reach.total}</b>\n` +
    `• Ответов в раунде: ${readySlots} из ${state.teams.length * 5}\n` +
    `• Биржа: ${state.listings.length} · аукционы: ${state.auctions.length}`;
  return { text, keyboard };
}

async function renderAdminBalance(adminWebAppUrl: string) {
  const eventId = await activeEventId(runtime().db);
  if (!eventId) {
    return {
      text: "Смена не найдена.",
      keyboard: new InlineKeyboard().webApp("Открыть пульт", adminWebAppUrl),
    };
  }
  const state = await buildLiveState(runtime().db, eventId);
  const b = state.liveBalance;
  const alertLines =
    b.alerts.length > 0
      ? b.alerts
          .slice(0, 4)
          .map((a) => `• <b>${escapeHtml(a.title)}</b>\n  ${escapeHtml(a.suggestion)}`)
          .join("\n\n")
      : "Критических перекосов не обнаружено.";
  const keyboard = new InlineKeyboard()
    .webApp("Открыть Советник Баланса", adminWebAppUrl)
    .row()
    .text("Обновить", "adm:balance")
    .text("Назад", "adm:home");
  return {
    text: `<b>Индекс баланса: ${b.healthScore}/100</b> · ${escapeHtml(b.momentumLabel)}\n\n${alertLines}`,
    keyboard,
  };
}

async function renderTargetPicker(eventId: string) {
  const [state, reach] = await Promise.all([
    buildLiveState(runtime().db, eventId),
    loadReachableStats(eventId),
  ]);
  const keyboard = new InlineKeyboard().text(`Всем командам (${reach.reachable} чел.)`, "adm:msg:t:all");

  for (let i = 0; i < state.teams.length; i += 2) {
    keyboard.row();
    const pair = state.teams.slice(i, i + 2);
    for (const team of pair) {
      const count = reach.byTeam.get(team.id)?.reachable ?? 0;
      keyboard.text(`${team.name} (${count})`, `adm:msg:t:${team.id}`);
    }
  }
  keyboard.row().text("Отмена", "adm:msg:cancel");

  const text =
    `<b>Сообщение в клиентский бот</b>\n` +
    `Выберите получателя (в скобках — сколько участников подключили бота).\n` +
    `<i>Можно также просто написать текст в этот чат — бот сразу предложит отправить его.</i>`;
  return { text, keyboard };
}

async function renderTextPrompt(eventId: string, draft: AdminComposeDraft) {
  const [state, reach] = await Promise.all([
    buildLiveState(runtime().db, eventId),
    loadReachableStats(eventId),
  ]);
  const team = draft.target === "all" ? null : state.teams.find((t) => t.id === draft.target);
  const count = team ? (reach.byTeam.get(team.id)?.reachable ?? 0) : reach.reachable;
  const targetLabel = team ? `команде «${team.name}»` : "всем командам";

  const keyboard = new InlineKeyboard();
  QUICK_PRESETS.forEach((preset, idx) => {
    keyboard.text(preset.label, `adm:msg:q:${idx}`).row();
  });
  keyboard.text("Сменить получателя", "adm:msg").text("Отмена", "adm:msg:cancel");

  const text =
    `<b>Кому:</b> ${escapeHtml(targetLabel)} (${count} в боте)\n\n` +
    `Напишите текст сообщения следующим сообщением в этот чат — или выберите быстрый шаблон ниже.`;
  return { text, keyboard };
}

async function renderPreview(eventId: string, draft: AdminComposeDraft, senderName: string) {
  const [state, reach] = await Promise.all([
    buildLiveState(runtime().db, eventId),
    loadReachableStats(eventId),
  ]);
  const team = draft.target === "all" ? null : state.teams.find((t) => t.id === draft.target);
  const count = team ? (reach.byTeam.get(team.id)?.reachable ?? 0) : reach.reachable;
  const targetLabel = team ? `команде «${team.name}»` : "всем командам";
  const previewBody = formatBroadcastHtml({
    text: draft.text ?? "",
    senderName,
    teamName: team?.name ?? null,
  });

  const modeLabel = draft.silent ? "Тихо (без звука)" : "Со звуком";
  const keyboard = new InlineKeyboard()
    .text(`Отправить (${count} чел.)`, "adm:msg:send")
    .row()
    .text(draft.silent ? "Включить звук" : "Отправить тихо", "adm:msg:silent")
    .text("Сменить получателя", "adm:msg")
    .row()
    .text("Отмена", "adm:msg:cancel");

  const text =
    `<b>Предпросмотр отправки</b>\n` +
    `Кому: <b>${escapeHtml(targetLabel)}</b> (${count} в боте) · ${modeLabel}\n\n` +
    `${previewBody}`;
  return { text, keyboard };
}

export function registerAdminHandlers(bot: Bot, adminWebAppUrl: string, adminIds: ReadonlySet<number>) {
  bot.use(async (ctx, next) => {
    const uid = ctx.from?.id;
    if (!uid || !adminIds.has(uid)) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: "Доступ только для ведущих", show_alert: true });
      } else if (ctx.message) {
        await ctx.reply("Доступ закрыт: этот бот предназначен только для организаторов и ведущих смены.");
      }
      return;
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    const view = await renderAdminHome(adminWebAppUrl);
    await ctx.reply(view.text, { parse_mode: "HTML", reply_markup: view.keyboard });
  });

  bot.command("pulse", async (ctx) => {
    const view = await renderAdminPulse(adminWebAppUrl);
    await ctx.reply(view.text, { parse_mode: "HTML", reply_markup: view.keyboard });
  });

  bot.command("wizard", async (ctx) => {
    const wizardUrl = withUrlQuery(adminWebAppUrl, "/?tab=wizard");
    const keyboard = new InlineKeyboard()
      .webApp("Запустить Мастер смены", wizardUrl)
      .row()
      .text("К главному меню", "adm:home");
    await ctx.reply(
      "<b>Конструктор смены</b>\nОткройте пошаговый мастер: мир, правила, карты и названия команд.",
      { parse_mode: "HTML", reply_markup: keyboard },
    );
  });

  bot.command("balance", async (ctx) => {
    const view = await renderAdminBalance(adminWebAppUrl);
    await ctx.reply(view.text, { parse_mode: "HTML", reply_markup: view.keyboard });
  });

  const handleMsgCommand = async (ctx: Context & { match?: string }) => {
    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.reply("Активная смена не найдена.");
      return;
    }
    const adminId = ctx.from?.id ?? 0;
    const senderName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") || "Ведущий";
    const inlineText = ctx.match?.trim();

    if (inlineText) {
      const draft: AdminComposeDraft = {
        target: "all",
        silent: false,
        text: inlineText.slice(0, 1000),
        updatedAt: new Date().toISOString(),
      };
      await saveAdminDraft(eventId, adminId, draft);
      const preview = await renderPreview(eventId, draft, senderName);
      await ctx.reply(preview.text, { parse_mode: "HTML", reply_markup: preview.keyboard });
      return;
    }

    const picker = await renderTargetPicker(eventId);
    await ctx.reply(picker.text, { parse_mode: "HTML", reply_markup: picker.keyboard });
  };

  bot.command("msg", handleMsgCommand);
  bot.command("announce", handleMsgCommand);

  bot.callbackQuery("adm:home", async (ctx) => {
    await ctx.answerCallbackQuery();
    const view = await renderAdminHome(adminWebAppUrl);
    await editOrReplyHtml(ctx, view.text, view.keyboard);
  });

  bot.callbackQuery("adm:pulse", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Пульс обновлён" });
    const view = await renderAdminPulse(adminWebAppUrl);
    await editOrReplyHtml(ctx, view.text, view.keyboard);
  });

  bot.callbackQuery("adm:balance", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Баланс обновлён" });
    const view = await renderAdminBalance(adminWebAppUrl);
    await editOrReplyHtml(ctx, view.text, view.keyboard);
  });

  bot.callbackQuery("adm:msg", async (ctx) => {
    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.answerCallbackQuery({ text: "Нет активной смены", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery();
    const picker = await renderTargetPicker(eventId);
    await editOrReplyHtml(ctx, picker.text, picker.keyboard);
  });

  bot.callbackQuery(/^adm:msg:t:(.+)$/, async (ctx) => {
    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.answerCallbackQuery({ text: "Нет активной смены", show_alert: true });
      return;
    }
    const target = ctx.match[1] ?? "all";
    const existing = await readAdminDraft(eventId, ctx.from.id);
    const draft: AdminComposeDraft = {
      target,
      silent: existing?.silent ?? false,
      text: existing?.text,
      updatedAt: new Date().toISOString(),
    };
    await saveAdminDraft(eventId, ctx.from.id, draft);
    await ctx.answerCallbackQuery({ text: "Получатель выбран" });

    if (draft.text) {
      const senderName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") || "Ведущий";
      const preview = await renderPreview(eventId, draft, senderName);
      await editOrReplyHtml(ctx, preview.text, preview.keyboard);
    } else {
      const prompt = await renderTextPrompt(eventId, draft);
      await editOrReplyHtml(ctx, prompt.text, prompt.keyboard);
    }
  });

  bot.callbackQuery(/^adm:msg:q:(\d+)$/, async (ctx) => {
    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.answerCallbackQuery({ text: "Нет активной смены", show_alert: true });
      return;
    }
    const preset = QUICK_PRESETS[Number(ctx.match[1])];
    if (!preset) {
      await ctx.answerCallbackQuery({ text: "Шаблон не найден" });
      return;
    }
    const existing = await readAdminDraft(eventId, ctx.from.id);
    const draft: AdminComposeDraft = {
      target: existing?.target ?? "all",
      silent: existing?.silent ?? false,
      text: preset.text,
      updatedAt: new Date().toISOString(),
    };
    await saveAdminDraft(eventId, ctx.from.id, draft);
    await ctx.answerCallbackQuery({ text: "Шаблон подставлен" });
    const senderName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") || "Ведущий";
    const preview = await renderPreview(eventId, draft, senderName);
    await editOrReplyHtml(ctx, preview.text, preview.keyboard);
  });

  bot.callbackQuery("adm:msg:silent", async (ctx) => {
    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.answerCallbackQuery({ text: "Нет активной смены", show_alert: true });
      return;
    }
    const existing = await readAdminDraft(eventId, ctx.from.id);
    if (!existing?.text) {
      await ctx.answerCallbackQuery({ text: "Сначала введите текст" });
      return;
    }
    const next: AdminComposeDraft = {
      ...existing,
      silent: !existing.silent,
      updatedAt: new Date().toISOString(),
    };
    await saveAdminDraft(eventId, ctx.from.id, next);
    await ctx.answerCallbackQuery({ text: next.silent ? "Режим: без звука" : "Режим: со звуком" });
    const senderName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") || "Ведущий";
    const preview = await renderPreview(eventId, next, senderName);
    await editOrReplyHtml(ctx, preview.text, preview.keyboard);
  });

  bot.callbackQuery("adm:msg:send", async (ctx) => {
    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.answerCallbackQuery({ text: "Нет активной смены", show_alert: true });
      return;
    }
    const draft = await readAdminDraft(eventId, ctx.from.id);
    if (!draft?.text) {
      await ctx.answerCallbackQuery({ text: "Черновик не найден", show_alert: true });
      return;
    }
    const displayName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") || "Ведущий";
    const { report, targetLabel } = await broadcastMessage(
      {
        eventId,
        actor: {
          userId: ctx.from.id,
          displayName,
          username: ctx.from.username ?? null,
          isAdmin: true,
          botSurface: "admin",
        },
      },
      { target: draft.target, text: draft.text, silent: draft.silent },
    );
    await saveAdminDraft(eventId, ctx.from.id, null);
    await ctx.answerCallbackQuery({
      text: report.delivered > 0 ? `Отправлено (${report.delivered})` : "Записано в ленту",
    });

    const keyboard = new InlineKeyboard().text("Написать ещё", "adm:msg").text("К главному меню", "adm:home");
    await editOrReplyHtml(ctx, formatDeliverySummary(report, targetLabel), keyboard);
  });

  bot.callbackQuery("adm:msg:cancel", async (ctx) => {
    const eventId = await activeEventId(runtime().db);
    if (eventId) await saveAdminDraft(eventId, ctx.from.id, null);
    await ctx.answerCallbackQuery({ text: "Отменено" });
    const view = await renderAdminHome(adminWebAppUrl);
    await editOrReplyHtml(ctx, view.text, view.keyboard);
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (!text || text.startsWith("/")) return;

    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.reply("Активная смена не найдена. Откройте /start для запуска.");
      return;
    }
    const existing = await readAdminDraft(eventId, ctx.from.id);
    const draft: AdminComposeDraft = {
      target: existing?.target ?? "all",
      silent: existing?.silent ?? false,
      text: text.slice(0, 1000),
      updatedAt: new Date().toISOString(),
    };
    await saveAdminDraft(eventId, ctx.from.id, draft);
    const senderName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") || "Ведущий";
    const preview = await renderPreview(eventId, draft, senderName);
    await ctx.reply(preview.text, { parse_mode: "HTML", reply_markup: preview.keyboard });
  });
}

export async function clearBlockedForMember(eventId: string, userId: number) {
  await runtime()
    .db.update(members)
    .set({ botBlocked: false })
    .where(and(eq(members.eventId, eventId), eq(members.userId, userId)));
}
