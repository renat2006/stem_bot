import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectPglite, type DbHandle } from "../db/client.js";
import { members } from "../db/schema.js";
import { createTeam } from "../modules/admin/service.js";
import { ensureActiveEvent } from "../modules/event/seed.js";
import { joinTeam } from "../modules/team/service.js";
import { RealtimeHub } from "../realtime/hub.js";
import { config } from "../shared/config.js";
import type { Identity } from "../shared/identity.js";
import { runtime, setRuntime } from "../shared/runtime.js";
import { createAdminBot, createAlertService, createPlayerBot } from "./index.js";

const admin: Identity = {
  userId: 1,
  displayName: "Ведущий",
  username: "host",
  isAdmin: true,
  botSurface: "admin",
};

const playerIdentity = (userId: number, name: string): Identity => ({
  userId,
  displayName: name,
  username: null,
  isAdmin: false,
  botSurface: "player",
});

type RecordedCall = {
  bot: "player" | "admin";
  method: string;
  payload: Record<string, unknown>;
};

let handle: DbHandle;
let eventId: string;
let teamACode: string;
let teamBId: string;

const calls: RecordedCall[] = [];
let playerBot: ReturnType<typeof createPlayerBot>;
let adminBot: ReturnType<typeof createAdminBot>;

function makeCommand(id: number, userId: number, text: string) {
  return {
    update_id: id,
    message: {
      message_id: id,
      date: Math.floor(Date.now() / 1000),
      chat: { id: userId, type: "private" as const, first_name: "User" },
      from: { id: userId, is_bot: false, first_name: "User" },
      text,
      entities: [{ offset: 0, length: (text.split(" ")[0] ?? text).length, type: "bot_command" as const }],
    },
  };
}

function makeText(id: number, userId: number, text: string) {
  return {
    update_id: id,
    message: {
      message_id: id,
      date: Math.floor(Date.now() / 1000),
      chat: { id: userId, type: "private" as const, first_name: "User" },
      from: { id: userId, is_bot: false, first_name: "User" },
      text,
    },
  };
}

function makeCallback(id: number, userId: number, data: string) {
  return {
    update_id: id,
    callback_query: {
      id: `cb-${id}`,
      from: { id: userId, is_bot: false, first_name: "User" },
      chat_instance: `inst-${userId}`,
      data,
      message: {
        message_id: id,
        date: Math.floor(Date.now() / 1000),
        chat: { id: userId, type: "private" as const, first_name: "User" },
        text: "prev",
      },
    },
  };
}

beforeAll(async () => {
  handle = await connectPglite(undefined, config.MIGRATIONS_DIR);
  playerBot = createPlayerBot("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11", "https://stem-bot.renat.site");
  adminBot = createAdminBot(
    "654321:XYZ-DEF1234ghIkl-zyx57W2v1u123ew22",
    "https://stem-bot.renat.site/?surface=admin",
    new Set([1]),
  );

  for (const [kind, b] of [
    ["player", playerBot],
    ["admin", adminBot],
  ] as const) {
    b.api.config.use(async (_prev, method, payload) => {
      calls.push({ bot: kind, method, payload: (payload ?? {}) as Record<string, unknown> });
      return { ok: true, result: true as never };
    });
  }

  const alerts = createAlertService({
    playerBot,
    adminBot,
    adminIds: new Set([1]),
    webAppUrl: "https://stem-bot.renat.site",
    adminWebAppUrl: "https://stem-bot.renat.site/?surface=admin",
  });

  setRuntime({ db: handle.db, hub: new RealtimeHub(() => runtime().db), alerts });
  eventId = await ensureActiveEvent(handle.db, false);

  const a = await createTeam({ eventId, actor: admin }, { name: "Марс-01" });
  const b = await createTeam({ eventId, actor: admin }, { name: "Кратер-04" });
  teamACode = a.joinCode;
  teamBId = b.teamId;

  await joinTeam({ eventId, actor: playerIdentity(101, "Алиса") }, { code: teamACode, displayName: "Алиса" });
  await joinTeam({ eventId, actor: playerIdentity(201, "Кира") }, { code: b.joinCode, displayName: "Кира" });
});

afterAll(async () => {
  runtime().hub.close();
  await handle.close();
});

describe("bot UX, feedback callbacks, and admin-to-player messaging", () => {
  it("shows personalized team status in playerBot and refreshes in place on callback", async () => {
    calls.length = 0;
    await playerBot.handleUpdate(makeCommand(10, 101, "/start"));
    const reply = calls.find((c) => c.bot === "player" && c.method === "sendMessage");
    expect(String(reply?.payload.text)).toContain("Марс-01");
    expect(String(reply?.payload.text)).toContain("капитан");

    calls.length = 0;
    await playerBot.handleUpdate(makeCallback(11, 101, "pl:status"));
    expect(calls.some((c) => c.bot === "player" && c.method === "answerCallbackQuery")).toBe(true);
    expect(calls.some((c) => c.bot === "player" && c.method === "editMessageText")).toBe(true);
  });

  it("recognizes a team join code typed directly into playerBot chat", async () => {
    calls.length = 0;
    await playerBot.handleUpdate(makeText(12, 999, teamACode.toLowerCase()));
    const reply = calls.find((c) => c.bot === "player" && c.method === "sendMessage");
    expect(String(reply?.payload.text)).toContain("Код команды найден: Марс-01");
  });

  it("unblocks player automatically when they interact with playerBot again", async () => {
    await handle.db.update(members).set({ botBlocked: true }).where(eq(members.userId, 101));
    await playerBot.handleUpdate(makeCommand(13, 101, "/status"));
    const [row] = await handle.db.select().from(members).where(eq(members.userId, 101));
    expect(row?.botBlocked).toBe(false);
  });

  it("delivers /msg from adminBot into playerBot for all teams with preview, sound toggle, and receipt", async () => {
    calls.length = 0;
    await adminBot.handleUpdate(makeCommand(20, 1, "/msg Через 5 минут открываем магазин!"));
    const preview = calls.find((c) => c.bot === "admin" && c.method === "sendMessage");
    expect(String(preview?.payload.text)).toContain("Предпросмотр отправки");
    expect(String(preview?.payload.text)).toContain("Через 5 минут открываем магазин!");

    calls.length = 0;
    await adminBot.handleUpdate(makeCallback(21, 1, "adm:msg:silent"));
    const silentEdit = calls.find((c) => c.bot === "admin" && c.method === "editMessageText");
    expect(String(silentEdit?.payload.text)).toContain("Тихо (без звука)");

    calls.length = 0;
    await adminBot.handleUpdate(makeCallback(22, 1, "adm:msg:send"));
    const deliveredToPlayers = calls.filter((c) => c.bot === "player" && c.method === "sendMessage");
    expect(deliveredToPlayers).toHaveLength(2);
    expect(deliveredToPlayers.map((c) => c.payload.chat_id).sort()).toEqual([101, 201]);
    expect(deliveredToPlayers[0]?.payload.disable_notification).toBe(true);
    expect(String(deliveredToPlayers[0]?.payload.text)).toContain(
      "<blockquote>Через 5 минут открываем магазин!</blockquote>",
    );

    const receipt = calls.find((c) => c.bot === "admin" && c.method === "editMessageText");
    expect(String(receipt?.payload.text)).toContain("Доставлено: <b>2 из 2</b>");
  });

  it("supports targeting a single team via interactive buttons and free-text message in adminBot", async () => {
    calls.length = 0;
    await adminBot.handleUpdate(makeCallback(30, 1, `adm:msg:t:${teamBId}`));
    await adminBot.handleUpdate(makeText(31, 1, "Проверьте слот шасси перед выездом"));
    calls.length = 0;
    await adminBot.handleUpdate(makeCallback(32, 1, "adm:msg:send"));

    const deliveredToPlayers = calls.filter((c) => c.bot === "player" && c.method === "sendMessage");
    expect(deliveredToPlayers).toHaveLength(1);
    expect(deliveredToPlayers[0]?.payload.chat_id).toBe(201);
    expect(String(deliveredToPlayers[0]?.payload.text)).toContain("Кратер-04");
    expect(String(deliveredToPlayers[0]?.payload.text)).toContain("Проверьте слот шасси перед выездом");
  });
});
