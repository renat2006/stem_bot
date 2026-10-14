import { Bot, InlineKeyboard } from "grammy";
import { activeEventId, loadEvent } from "../modules/event/repository.js";
import { runtime } from "../shared/runtime.js";

export function createTelegramBot(token: string, webAppUrl: string): Bot {
  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const keyboard = new InlineKeyboard().webApp("Открыть игру", webAppUrl);
    const eventId = await activeEventId(runtime().db);
    if (!eventId) {
      await ctx.reply("Смена ещё не создана.", { reply_markup: keyboard });
      return;
    }
    const event = await loadEvent(runtime().db, eventId);
    const { template } = event;
    await ctx.reply(
      `${template.currencyIcon} ${template.title}\nТема: ${template.theme}\nДень ${event.currentDay} из ${template.totalDays}\n\nОткройте игру, введите код команды — и вперёд.`,
      { reply_markup: keyboard },
    );
  });

  bot.on("callback_query:data", (ctx) => ctx.answerCallbackQuery());

  bot.catch(({ ctx, error }) => {
    console.error(`Bot update ${ctx.update.update_id} failed`, error);
  });

  return bot;
}

export async function configureBotDelivery(
  bot: Bot,
  delivery: { webhook: { url: string; secret: string } | null; polling: boolean },
) {
  if (delivery.webhook) {
    await bot.init();
    await bot.api.setWebhook(delivery.webhook.url, {
      secret_token: delivery.webhook.secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
    return;
  }
  if (!delivery.polling) {
    console.warn(
      "Bot is idle: set PUBLIC_URL + WEBHOOK_SECRET for webhook or BOT_POLLING=true for local polling",
    );
    return;
  }
  await bot.init();
  await bot.api.deleteWebhook();
  void bot.start({ allowed_updates: ["message", "callback_query"] });
}
