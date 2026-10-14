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

  return bot;
}
