import { expect, test } from "@playwright/test";

test("НейроФауна: занятие, покупка, физическое поле и следующий день", async ({ browser, request }) => {
  const adminHeaders = { "X-Dev-User": "1", "X-Dev-Surface": "admin" };
  const reset = await request.post("/api/admin/reset", {
    headers: adminHeaders,
    data: { templateId: "neurofauna-classic", demoTeams: true },
  });
  expect(reset.ok()).toBe(true);
  const state = await request.get("/api/game/state", { headers: adminHeaders });
  expect(state.ok()).toBe(true);
  const snapshot = await state.json();
  expect(snapshot.template.boardCells).toHaveLength(16);
  const [first] = snapshot.teams;
  const admin = await browser.newPage();
  const player = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await admin.routeWebSocket("**/api/ws", () => {});
  await admin.goto("/?as=1:Host&surface=admin");
  await player.goto(`/?as=101:Participant&join=${encodeURIComponent(first.joinCode)}`);
  await player.getByRole("button", { name: "Присоединиться к команде" }).click();
  await player.getByRole("button", { name: "Пропустить" }).click();
  await expect(player.getByText("Выполните задание занятия", { exact: true })).toBeVisible();

  const evaluation = admin.getByRole("region", { name: "Таблица оценки команд" });
  await evaluation.getByLabel("Результат +2").check();
  await evaluation.getByLabel("Замер +2").check();
  await admin.getByRole("button", { name: "Начислить отмеченным" }).click();
  await admin.getByRole("button", { name: "Открыть мастерскую (15 мин)" }).click();
  await player.getByRole("button", { name: "Открыть магазин", exact: true }).click();
  await player.getByRole("button", { name: /Голова льва/ }).click();
  await player.getByRole("button", { name: "Взять за 2 ДНК", exact: true }).click();
  await admin.getByRole("button", { name: "Перейти к ходу на поле" }).click();
  await expect(player.getByText("Подойдите к полю", { exact: true })).toBeVisible();

  const record = admin.getByRole("button", { name: "Применить ход по треку" });
  await expect(record).toBeDisabled();
  const invalid = await request.post("/api/admin/apply-turn", {
    headers: adminHeaders,
    data: { boardPositions: { [first.id]: 99 } },
  });
  expect(invalid.status()).toBe(400);
  const controls = admin
    .locator("section")
    .filter({ has: admin.getByRole("heading", { name: "Клетки с физического поля" }) })
    .last()
    .getByRole("combobox");
  const n = await controls.count();
  expect(n).toBe(snapshot.teams.length);
  for (let i = 0; i < n; i++) await controls.nth(i).selectOption(i === 0 ? "3" : "4");
  await admin.route("**/api/admin/apply-turn", async (route) => {
    const saved = await route.fetch();
    expect(saved.ok()).toBe(true);
    await route.abort("connectionreset");
  });
  await record.click();
  await expect(admin.getByRole("button", { name: "Открыть День 2" })).toBeVisible();

  await expect(player.getByText("Посмотрите результаты дня", { exact: true })).toBeVisible();
  await player.getByRole("button", { name: "Результаты и поле" }).click();
  await expect(player.getByRole("heading", { name: "Квадрат событий" })).toBeVisible();
  await expect(player.getByText(/Ресурс: клетка 3/)).toBeVisible();
  const projector = await browser.newPage();
  await projector.goto("/?as=1:Host&view=projector");
  await expect(projector.getByRole("heading", { name: "Квадрат событий" })).toBeVisible();
  await projector.close();
  const after = await (await request.get("/api/game/state", { headers: adminHeaders })).json();
  expect(after.teams.find((team: { id: string }) => team.id === first.id).boardPosition).toBe(3);
  const duplicate = await request.post("/api/admin/apply-turn", { headers: adminHeaders, data: {} });
  expect(duplicate.status()).toBe(200);
  await admin.getByRole("button", { name: "Открыть День 2" }).click();
  await expect(admin.getByRole("button", { name: "Открыть мастерскую (15 мин)" })).toBeVisible();
});

test("Экспедиция Роверов: новое поле заказчика (16 клеток + 30 Спираль, Детали, Завал, Болото)", async ({
  browser,
  request,
}) => {
  const ARTIFACT_DIR = "/Users/renat/.gemini/antigravity/brain/dc90e454-4407-4d8e-84e6-2cd2bd5d1a2a";
  const adminHeaders = { "X-Dev-User": "1", "X-Dev-Surface": "admin" };
  const reset = await request.post("/api/admin/reset", {
    headers: adminHeaders,
    data: { templateId: "rover-sprint-cu", demoTeams: true },
  });
  expect(reset.ok()).toBe(true);
  const snapshot = await (await request.get("/api/game/state", { headers: adminHeaders })).json();
  expect(snapshot.template.currencyName).toBe("Детали");
  expect(snapshot.template.trackMax).toBe(30);
  expect(snapshot.template.boardCells).toHaveLength(16);

  const [first] = snapshot.teams;
  const admin = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const player = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await admin.goto("/?as=1:Host&surface=admin");
  await player.goto(`/?as=101:Participant&join=${encodeURIComponent(first.joinCode)}`);
  await player.getByRole("button", { name: "Присоединиться к команде" }).click();
  await player.getByRole("button", { name: "Пропустить" }).click();

  await admin.getByRole("button", { name: "Открыть мастерскую (15 мин)" }).click();
  await admin.getByRole("button", { name: "Перейти к ходу на поле" }).click();
  await expect(admin.getByRole("heading", { name: "Клетки с физического поля" })).toBeVisible();

  const controls = admin
    .locator("section")
    .filter({ has: admin.getByRole("heading", { name: "Клетки с физического поля" }) })
    .last()
    .getByRole("combobox");
  const n = await controls.count();
  for (let i = 0; i < n; i++) {
    await controls.nth(i).selectOption(i === 0 ? "3" : i === 1 ? "6" : "4");
  }
  await expect(admin.getByText(/Мастерская: получено \+5 Детали/).first()).toBeVisible();
  await admin.getByRole("button", { name: "Применить ход по треку" }).click();

  await player.getByRole("button", { name: "Результаты и поле" }).click();
  await expect(player.getByRole("heading", { name: "Квадрат событий" })).toBeVisible();
  await player
    .getByRole("button", { name: /Болото/ })
    .first()
    .click();
  await expect(player.getByText(/потеряйте 1 Запчасть/)).toBeVisible();
  await player.screenshot({ path: `${ARTIFACT_DIR}/rover_board_mobile_390.png` });

  const projector = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await projector.goto("/?as=1:Host&view=projector");
  await expect(projector.getByRole("heading", { name: "Квадрат событий" })).toBeVisible();
  await expect(projector.getByText("Победитель заезда")).toBeVisible();
  await projector.screenshot({ path: `${ARTIFACT_DIR}/rover_board_projector_1920.png` });

  await admin.close();
  await player.close();
  await projector.close();
});

test("две смены подряд: два ведущих подтверждают первый ход и открывают второй день", async ({
  request,
  browser,
}) => {
  const headers = { "X-Dev-User": "1", "X-Dev-Surface": "admin" };
  const post = (path: string, data: unknown) => request.post("/api/admin/" + path, { headers, data });
  const host = await browser.newPage();
  await host.goto("/?as=1:Host&surface=admin");
  for (const templateId of ["neurofauna-classic", "rover-sprint-cu"]) {
    const reset = await post("reset", { templateId, demoTeams: true });
    expect(reset.ok()).toBe(true);
    const { teams } = await reset.json();
    expect((await post("phase", { phase: "market" })).ok()).toBe(true);
    expect((await post("phase", { phase: "turn" })).ok()).toBe(true);
    const body = {
      expectedDay: 1,
      boardPositions: Object.fromEntries(teams.map((t: { id: string }) => [t.id, 3])),
    };
    const [first, duplicate] = await Promise.all([post("apply-turn", body), post("apply-turn", body)]);
    expect(await first.text()).not.toContain("уже проведён");
    expect(first.ok()).toBe(true);
    expect(duplicate.ok()).toBe(true);
    const result = await first.json();
    expect((await duplicate.json()).teams).toEqual(result.teams);
    for (const team of teams) {
      expect(
        result.feed.filter(
          (entry: { teamId: string; kind: string }) => entry.teamId === team.id && entry.kind === "step",
        ),
      ).toHaveLength(1);
    }
    await expect(host.getByRole("button", { name: "Открыть День 2" })).toBeVisible();
    const advance = await Promise.all([
      post("next-day", { expectedDay: 1 }),
      post("next-day", { expectedDay: 1 }),
    ]);
    expect(advance.map((r) => r.status()).sort()).toEqual([200, 409]);
    const current = await (await request.get("/api/game/state", { headers })).json();
    expect(current.gameState.currentDay).toBe(2);
    expect(current.gameState.currentPhase).toBe("scoring");
    expect((await post("apply-turn", body)).status()).toBe(409);
  }
  await host.close();
});
