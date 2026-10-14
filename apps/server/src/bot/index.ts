import { Bot, InlineKeyboard } from "grammy";
import { store } from "../shared/store.js";

export function createTelegramBot(token: string, webAppUrl: string): Bot {
  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const template = store.getActiveTemplate();
    const keyboard = new InlineKeyboard().webApp("Открыть STEM Конструктор", webAppUrl);

    await ctx.reply(
      `${template.currencyIcon} ${template.title}\nТема: ${template.theme}\nДень: ${store.gameState.currentDay}/${template.totalDays}`,
      { reply_markup: keyboard },
    );
  });

  bot.on("callback_query:data", (ctx) => ctx.answerCallbackQuery());

  bot.catch(({ ctx, error }) => {
    console.error(`Bot update ${ctx.update.update_id} failed`, error);
  });

  return bot;
}

export async function configureBotDelivery(bot: Bot, webhook: { url: string; secret: string } | null) {
  await bot.init();
  if (webhook) {
    await bot.api.setWebhook(webhook.url, {
      secret_token: webhook.secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
    return;
  }
  await bot.api.deleteWebhook();
  void bot.start({ allowed_updates: ["message", "callback_query"] });
}
