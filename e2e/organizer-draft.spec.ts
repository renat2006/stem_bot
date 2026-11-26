import { expect, test } from "@playwright/test";

test("организатор собирает смену на 320 px и редактирует каталог", async ({ page, request }) => {
  const headers = { "X-Dev-User": "1", "X-Dev-Surface": "admin" };
  const snapshot = async () => (await request.get("/api/game/state", { headers })).json();
  const before = await snapshot();
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/?as=1:Host&surface=admin");
  await page.getByRole("button", { name: "Новая смена", exact: true }).click();
  await page.getByLabel("Название смены").fill("Лунная база");
  const png = {
    name: "cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
      "base64",
    ),
  };
  await page.getByLabel("Обложка смены").setInputFiles(png);
  await expect(page.getByText("Картинка загружена")).toBeVisible();
  await page.getByRole("button", { name: "3. Карты" }).click();
  await page.getByRole("button", { name: "Собрать колоду с нуля" }).click();
  await page.getByRole("button", { name: "Очистить колоду черновика" }).click();
  await page.getByRole("button", { name: "Добавить деталь" }).click();
  await page.getByLabel("Название детали").fill("Лунная камера");
  await page.getByLabel("Изображение детали").setInputFiles(png);
  await expect(page.getByText("Картинка загружена")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Черновик смены" }).click();
  await expect(page.getByLabel("Название детали")).toHaveValue("Лунная камера");
  await page.getByRole("button", { name: "4. Команды и запуск" }).click();
  await page.getByLabel(/Стартовое количество/).fill("2");
  await page.getByLabel("Название команды 1", { exact: true }).fill("Луна");
  expect((await snapshot()).version).toBe(before.version);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole("button", { name: "Запустить смену" }).click();
  await expect(page.getByRole("list").getByText("Луна", { exact: true })).toBeVisible();
  const started = await snapshot();
  expect(started.template.cards).toHaveLength(1);
  expect(started.template.coverId).toBe(started.template.cards[0].imageId);
  const image = await request.get("/api/images/" + started.template.coverId);
  expect(image.headers()["content-type"]).toBe("image/webp");
  await page.getByRole("button", { name: "Карты", exact: true }).click();
  await page.getByRole("button", { name: /Лунная камера/ }).click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Название детали").fill("Камера ровера");
  await editor.getByRole("button", { name: "Сохранить деталь" }).click();
  await page.getByRole("button", { name: /Камера ровера/ }).click();
  await editor.getByRole("button", { name: "Удалить деталь" }).click();
  await editor.getByRole("button", { name: "Подтвердить удаление детали" }).click();
  await expect(editor).not.toBeVisible();
  expect((await snapshot()).template.cards).toHaveLength(0);
});
