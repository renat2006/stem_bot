import { autoRetry } from "@grammyjs/auto-retry";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { and, eq } from "drizzle-orm";
import { Bot, InlineKeyboard } from "grammy";
import { members } from "../db/schema.js";
import { activeEventId, loadEvent } from "../modules/event/repository.js";
import { buildLiveState, normalizeTemplate } from "../modules/event/snapshot.js";
import { type AlertService, type QueuedAlert, runtime } from "../shared/runtime.js";

function attachRateLimitPlugins(bot: Bot) {
  bot.api.config.use(
    apiThrottler({
      global: { reservoir: 28, reservoirRefreshAmount: 28, reservoirRefreshInterval: 1000 },
      out: { maxConcurrent: 1, minTime: 1000 },
    }),
  );
  bot.api.config.use(
    autoRetry({
      maxRetryAttempts: 3,
      maxDelaySeconds: 45,
    }),
  );
}

export function createPlayerBot(token: string, webAppUrl: string): Bot {
  const bot = new Bot(token);
  attachRateLimitPlugins(bot);

  bot.command("start", async (ctx) => {
    const startPayload = ctx.match?.trim();
    const targetUrl = startPayload
      ? `${webAppUrl.replace(/\/$/, "")}/?code=${encodeURIComponent(startPayload)}`
      : webAppUrl;
    const keyboard = new InlineKeyboard().webApp("🚀 Открыть кабинет команды", targetUrl);

    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.reply("Смена готовится к запуску. Скоро ведущий откроет вход!", { reply_markup: keyboard });
      return;
    }
    const event = await loadEvent(runtime().db, eventId);
    const template = normalizeTemplate(event.template);
    const intro = template.dayBriefings.find((b) => b.day === event.currentDay) ?? template.dayBriefings[0];

    await ctx.reply(
      `${template.currencyIcon} ${template.title}\n${template.theme}\nДень ${event.currentDay} из ${template.totalDays}` +
        (intro ? `\n\n📡 ${intro.title}\n${intro.story}` : "") +
        "\n\nНажмите кнопку ниже, чтобы войти в ангар своей команды.",
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
      await ctx.reply(`День ${event.currentDay}: следите за анонсами ведущего смены.`);
      return;
    }
    const keyboard = new InlineKeyboard().webApp("Открыть ангар", webAppUrl);
    await ctx.reply(
      `📡 ${briefing.title}\n\n${briefing.story}` +
        (briefing.challengeTitle ? `\n\n🎯 Фокус дня: ${briefing.challengeTitle}` : ""),
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
    const f = template.features;
    const lines = [
      `📖 Памятка по смене «${template.title}»`,
      "",
      `• Валюта (${template.currencyIcon} ${template.currencyName}): начисляется ведущим за реальные успехи команды.`,
      `• Сборка («${template.objectName}»): каждая деталь усиливает одни сферы, но может давать минус в других.`,
      f.slotInventory
        ? "• Склад команды: при замене узла старая деталь сохраняется на складе — её можно вернуть перед другой трассой."
        : "• Замена узла: новая деталь ставится поверх старой.",
      f.p2pMarket
        ? "• Биржа команд: ненужные детали со склада можно продать другим командам за свою цену."
        : "",
      f.auctions
        ? "• Аукцион дня: редкие и легендарные узлы разыгрываются на открытых торгах с защитой от ставок в последнюю секунду."
        : "",
      f.dayEvents
        ? "• Испытание дня: в конце раунда сборка проходит проверку трассой — держите профильную характеристику выше порога."
        : "",
    ].filter(Boolean);

    const keyboard = new InlineKeyboard().webApp("Перейти к игре", webAppUrl);
    await ctx.reply(lines.join("\n"), { reply_markup: keyboard });
  });

  bot.on("callback_query:data", (ctx) => ctx.answerCallbackQuery());

  bot.catch(({ ctx, error }) => {
    console.error(`Player bot update ${ctx.update.update_id} failed`, error);
  });

  return bot;
}

export function createAdminBot(token: string, adminWebAppUrl: string, adminIds: ReadonlySet<number>): Bot {
  const bot = new Bot(token);
  attachRateLimitPlugins(bot);

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
    const wizardUrl = `${adminWebAppUrl}${adminWebAppUrl.includes("?") ? "&" : "?"}tab=wizard`;
    const keyboard = new InlineKeyboard()
      .webApp("🎛 Открыть Пульт Ведущего", adminWebAppUrl)
      .row()
      .webApp("✦ Мастер новой смены", wizardUrl);

    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.reply("Админ-студия готова. Создайте новую смену через Мастер запуска!", {
        reply_markup: keyboard,
      });
      return;
    }
    const state = await buildLiveState(runtime().db, eventId);
    const event = await loadEvent(runtime().db, eventId);
    await ctx.reply(
      `🛠 Пульт смены «${event.title}»\n` +
        `День ${state.gameState.currentDay} · Команд: ${state.teams.length}\n` +
        `Здоровье баланса: ${state.liveBalance.healthScore}/100 (${state.liveBalance.momentumLabel})\n` +
        `${state.liveBalance.summary}`,
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
    await bot.init();
    await bot.api.setWebhook(delivery.webhook.url, {
      secret_token: delivery.webhook.secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
    await applyMeta();
    return;
  }
  if (!delivery.polling) return;
  await bot.init();
  await bot.api.deleteWebhook();
  await applyMeta();
  void bot.start({ allowed_updates: ["message", "callback_query"] });
}
