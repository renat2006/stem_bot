import { AsyncLocalStorage } from "node:async_hooks";
import { timingSafeEqual } from "node:crypto";
import { autoRetry } from "@grammyjs/auto-retry";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { and, eq } from "drizzle-orm";
import { Bot, InlineKeyboard } from "grammy";
import type { Update } from "grammy/types";
import type { Context as HonoContext } from "hono";
import { members } from "../db/schema.js";
import { config } from "../shared/config.js";
import { type AlertService, type DispatchReport, type QueuedAlert, runtime } from "../shared/runtime.js";
import { registerAdminHandlers } from "./admin.js";
import { withUrlQuery } from "./format.js";
import { registerPlayerHandlers } from "./player.js";

const webhookReplyStore = new AsyncLocalStorage<{
  bot: Bot;
  payload: Record<string, unknown> | null;
}>();

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

  bot.api.config.use(
    autoRetry({
      maxRetryAttempts: 1,
      maxDelaySeconds: 5,
    }),
  );
  bot.api.config.use(
    apiThrottler({
      global: { reservoir: 28, reservoirRefreshAmount: 28, reservoirRefreshInterval: 1000 },
      out: { maxConcurrent: 1, minTime: 1000 },
    }),
  );
  bot.api.config.use(async (prev, method, payload, signal) => {
    const store = webhookReplyStore.getStore();
    if (
      store &&
      store.bot === bot &&
      !store.payload &&
      (method === "sendMessage" || method === "answerCallbackQuery")
    ) {
      store.payload = { method, ...(payload as Record<string, unknown>) };
      return { ok: true, result: true as never };
    }
    return prev(method, payload, signal);
  });
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
    const store: { bot: Bot; payload: Record<string, unknown> | null } = { bot, payload: null };
    await webhookReplyStore.run(store, () => bot.handleUpdate(update));
    if (store.payload) {
      return c.json(store.payload, 200);
    }
    return c.json({ ok: true }, 200);
  };
}

export function createPlayerBot(
  token: string,
  webAppUrl: string,
  apiRoot: string = config.TELEGRAM_API_ROOT,
): Bot {
  const bot = new Bot(token, {
    client: { apiRoot, timeoutSeconds: 10 },
  });
  attachBotRuntime(bot, token, "stem_player_bot");
  registerPlayerHandlers(bot, webAppUrl);

  bot.on("callback_query:data", (ctx) => ctx.answerCallbackQuery());
  bot.catch(({ ctx, error }) => {
    console.error(`Player bot update ${ctx.update.update_id} failed`, error);
  });

  return bot;
}

export function createAdminBot(
  token: string,
  adminWebAppUrl: string,
  adminIds: ReadonlySet<number>,
  apiRoot: string = config.TELEGRAM_API_ROOT,
): Bot {
  const bot = new Bot(token, {
    client: { apiRoot, timeoutSeconds: 10 },
  });
  attachBotRuntime(bot, token, "stem_admin_bot");
  registerAdminHandlers(bot, adminWebAppUrl, adminIds);

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

  async function safeSendPlayer(
    eventId: string,
    userId: number,
    item: QueuedAlert,
  ): Promise<"delivered" | "blocked" | "failed"> {
    if (!playerBot) return "failed";
    try {
      const targetUrl = item.ctaPath ? withUrlQuery(webAppUrl, item.ctaPath) : webAppUrl;
      const kb = new InlineKeyboard().webApp(item.ctaLabel ?? "Открыть кабинет", targetUrl);
      await playerBot.api.sendMessage(userId, item.text, {
        reply_markup: kb,
        parse_mode: item.parseMode,
        disable_notification: item.silent,
      });
      return "delivered";
    } catch (err: unknown) {
      const code = (err as { error_code?: number })?.error_code;
      if (code === 403 || code === 400) {
        await runtime()
          .db.update(members)
          .set({ botBlocked: true })
          .where(and(eq(members.eventId, eventId), eq(members.userId, userId)))
          .catch(() => undefined);
        return "blocked";
      }
      return "failed";
    }
  }

  return {
    async dispatch(eventId: string, alerts: QueuedAlert[]): Promise<DispatchReport> {
      const report: DispatchReport = { attempted: 0, delivered: 0, blocked: 0, teams: 0 };
      if (!playerBot && !adminBot) return report;
      const db = runtime().db;
      const activeMembers = playerBot
        ? await db
            .select()
            .from(members)
            .where(and(eq(members.eventId, eventId), eq(members.botBlocked, false)))
        : [];
      const reachedTeams = new Set<string>();

      for (const item of alerts) {
        if (item.target === "team" && item.teamId && playerBot) {
          const recipients = activeMembers.filter((m) => m.teamId === item.teamId);
          report.attempted += recipients.length;
          const results = await Promise.all(recipients.map((m) => safeSendPlayer(eventId, m.userId, item)));
          for (const res of results) {
            if (res === "delivered") {
              report.delivered += 1;
              reachedTeams.add(item.teamId);
            } else if (res === "blocked") {
              report.blocked += 1;
            }
          }
        } else if (item.target === "all-teams" && playerBot) {
          report.attempted += activeMembers.length;
          const results = await Promise.all(
            activeMembers.map(async (m) => ({
              teamId: m.teamId,
              outcome: await safeSendPlayer(eventId, m.userId, item),
            })),
          );
          for (const res of results) {
            if (res.outcome === "delivered") {
              report.delivered += 1;
              reachedTeams.add(res.teamId);
            } else if (res.outcome === "blocked") {
              report.blocked += 1;
            }
          }
        } else if (item.target === "admins" && adminBot) {
          const kb = new InlineKeyboard().webApp(item.ctaLabel ?? "Открыть Пульт", adminWebAppUrl);
          await Promise.all(
            [...adminIds].map((adminId) =>
              adminBot.api
                .sendMessage(adminId, item.text, {
                  reply_markup: kb,
                  parse_mode: item.parseMode,
                  disable_notification: item.silent,
                })
                .catch(() => undefined),
            ),
          );
        }
      }
      report.teams = reachedTeams.size;
      return report;
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
