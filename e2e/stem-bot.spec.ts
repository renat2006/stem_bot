import { expect, test } from "@playwright/test";

test.describe("STEM Bot 2.0 full shift lifecycle", () => {
  test("runs Shift Creator Wizard, onboarding, P2P market, live auction, advisor and 16:9 projector", async ({
    browser,
  }) => {
    const adminCtx = await browser.newContext({ viewport: { width: 412, height: 915 } });
    const adminPage = await adminCtx.newPage();

    const pageErrors: string[] = [];
    adminPage.on("pageerror", (err) => pageErrors.push(err.message));

    await adminPage.goto("/?as=1:%D0%92%D0%B5%D0%B4%D1%83%D1%89%D0%B8%D0%B9&surface=admin");
    await expect(adminPage.getByText("Студия ведущего")).toBeVisible();

    await adminPage.getByRole("button", { name: "Новая смена" }).click();
    await expect(adminPage.getByText("Мастер запуска · шаг 1 из 4")).toBeVisible();
    await adminPage.getByRole("button", { name: "Дальше" }).click();
    await expect(adminPage.getByText("Биржа между командами")).toBeVisible();
    await adminPage.getByRole("button", { name: "Дальше" }).click();
    await adminPage.getByRole("button", { name: "Дальше" }).click();
    const teamInput = adminPage.locator('input[type="number"]');
    await teamInput.fill("3");
    await adminPage.getByRole("button", { name: "Запустить смену" }).click();

    const codeSpans = adminPage.locator("span.select-all");
    await expect(codeSpans).toHaveCount(3);
    const codeA = (await codeSpans.nth(0).innerText()).trim();
    const codeB = (await codeSpans.nth(1).innerText()).trim();
    expect(codeA).toMatch(/^[A-Z0-9]{4,8}$/);
    expect(codeB).toMatch(/^[A-Z0-9]{4,8}$/);

    await adminPage.getByRole("button", { name: "QR" }).first().click();
    await expect(adminPage.getByRole("heading", { name: /Вход в команду/ })).toBeVisible();
    await adminPage.getByRole("button", { name: "Закрыть окно" }).click();

    await adminPage.getByRole("button", { name: "Карты", exact: true }).click();
    await adminPage.getByRole("button", { name: "Новая", exact: true }).click();
    await adminPage.getByPlaceholder("Например: Плазменный гироскоп").fill("Титановый дальномер");
    await adminPage.getByRole("button", { name: "Сохранить деталь" }).click();
    await expect(adminPage.getByText("Титановый дальномер").first()).toBeVisible();

    await adminPage.getByRole("button", { name: "Сгенерировать черновик деталей" }).click();
    await expect(adminPage.getByText(/Черновик готов/)).toBeVisible();
    await adminPage.getByRole("button", { name: "Добавить к рынку" }).click();

    await adminPage.getByRole("button", { name: "Баланс", exact: true }).click();
    await expect(adminPage.getByText("Советник баланса и динамики")).toBeVisible();
    const p2pSwitch = adminPage.getByRole("switch", { name: "Биржа между командами" });
    await expect(p2pSwitch).toHaveAttribute("aria-checked", "true");
    await p2pSwitch.click();
    await expect(p2pSwitch).toHaveAttribute("aria-checked", "false");
    await p2pSwitch.click();
    await expect(p2pSwitch).toHaveAttribute("aria-checked", "true");

    await adminPage.getByRole("button", { name: "Раунд", exact: true }).click();
    await adminPage.getByRole("button", { name: "Все команды" }).click();
    const criterionButtons = adminPage.locator("button").filter({ hasText: "+2" });
    await criterionButtons.nth(0).click();
    await criterionButtons.nth(1).click();
    await criterionButtons.nth(2).click();
    await criterionButtons.nth(3).click();
    await adminPage.getByRole("button", { name: /Начислить 8/ }).click();
    await adminPage.getByRole("button", { name: "15 мин" }).click();

    const aliceCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const alicePage = await aliceCtx.newPage();
    alicePage.on("pageerror", (err) => pageErrors.push(err.message));

    await alicePage.goto(`/?as=101:%D0%90%D0%BB%D0%B8%D1%81%D0%B0&join=${codeA}`);
    await alicePage.getByRole("button", { name: "Присоединиться к команде" }).click();

    await expect(alicePage.getByRole("button", { name: "Дальше" })).toBeVisible();
    await alicePage.getByRole("button", { name: "Дальше" }).click();
    await alicePage.getByRole("button", { name: "Дальше" }).click();
    await alicePage.getByRole("button", { name: "В ангар" }).click();

    const loreAcceptBtn = alicePage.getByRole("button", { name: "Принято" });
    if (await loreAcceptBtn.isVisible()) {
      await loreAcceptBtn.click();
    }

    await expect(alicePage.getByText("Ангар сборки")).toBeVisible();

    await alicePage.getByRole("button", { name: "Настройки отображения" }).click();
    await alicePage.getByRole("button", { name: /Тёмная/ }).click();
    const metaContent = await alicePage.locator('meta[name="color-scheme"]').getAttribute("content");
    expect(metaContent).toBe("dark");
    await alicePage.getByRole("switch", { name: "Высокая контрастность" }).click();
    await expect(alicePage.locator("html")).toHaveAttribute("data-contrast", "high");
    await alicePage.getByRole("button", { name: "Закрыть", exact: true }).click();

    const bobCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const bobPage = await bobCtx.newPage();
    bobPage.on("pageerror", (err) => pageErrors.push(err.message));

    await bobPage.goto(`/?as=102:%D0%91%D0%BE%D0%B1&join=${codeA}`);
    await bobPage.getByRole("button", { name: "Присоединиться к команде" }).click();
    await bobPage.getByRole("button", { name: "Пропустить" }).click();
    const bobLoreBtn = bobPage.getByRole("button", { name: "Принято" });
    if (await bobLoreBtn.isVisible()) await bobLoreBtn.click();

    await bobPage.getByRole("button", { name: "Рынок", exact: true }).click();
    await bobPage.getByText("Титановый дальномер").first().click();
    await bobPage.getByRole("button", { name: /Предложить/ }).click();

    await alicePage.reload();
    await expect(alicePage.getByText("Команда предлагает")).toBeVisible();
    await alicePage.getByRole("button", { name: "Купить", exact: true }).first().click();

    await alicePage.getByText("Титановый дальномер").first().click();
    await alicePage.getByRole("button", { name: "Снять на склад" }).click();
    await alicePage.getByRole("button", { name: /Склад \(1\)/ }).click();
    await alicePage.getByRole("button", { name: "На биржу" }).click();
    await alicePage.getByRole("button", { name: /Выставить за/ }).click();

    const kiraCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const kiraPage = await kiraCtx.newPage();
    kiraPage.on("pageerror", (err) => pageErrors.push(err.message));

    await kiraPage.goto(`/?as=201:%D0%9A%D0%B8%D1%80%D0%B0&join=${codeB}`);
    await kiraPage.getByRole("button", { name: "Присоединиться к команде" }).click();
    await kiraPage.getByRole("button", { name: "Пропустить" }).click();
    const kiraLoreBtn = kiraPage.getByRole("button", { name: "Принято" });
    if (await kiraLoreBtn.isVisible()) await kiraLoreBtn.click();

    await kiraPage.getByRole("button", { name: "Рынок", exact: true }).click();
    await kiraPage.getByRole("button", { name: /^Биржа/ }).click();
    await kiraPage.getByRole("button", { name: "Осмотреть" }).first().click();
    await kiraPage.getByRole("button", { name: /Купить за/ }).click();

    await adminPage.getByRole("button", { name: "Карты", exact: true }).click();
    await adminPage.getByLabel(/Старт \(/).fill("2");
    await adminPage.getByRole("button", { name: "Запустить торг" }).click();
    await expect(adminPage.getByText(/Идёт торг:/)).toBeVisible();

    await kiraPage.getByRole("button", { name: /^Аукцион/ }).click();
    await expect(kiraPage.getByText("Открытый торг")).toBeVisible();
    await kiraPage.getByRole("button", { name: /Поставить/ }).click();
    await expect(kiraPage.getByText("Лидирует ваша команда")).toBeVisible();

    await adminPage.getByRole("button", { name: "Завершить лот" }).click();

    await adminPage.getByRole("button", { name: "Раунд", exact: true }).click();
    await adminPage.getByRole("button", { name: "Закрыть рынок → ход" }).click();
    await adminPage.getByRole("button", { name: "Применить шаг по треку ко всем командам" }).click();
    await adminPage.getByRole("button", { name: "Подтвердить: сдвинуть все команды" }).click();

    await kiraPage.getByRole("button", { name: "Маршрут и FAQ" }).click();
    await expect(kiraPage.getByText("Справочник механик (FAQ)")).toBeVisible();

    const projectorCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const projectorPage = await projectorCtx.newPage();
    projectorPage.on("pageerror", (err) => pageErrors.push(err.message));

    await projectorPage.goto("/?view=projector");
    await expect(projectorPage.getByText("Прямой эфир событий")).toBeVisible();

    expect(pageErrors).toEqual([]);

    await adminCtx.close();
    await aliceCtx.close();
    await bobCtx.close();
    await kiraCtx.close();
    await projectorCtx.close();
  });
});
