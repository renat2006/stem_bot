import { AsyncLocalStorage } from "node:async_hooks";
import { timingSafeEqual } from "node:crypto";
import { autoRetry } from "@grammyjs/auto-retry";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { resolveDayEngine, resolveLexicon, usesPhysicalBoard } from "@stem/shared";
import { and, eq } from "drizzle-orm";
import { Bot, InlineKeyboard } from "grammy";
import type { Update } from "grammy/types";
import type { Context as HonoContext } from "hono";
import { members } from "../db/schema.js";
import { activeEventId, loadEvent } from "../modules/event/repository.js";
import { buildLiveState, normalizeTemplate } from "../modules/event/snapshot.js";
import { config } from "../shared/config.js";
import { type AlertService, type QueuedAlert, runtime } from "../shared/runtime.js";

const webhookReplyStore = new AsyncLocalStorage<{ payload: Record<string, unknown> | null }>();

function attachBotRuntime(bot: Bot, token: string, defaultUsername: string) {
  const botId = Number(token.split(":")[0]) || 1;
  bot.botInfo = {
    id: botId,
    is_bot: true,
    first_name: "STEM Bot",
    username: defaultUsername,
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: true,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  };

  bot.api.config.use(async (prev, method, payload, signal) => {
    const store = webhookReplyStore.getStore();
    if (store && !store.payload && (method === "sendMessage" || method === "answerCallbackQuery")) {
      store.payload = { method, ...(payload as Record<string, unknown>) };
      return { ok: true, result: true as never };
    }
    return prev(method, payload, signal);
  });

  bot.api.config.use(
    apiThrottler({
      global: { reservoir: 28, reservoirRefreshAmount: 28, reservoirRefreshInterval: 1000 },
      out: { maxConcurrent: 1, minTime: 1000 },
    }),
  );
  bot.api.config.use(
    autoRetry({
      maxRetryAttempts: 2,
      maxDelaySeconds: 15,
    }),
  );
}

function secretsEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function createBotWebhookHandler(bot: Bot, secretToken: string) {
  return async (c: HonoContext) => {
    const provided = c.req.header("x-telegram-bot-api-secret-token") ?? "";
    if (!provided || !secretsEqual(provided, secretToken)) {
      return c.json({ error: "Unauthorized webhook" }, 401);
    }
    const update = await c.req.json<Update>().catch(() => null);
    if (!update || typeof update.update_id !== "number") {
      return c.json({ error: "Invalid update" }, 400);
    }
    const store: { payload: Record<string, unknown> | null } = { payload: null };
    await webhookReplyStore.run(store, () => bot.handleUpdate(update));
    if (store.payload) {
      return c.json(store.payload, 200);
    }
    return c.json({ ok: true }, 200);
  };
}

export function createPlayerBot(token: string, webAppUrl: string): Bot {
  const bot = new Bot(token, {
    client: { apiRoot: config.TELEGRAM_API_ROOT, timeoutSeconds: 20 },
  });
  attachBotRuntime(bot, token, "stem_player_bot");

  bot.command("start", async (ctx) => {
    const startPayload = ctx.match?.trim();
    const baseUrl = webAppUrl.replace(/\/$/, "");
    const isPuzzle = startPayload?.startsWith("puzzle_");
    const targetUrl = isPuzzle
      ? `${baseUrl}/?playground=${encodeURIComponent(startPayload ?? "1")}`
      : startPayload
        ? `${baseUrl}/?code=${encodeURIComponent(startPayload)}`
        : webAppUrl;

    const keyboard = new InlineKeyboard().webApp(
      isPuzzle ? "Открыть вызов (3 мин)" : "Открыть кабинет команды",
      targetUrl,
    );

    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.reply("Полевой атлас готовится к запуску. Скоро ведущий откроет вход для команд.", {
        reply_markup: keyboard,
      });
      return;
    }
    const event = await loadEvent(runtime().db, eventId);
    const template = normalizeTemplate(event.template);
    const lexicon = resolveLexicon(template);
    const intro = template.dayBriefings.find((b) => b.day === event.currentDay) ?? template.dayBriefings[0];

    if (
      template.features.offClassPlayground !== false &&
      !isPuzzle &&
      !usesPhysicalBoard(template, resolveDayEngine(template, event.currentDay))
    ) {
      keyboard.row().webApp("Тренировка без зачёта · 3 мин", `${baseUrl}/?playground=1`);
    }

    await ctx.reply(
      `Полевой атлас · ${template.title}\n${template.theme}\nДень ${event.currentDay} из ${template.totalDays} · Ресурс: ${lexicon.currencyLabel}` +
        (intro ? `\n\n${intro.title}\n${intro.story}` : "") +
        "\n\nОткройте приложение ниже, чтобы перейти к своей команде.",
      { reply_markup: keyboard },
    );
  });

  bot.command("story", async (ctx) => {
    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.reply("Активная смена пока не запущена.");
      return;
    }
    const event = await loadEvent(runtime().db, eventId);
    const template = normalizeTemplate(event.template);
    const briefing =
      template.dayBriefings.find((b) => b.day === event.currentDay) ?? template.dayBriefings[0];
    if (!briefing) {
      await ctx.reply(`День ${event.currentDay}: следите за заданием ведущего смены.`);
      return;
    }
    const keyboard = new InlineKeyboard().webApp("Открыть кабинет команды", webAppUrl);
    await ctx.reply(
      `${briefing.title}\n\n${briefing.story}` +
        (briefing.challengeTitle ? `\n\nЗадача дня: ${briefing.challengeTitle}` : ""),
      { reply_markup: keyboard },
    );
  });

  bot.command("playground", async (ctx) => {
    const baseUrl = webAppUrl.replace(/\/$/, "");
    const keyboard = new InlineKeyboard().webApp("Открыть тренировку · 3 мин", `${baseUrl}/?playground=1`);
    await ctx.reply(
      "Тренировка без зачёта. Баланс и место команды в смене не изменятся.\n• Спаси заезд одной правкой\n• Приборная диагностика за 2 замера",
      { reply_markup: keyboard },
    );
  });

  bot.command("faq", async (ctx) => {
    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.reply("Справка станет доступна после старта смены.");
      return;
    }
    const event = await loadEvent(runtime().db, eventId);
    const template = normalizeTemplate(event.template);
    const lexicon = resolveLexicon(template);
    const f = template.features;
    const lines = [
      `Полевой атлас · Памятка по смене «${template.title}»`,
      "",
      `• Учебный бюджет (${lexicon.currencyLabel}): начисляется только наставником за реальную работу на занятии.`,
      `• Сборка («${lexicon.objectName}»): каждая деталь показывает, что даёт и чем за неё платит сборка.`,
      `• Командный раунд («${lexicon.programLabel}»): каждый участник управляет своим рычагом, а ${lexicon.reserveLabel.toLowerCase()} (+2) направляется в один участок.`,
      `• Приборная проверка («${lexicon.diagnosisLabel}»): до 2 замеров для отсева гипотез (очки = 3 − замеры, валюта: 0).`,
      f.slotInventory
        ? "• Склад команды: заменённые детали сохраняются на складе и переставляются бесплатно."
        : "",
      f.p2pMarket ? "• Биржа команд: лишние детали со склада можно выставить другим командам." : "",
      f.auctions ? "• Аукцион дня: редкие узлы разыгрываются на открытых торгах." : "",
    ].filter(Boolean);

    const keyboard = new InlineKeyboard().webApp("Перейти к команде", webAppUrl);
    await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
  });

  bot.on("callback_query:data", (ctx) => ctx.answerCallbackQuery());

  bot.catch(({ ctx, error }) => {
    console.error(`Player bot update ${ctx.update.update_id} failed`, error);
  });

  return bot;
}

export function createAdminBot(token: string, adminWebAppUrl: string, adminIds: ReadonlySet<number>): Bot {
  const bot = new Bot(token, {
    client: { apiRoot: config.TELEGRAM_API_ROOT, timeoutSeconds: 20 },
  });
  attachBotRuntime(bot, token, "stem_admin_bot");

  bot.use(async (ctx, next) => {
    const uid = ctx.from?.id;
    if (!uid || !adminIds.has(uid)) {
      if (ctx.message) {
        await ctx.reply("Доступ закрыт: этот бот предназначен только для организаторов и ведущих смены.");
      }
      return;
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    const sep = adminWebAppUrl.includes("?") ? "&" : "?";
    const wizardUrl = `${adminWebAppUrl}${sep}tab=wizard`;
    const projectorUrl = `${adminWebAppUrl}${sep}view=projector`;
    const keyboard = new InlineKeyboard()
      .webApp("Пульт живого урока", adminWebAppUrl)
      .row()
      .webApp("Конструктор смены (4 шага)", wizardUrl)
      .row()
      .webApp("Табло зала 16:9", projectorUrl);

    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.reply("Студия организатора готова. Запустите смену через Конструктор.", {
        reply_markup: keyboard,
      });
      return;
    }
    const state = await buildLiveState(runtime().db, eventId);
    const event = await loadEvent(runtime().db, eventId);
    const template = normalizeTemplate(event.template);
    const engine = resolveDayEngine(template, state.gameState.currentDay);
    const engineTitle =
      engine === "diagnosis" ? "Диагностика" : engine === "legacy_track" ? "Трек" : "Миссия 2:00";
    await ctx.reply(
      `Полевой атлас · Студия «${event.title}»\n` +
        `День ${state.gameState.currentDay} (${engineTitle}) · Команд: ${state.teams.length}\n` +
        `Баланс смены: ${state.liveBalance.healthScore}/100 (${state.liveBalance.momentumLabel})\n` +
        `${state.liveBalance.summary}`,
      { reply_markup: keyboard },
    );
  });

  bot.command("pulse", async (ctx) => {
    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.reply("Активная смена не найдена.");
      return;
    }
    const state = await buildLiveState(runtime().db, eventId);
    const readySlots = state.teams.reduce((acc, t) => acc + (t.roundState?.readySlots.length ?? 0), 0);
    const keyboard = new InlineKeyboard().webApp("Открыть пульт урока", adminWebAppUrl);
    await ctx.reply(
      `Пульс зала · День ${state.gameState.currentDay}\n` +
        `• Фаза: ${state.gameState.currentPhase} (${state.gameState.roundMode ?? "idle"})\n` +
        `• Ответов в раунде: ${readySlots} из ${state.teams.length * 5}\n` +
        `• Активных лотов биржи: ${state.listings.length}, аукционов: ${state.auctions.length}`,
      { reply_markup: keyboard },
    );
  });

  bot.command("wizard", async (ctx) => {
    const wizardUrl = `${adminWebAppUrl}${adminWebAppUrl.includes("?") ? "&" : "?"}tab=wizard`;
    const keyboard = new InlineKeyboard().webApp("✦ Запустить Мастер смены", wizardUrl);
    await ctx.reply("Откройте пошаговый конструктор смены (тема, легенды дней, редкости и команды):", {
      reply_markup: keyboard,
    });
  });

  bot.command("balance", async (ctx) => {
    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.reply("Смена не найдена.");
      return;
    }
    const state = await buildLiveState(runtime().db, eventId);
    const b = state.liveBalance;
    const alertLines =
      b.alerts.length > 0
        ? b.alerts
            .slice(0, 4)
            .map((a) => `• ${a.title}\n  ↳ ${a.suggestion}`)
            .join("\n\n")
        : "Критических перекосов не обнаружено.";
    const keyboard = new InlineKeyboard().webApp("Открыть Советник Баланса", adminWebAppUrl);
    await ctx.reply(`📊 Индекс баланса: ${b.healthScore}/100 · ${b.momentumLabel}\n\n${alertLines}`, {
      reply_markup: keyboard,
    });
  });

  bot.on("callback_query:data", (ctx) => ctx.answerCallbackQuery());

  bot.catch(({ ctx, error }) => {
    console.error(`Admin bot update ${ctx.update.update_id} failed`, error);
  });

  return bot;
}

export function createAlertService(params: {
  playerBot: Bot | null;
  adminBot: Bot | null;
  adminIds: ReadonlySet<number>;
  webAppUrl: string;
  adminWebAppUrl: string;
}): AlertService {
  const { playerBot, adminBot, adminIds, webAppUrl, adminWebAppUrl } = params;

  async function safeSendPlayer(eventId: string, userId: number, text: string) {
    if (!playerBot) return;
    try {
      const kb = new InlineKeyboard().webApp("Открыть игру", webAppUrl);
      await playerBot.api.sendMessage(userId, text, { reply_markup: kb });
    } catch (err: unknown) {
      const code = (err as { error_code?: number })?.error_code;
      if (code === 403 || code === 400) {
        await runtime()
          .db.update(members)
          .set({ botBlocked: true })
          .where(and(eq(members.eventId, eventId), eq(members.userId, userId)))
          .catch(() => undefined);
      }
    }
  }

  return {
    async dispatch(eventId: string, alerts: QueuedAlert[]) {
      if (!playerBot && !adminBot) return;
      const db = runtime().db;
      const activeMembers = playerBot
        ? await db
            .select()
            .from(members)
            .where(and(eq(members.eventId, eventId), eq(members.botBlocked, false)))
        : [];

      for (const item of alerts) {
        if (item.target === "team" && item.teamId && playerBot) {
          const recipients = activeMembers.filter((m) => m.teamId === item.teamId);
          await Promise.all(recipients.map((m) => safeSendPlayer(eventId, m.userId, item.text)));
        } else if (item.target === "all-teams" && playerBot) {
          await Promise.all(activeMembers.map((m) => safeSendPlayer(eventId, m.userId, item.text)));
        } else if (item.target === "admins" && adminBot) {
          const kb = new InlineKeyboard().webApp("Открыть Пульт", adminWebAppUrl);
          await Promise.all(
            [...adminIds].map((adminId) =>
              adminBot.api.sendMessage(adminId, item.text, { reply_markup: kb }).catch(() => undefined),
            ),
          );
        }
      }
    },
  };
}

export const createTelegramBot = createPlayerBot;

export async function configureBotDelivery(
  bot: Bot,
  delivery: {
    webhook: { url: string; secret: string } | null;
    polling: boolean;
    menuButton?: { text: string; url: string };
    commands?: Array<{ command: string; description: string }>;
  },
) {
  const applyMeta = async () => {
    if (delivery.commands?.length) {
      await bot.api.setMyCommands(delivery.commands).catch(() => undefined);
    }
    if (delivery.menuButton?.url.startsWith("https://")) {
      await bot.api
        .setChatMenuButton({
          menu_button: {
            type: "web_app",
            text: delivery.menuButton.text,
            web_app: { url: delivery.menuButton.url },
          },
        })
        .catch(() => undefined);
    }
  };

  if (delivery.webhook) {
    try {
      await bot.init();
      await bot.api.setWebhook(delivery.webhook.url, {
        secret_token: delivery.webhook.secret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false,
      });
      await applyMeta();
    } catch (err) {
      console.warn(
        "Skipping in-container Telegram webhook registration (managed externally):",
        (err as Error).message,
      );
    }
    return;
  }
  if (!delivery.polling) return;
  await bot.init();
  await bot.api.deleteWebhook();
  await applyMeta();
  void bot.start({ allowed_updates: ["message", "callback_query"] });
}
