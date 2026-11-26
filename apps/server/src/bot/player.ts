import { resolveDayEngine, resolveLexicon, usesPhysicalBoard } from "@stem/shared";
import { and, eq } from "drizzle-orm";
import { type Bot, type Context, InlineKeyboard } from "grammy";
import { members, teams } from "../db/schema.js";
import { activeEventId, loadEvent } from "../modules/event/repository.js";
import { buildLiveState, normalizeTemplate } from "../modules/event/snapshot.js";
import { runtime } from "../shared/runtime.js";
import { escapeHtml, formatPhaseStatus, withUrlQuery } from "./format.js";

const JOIN_CODE_PATTERN = /^[A-Za-z0-9]{4,8}$/;

async function markPlayerReachable(userId: number) {
  const eventId = await activeEventId(runtime().db);
  if (!eventId) return;
  await runtime()
    .db.update(members)
    .set({ botBlocked: false })
    .where(and(eq(members.eventId, eventId), eq(members.userId, userId), eq(members.botBlocked, true)))
    .catch(() => undefined);
}

async function renderPlayerHome(userId: number, webAppUrl: string, startPayload?: string) {
  const baseUrl = webAppUrl.replace(/\/$/, "");
  const isPuzzle = Boolean(startPayload?.startsWith("puzzle_"));
  const inviteCode = !isPuzzle && startPayload ? startPayload.toUpperCase() : null;

  const eventId = await activeEventId(runtime().db);
  if (!eventId) {
    const keyboard = new InlineKeyboard().webApp("Открыть Полевой атлас", webAppUrl);
    return {
      text: "<b>Полевой атлас готовится к запуску</b>\nСкоро ведущий откроет вход для команд.",
      keyboard,
    };
  }

  const [event, state] = await Promise.all([
    loadEvent(runtime().db, eventId),
    buildLiveState(runtime().db, eventId, {
      userId,
      displayName: "",
      username: null,
      isAdmin: false,
      botSurface: "player",
    }),
  ]);
  const template = normalizeTemplate(event.template);
  const lexicon = resolveLexicon(template);
  const myTeam = state.viewer.teamId ? state.teams.find((t) => t.id === state.viewer.teamId) : null;
  const phaseLine = formatPhaseStatus(
    state.gameState.currentPhase,
    state.gameState.roundMode,
    state.gameState.phaseEndsAt,
  );
  const marketOpen = state.gameState.purchasePhaseActive;
  const targetUrl = isPuzzle
    ? `${baseUrl}/?playground=${encodeURIComponent(startPayload ?? "1")}`
    : inviteCode
      ? `${baseUrl}/?code=${encodeURIComponent(inviteCode)}`
      : marketOpen && myTeam
        ? withUrlQuery(webAppUrl, "/?tab=market")
        : webAppUrl;

  const primaryLabel = isPuzzle
    ? "Открыть вызов (3 мин)"
    : inviteCode
      ? `Войти по коду ${inviteCode}`
      : myTeam
        ? marketOpen
          ? "Открыть магазин"
          : "Открыть кабинет команды"
        : "Войти в команду";

  const keyboard = new InlineKeyboard().webApp(primaryLabel, targetUrl);
  if (myTeam) {
    keyboard
      .row()
      .text("Обновить статус", "pl:status")
      .text("Задача дня", "pl:story")
      .text("Памятка", "pl:faq");
  } else {
    keyboard.row().text("Задача дня", "pl:story").text("Памятка", "pl:faq");
  }

  if (
    template.features.offClassPlayground !== false &&
    !isPuzzle &&
    !usesPhysicalBoard(template, resolveDayEngine(template, event.currentDay))
  ) {
    keyboard.row().webApp("Тренировка без зачёта · 3 мин", `${baseUrl}/?playground=1`);
  }

  const lines: string[] = [
    `<b>Полевой атлас · ${escapeHtml(template.title)}</b>`,
    `День ${event.currentDay} из ${template.totalDays} · ${escapeHtml(phaseLine)}`,
  ];

  if (myTeam) {
    const roleLabel = state.viewer.role === "captain" ? "капитан" : "участник";
    lines.push(
      "",
      `Команда: <b>${escapeHtml(myTeam.name)}</b> (${roleLabel})`,
      `${escapeHtml(lexicon.currencyLabel)}: <b>${myTeam.currency}</b> · ${escapeHtml(template.trackName)}: <b>${myTeam.trackPosition}/${template.trackMax}</b>`,
    );
    if (marketOpen) {
      lines.push("Магазин открыт — можно докупить детали прямо сейчас.");
    }
  } else if (inviteCode) {
    lines.push(
      "",
      `Код команды <code>${escapeHtml(inviteCode)}</code> уже подставлен — нажмите кнопку ниже.`,
    );
  } else {
    lines.push(
      "",
      "Нажмите <b>«Войти в команду»</b> и введите код со стола ведущего — либо просто отправьте этот код сообщением сюда.",
    );
  }

  return { text: lines.join("\n"), keyboard };
}

async function renderPlayerStory(webAppUrl: string) {
  const eventId = await activeEventId(runtime().db);
  if (!eventId) {
    return {
      text: "Активная смена пока не запущена.",
      keyboard: new InlineKeyboard().webApp("Открыть кабинет", webAppUrl),
    };
  }
  const event = await loadEvent(runtime().db, eventId);
  const template = normalizeTemplate(event.template);
  const briefing = template.dayBriefings.find((b) => b.day === event.currentDay) ?? template.dayBriefings[0];
  const text = briefing
    ? `<b>${escapeHtml(briefing.title)}</b>\n\n${escapeHtml(briefing.story)}` +
      (briefing.challengeTitle ? `\n\n<b>Задача дня:</b> ${escapeHtml(briefing.challengeTitle)}` : "")
    : `<b>День ${event.currentDay}</b>\nСледите за заданием ведущего смены.`;

  const keyboard = new InlineKeyboard()
    .webApp("Открыть кабинет команды", webAppUrl)
    .row()
    .text("К статусу", "pl:status")
    .text("Памятка", "pl:faq");
  return { text, keyboard };
}

async function renderPlayerFaq(webAppUrl: string) {
  const eventId = await activeEventId(runtime().db);
  if (!eventId) {
    return {
      text: "Справка станет доступна после старта смены.",
      keyboard: new InlineKeyboard().webApp("Открыть кабинет", webAppUrl),
    };
  }
  const event = await loadEvent(runtime().db, eventId);
  const template = normalizeTemplate(event.template);
  const lexicon = resolveLexicon(template);
  const f = template.features;
  const lines = [
    `<b>Памятка по смене «${escapeHtml(template.title)}»</b>`,
    "",
    `• <b>${escapeHtml(lexicon.currencyLabel)}</b>: начисляются ведущим за работу на занятии.`,
    `• <b>Сборка («${escapeHtml(lexicon.objectName)}»)</b>: улучшайте характеристики перед ходом по полю.`,
    `• <b>${escapeHtml(template.trackName)}</b>: цель — дойти до финиша (${template.trackMax}).`,
    f.slotInventory ? "• <b>Склад команды</b>: снятые детали сохраняются и переставляются бесплатно." : "",
    f.p2pMarket ? "• <b>Биржа команд</b>: лишние детали со склада можно продать другим командам." : "",
    f.auctions ? "• <b>Аукцион</b>: редкие детали разыгрываются на открытых торгах." : "",
  ].filter(Boolean);

  const keyboard = new InlineKeyboard()
    .webApp("Поле и правила", withUrlQuery(webAppUrl, "/?tab=race"))
    .row()
    .text("К статусу", "pl:status")
    .text("Задача дня", "pl:story");
  return { text: lines.join("\n"), keyboard };
}

async function editOrReplyHtml(ctx: Context, text: string, keyboard: InlineKeyboard) {
  try {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  }
}

export function registerPlayerHandlers(bot: Bot, webAppUrl: string) {
  bot.use(async (ctx, next) => {
    if (ctx.from?.id) {
      await markPlayerReachable(ctx.from.id);
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    const view = await renderPlayerHome(ctx.from?.id ?? 0, webAppUrl, ctx.match?.trim());
    await ctx.reply(view.text, { parse_mode: "HTML", reply_markup: view.keyboard });
  });

  bot.command("status", async (ctx) => {
    const view = await renderPlayerHome(ctx.from?.id ?? 0, webAppUrl);
    await ctx.reply(view.text, { parse_mode: "HTML", reply_markup: view.keyboard });
  });

  bot.command("story", async (ctx) => {
    const view = await renderPlayerStory(webAppUrl);
    await ctx.reply(view.text, { parse_mode: "HTML", reply_markup: view.keyboard });
  });

  bot.command("faq", async (ctx) => {
    const view = await renderPlayerFaq(webAppUrl);
    await ctx.reply(view.text, { parse_mode: "HTML", reply_markup: view.keyboard });
  });

  bot.command("playground", async (ctx) => {
    const baseUrl = webAppUrl.replace(/\/$/, "");
    const keyboard = new InlineKeyboard()
      .webApp("Открыть тренировку · 3 мин", `${baseUrl}/?playground=1`)
      .row()
      .text("К статусу", "pl:status");
    await ctx.reply(
      "<b>Тренировка без зачёта</b>\nБаланс и место команды в смене не изменятся.\n• Спаси заезд одной правкой\n• Приборная диагностика за 2 замера",
      { parse_mode: "HTML", reply_markup: keyboard },
    );
  });

  bot.callbackQuery("pl:status", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Статус обновлён" });
    const view = await renderPlayerHome(ctx.from.id, webAppUrl);
    await editOrReplyHtml(ctx, view.text, view.keyboard);
  });

  bot.callbackQuery("pl:story", async (ctx) => {
    await ctx.answerCallbackQuery();
    const view = await renderPlayerStory(webAppUrl);
    await editOrReplyHtml(ctx, view.text, view.keyboard);
  });

  bot.callbackQuery("pl:faq", async (ctx) => {
    await ctx.answerCallbackQuery();
    const view = await renderPlayerFaq(webAppUrl);
    await editOrReplyHtml(ctx, view.text, view.keyboard);
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (!text || text.startsWith("/")) return;

    const eventId = await activeEventId(runtime().db);
    if (eventId && JOIN_CODE_PATTERN.test(text)) {
      const code = text.toUpperCase();
      const [team] = await runtime()
        .db.select({ id: teams.id, name: teams.name, joinCode: teams.joinCode })
        .from(teams)
        .where(and(eq(teams.eventId, eventId), eq(teams.joinCode, code)));
      if (team) {
        const keyboard = new InlineKeyboard().webApp(
          `Войти в команду «${team.name}»`,
          withUrlQuery(webAppUrl, `/?code=${encodeURIComponent(team.joinCode)}`),
        );
        await ctx.reply(
          `<b>Код команды найден: ${escapeHtml(team.name)}</b>\nНажмите кнопку ниже, чтобы присоединиться.`,
          { parse_mode: "HTML", reply_markup: keyboard },
        );
        return;
      }
    }

    const keyboard = new InlineKeyboard()
      .webApp("Открыть кабинет команды", webAppUrl)
      .row()
      .text("Мой статус", "pl:status")
      .text("Памятка", "pl:faq");
    await ctx.reply(
      "Все действия с ровером, покупки и поле — внутри мини-приложения.\nНажмите кнопку ниже или отправьте код команды со стола.",
      { reply_markup: keyboard, disable_notification: true },
    );
  });
}
