import { expect, test } from "@playwright/test";

const ARTIFACT_DIR = "/Users/renat/.gemini/antigravity/brain/dc90e454-4407-4d8e-84e6-2cd2bd5d1a2a";

test.describe("STEM Bot Field Atlas + Engine 3.0 full lifecycle", () => {
  test("runs Shift Creator Wizard, Field Atlas onboarding, P2P market, live auction, advisor and 16:9 projector", async ({
    browser,
  }) => {
    const adminCtx = await browser.newContext({
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 2,
    });
    const adminPage = await adminCtx.newPage();

    const pageErrors: string[] = [];
    adminPage.on("pageerror", (err) => pageErrors.push(err.message));

    await adminPage.goto("/?as=1:%D0%92%D0%B5%D0%B4%D1%83%D1%89%D0%B8%D0%B9&surface=admin");
    await expect(adminPage.getByText("Студия ведущего")).toBeVisible();

    await adminPage.getByLabel("Действия смены").click();
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
    await adminPage.getByText("Расширенные критерии, таймеры и ручной ход по треку").click();
    await adminPage.getByRole("button", { name: "Все команды" }).click();
    const criterionButtons = adminPage.locator("button").filter({ hasText: "+2" });
    await criterionButtons.nth(0).click();
    await criterionButtons.nth(1).click();
    await criterionButtons.nth(2).click();
    await criterionButtons.nth(3).click();
    await adminPage.getByRole("button", { name: /Начислить 8/ }).click();
    await adminPage.getByRole("button", { name: "Открыть мастерскую (15 мин)" }).click();

    const aliceCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const alicePage = await aliceCtx.newPage();
    alicePage.on("pageerror", (err) => pageErrors.push(err.message));

    await alicePage.goto(`/?as=101:%D0%90%D0%BB%D0%B8%D1%81%D0%B0&join=${codeA}`);
    await alicePage.getByRole("button", { name: "Присоединиться к команде" }).click();

    await expect(alicePage.getByRole("button", { name: "Посмотреть детали" })).toBeVisible();
    await alicePage.screenshot({ path: `${ARTIFACT_DIR}/atlas_prod_onboarding.png` });
    await alicePage.getByRole("button", { name: "Посмотреть детали" }).click();
    await alicePage.screenshot({ path: `${ARTIFACT_DIR}/atlas_prod_onboarding_part.png` });
    await alicePage.getByRole("button", { name: "Как сделать ход" }).click();
    await alicePage.getByRole("button", { name: "К моей команде" }).click();

    const loreAcceptBtn = alicePage.getByRole("button", { name: "Принято" });
    if (await loreAcceptBtn.isVisible()) {
      await loreAcceptBtn.click();
    }

    await expect(alicePage.getByText("Ангар сборки")).toBeVisible();
    await alicePage.screenshot({ path: `${ARTIFACT_DIR}/atlas_prod_hangar_light.png` });

    await alicePage.getByRole("button", { name: "Настройки отображения" }).click();
    await alicePage.getByRole("button", { name: /Тёмная/ }).click();
    const metaContent = await alicePage.locator('meta[name="color-scheme"]').getAttribute("content");
    expect(metaContent).toBe("dark");
    await alicePage.getByRole("switch", { name: "Высокая контрастность" }).click();
    await expect(alicePage.locator("html")).toHaveAttribute("data-contrast", "high");
    await alicePage.getByRole("button", { name: "Закрыть", exact: true }).click();
    await alicePage.screenshot({ path: `${ARTIFACT_DIR}/atlas_prod_hangar_dark.png` });

    const bobCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const bobPage = await bobCtx.newPage();
    bobPage.on("pageerror", (err) => pageErrors.push(err.message));

    await bobPage.goto(`/?as=102:%D0%91%D0%BE%D0%B1&join=${codeA}`);
    await bobPage.getByRole("button", { name: "Присоединиться к команде" }).click();
    await bobPage.getByRole("button", { name: "Пропустить" }).click();
    const bobLoreBtn = bobPage.getByRole("button", { name: "Принято" });
    if (await bobLoreBtn.isVisible()) await bobLoreBtn.click();

    await bobPage
      .getByRole("navigation", { name: "Нижняя панель игрока" })
      .getByRole("button", { name: "Магазин" })
      .click();
    await bobPage.getByText("Титановый дальномер").first().click();
    await bobPage.getByRole("button", { name: /Предложить/ }).click();

    await alicePage.reload();
    await expect(alicePage.getByText("Команда предлагает")).toBeVisible();
    await alicePage.getByRole("button", { name: "Купить", exact: true }).first().click();

    await alicePage.locator(".slot-list button", { hasText: "Титановый дальномер" }).click();
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

    await kiraPage
      .getByRole("navigation", { name: "Нижняя панель игрока" })
      .getByRole("button", { name: "Магазин" })
      .click();
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
    await adminPage.getByRole("button", { name: "Перейти к ходу на поле" }).click();
    await expect(adminPage.getByRole("heading", { name: "Клетки с физического поля" })).toBeVisible();
    const cellSelects = adminPage
      .locator("section")
      .filter({ has: adminPage.getByRole("heading", { name: "Клетки с физического поля" }) })
      .last()
      .getByRole("combobox");
    const teamSelectCount = await cellSelects.count();
    for (let i = 0; i < teamSelectCount; i++) {
      await cellSelects.nth(i).selectOption(String(i + 3));
    }
    await adminPage.getByRole("button", { name: "Применить ход по треку" }).click();

    await kiraPage.getByRole("button", { name: "Поле и правила" }).click();
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

  test("runs Engine 3.0 Constructor, Undo batch reward, 5-phone Program + Reveal + Counterfactual, STEM Diagnosis and 3-min Playground", async ({
    browser,
  }) => {
    const pageErrors: string[] = [];

    const adminCtx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 2,
    });
    const adminPage = await adminCtx.newPage();
    adminPage.on("pageerror", (err) => pageErrors.push(err.message));

    await adminPage.goto("/?as=1:%D0%92%D0%B5%D0%B4%D1%83%D1%89%D0%B8%D0%B9&surface=admin&mode=constructor");
    await expect(adminPage.getByRole("heading", { name: "Конструктор смены" })).toBeVisible();

    const objectInput = adminPage.getByLabel("Объект");
    await adminPage.getByRole("button", { name: "НейроФауна" }).click();
    await expect(objectInput).not.toHaveValue("Ровер");
    await adminPage.getByRole("button", { name: "Экспедиция Роверов" }).click();
    await expect(objectInput).toHaveValue("Ровер");
    await objectInput.fill("Атлас-Марсоход");
    await adminPage.getByRole("button", { name: "Сохранить словарь" }).click();
    await expect(adminPage.getByRole("heading", { name: "Атлас-Марсоход" })).toBeVisible();

    await adminPage.getByRole("button", { name: "2. Дни" }).click();
    await expect(adminPage.getByText("Контур нагрузки и перегрева")).toBeVisible();
    await adminPage.getByLabel("День 1").selectOption("mission");
    await adminPage.getByLabel("День 2").selectOption("diagnosis");

    await adminPage.getByRole("button", { name: "3. Каталог" }).click();
    await expect(adminPage.getByText(/Проверка двух стратегий/)).toBeVisible();
    await expect(adminPage.getByText("Короткий путь")).toBeVisible();
    await expect(adminPage.getByText("Дополнительный риск")).toBeVisible();
    await adminPage.screenshot({ path: `${ARTIFACT_DIR}/atlas_prod_constructor.png` });

    await adminPage.getByRole("button", { name: "4. Запуск" }).click();
    const qrCodes = adminPage.locator("span.select-all");
    await expect(qrCodes.first()).toBeVisible();
    const teamCode = (await qrCodes.first().innerText()).trim();
    expect(teamCode).toMatch(/^[A-Z0-9]{4,8}$/);

    await adminPage.getByRole("button", { name: "Пульт урока" }).click();
    const evalRegion = adminPage.getByRole("region", { name: "Таблица оценки команд" });
    await expect(evalRegion).toBeVisible();

    await evalRegion.getByLabel("Результат +2").check();
    await evalRegion.getByLabel("Замер +2").check();
    await adminPage.getByRole("button", { name: "Начислить отмеченным" }).click();

    const undoBtn = adminPage.getByRole("button", { name: "Отменить начисление" });
    await expect(undoBtn).toBeVisible();
    await undoBtn.click();
    await expect(undoBtn).toBeHidden();

    await evalRegion.getByLabel("Результат +2").check();
    await evalRegion.getByLabel("Замер +2").check();
    await adminPage.getByRole("button", { name: "Начислить отмеченным" }).click();
    await adminPage.screenshot({ path: `${ARTIFACT_DIR}/atlas_prod_live_admin.png` });

    await adminPage.getByRole("button", { name: "Открыть мастерскую (15 мин)" }).click();

    const crew1Ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const crew1Page = await crew1Ctx.newPage();
    crew1Page.on("pageerror", (err) => pageErrors.push(err.message));

    await crew1Page.goto(`/?as=301:%D0%9C%D0%B0%D0%BA%D1%81&join=${teamCode}`);
    await crew1Page.getByRole("button", { name: "Присоединиться к команде" }).click();
    await crew1Page.getByRole("button", { name: "Пропустить" }).click();
    const c1Lore = crew1Page.getByRole("button", { name: "Принято" });
    if (await c1Lore.isVisible()) await c1Lore.click();

    const crew2Ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const crew2Page = await crew2Ctx.newPage();
    crew2Page.on("pageerror", (err) => pageErrors.push(err.message));

    await crew2Page.goto(`/?as=302:%D0%9D%D0%B8%D0%BD%D0%B0&join=${teamCode}`);
    await crew2Page.getByRole("button", { name: "Присоединиться к команде" }).click();
    await crew2Page.getByRole("button", { name: "Пропустить" }).click();
    const c2Lore = crew2Page.getByRole("button", { name: "Принято" });
    if (await c2Lore.isVisible()) await c2Lore.click();

    const rulesJson = await crew1Page.evaluate(async () => {
      const r = await fetch("/api/rules", { headers: { "X-Dev-User": encodeURIComponent("301:Макс") } });
      return r.text();
    });
    expect(rulesJson).not.toContain("secretHypothesisId");

    await adminPage.getByRole("button", { name: "Запустить программу экипажей (2:00)" }).click();
    await expect(adminPage.getByRole("button", { name: "+30 сек" })).toBeVisible();

    const projectorCtx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
    });
    const projectorPage = await projectorCtx.newPage();
    projectorPage.on("pageerror", (err) => pageErrors.push(err.message));
    await projectorPage.goto("/?view=projector");
    await expect(projectorPage.getByText("Личный черновик")).toBeVisible();
    await expect(projectorPage.getByText("Переговоры пятёрки")).toBeVisible();

    await expect(crew1Page.getByText(/Ваш рычаг/)).toBeVisible();
    await crew1Page.getByRole("button", { name: /Пологий объезд/ }).click();
    await expect(crew1Page.getByText("Готовность пультов (1 из 5)")).toBeVisible();
    await crew1Page.screenshot({ path: `${ARTIFACT_DIR}/atlas_prod_player_program.png` });

    await expect(crew2Page.getByText(/Ваш рычаг/)).toBeVisible();
    await crew2Page.getByRole("button", { name: /Быстрый \(\+1 очк\.\)/ }).click();
    await expect(projectorPage.getByText(/Подтверждено: 2 из 5/)).toBeVisible();

    await projectorPage.screenshot({ path: `${ARTIFACT_DIR}/atlas_prod_projector.png` });

    await adminPage.getByRole("button", { name: /Вскрыть условие/ }).click();

    await expect(crew1Page.getByRole("region", { name: "Разбор и контрфактуал" })).toBeVisible();
    await expect(crew1Page.getByText("Валюта раунда: 0")).toBeVisible();
    await crew1Page.screenshot({ path: `${ARTIFACT_DIR}/atlas_prod_player_reveal.png` });

    await crew1Page.getByRole("button", { name: /Проверить резерв/ }).click();
    await expect(crew1Page.getByText("Симуляция одной правки (вне зачёта)")).toBeVisible();
    await crew1Page.getByRole("button", { name: "Сбросить" }).click();

    await crew1Page.getByPlaceholder(/Что замерите/).fill("Ток тягового мотора на подъёме 15°");
    await crew1Page.getByRole("button", { name: "Сохранить ответ команды" }).click();

    await expect(projectorPage.getByText(/Открытые инженерные вехи смены/)).toBeVisible();

    await adminPage.getByRole("button", { name: "Открыть День 2" }).click();
    await adminPage.getByRole("button", { name: "Открыть мастерскую (15 мин)" }).click();
    await adminPage.getByRole("button", { name: "Запустить раунд диагностики (3:00)" }).click();

    const c1LoreDay2 = crew1Page.getByRole("button", { name: "Принято" });
    if (await c1LoreDay2.isVisible()) await c1LoreDay2.click();

    await expect(crew1Page.getByText("1. Приборные замеры")).toBeVisible();
    await crew1Page.getByRole("button", { name: "Проверить" }).first().click();
    await expect(crew1Page.getByText(/Наблюдение:/)).toBeVisible();
    await crew1Page.screenshot({ path: `${ARTIFACT_DIR}/atlas_prod_player_diagnosis.png` });

    const nonEliminatedHyp = crew1Page
      .locator('section[aria-label] button[aria-pressed="false"]')
      .filter({ hasNotText: "Отсеяно" })
      .first();
    await nonEliminatedHyp.click();
    await crew1Page.getByRole("button", { name: "Зафиксировать диагноз команды" }).click();
    await expect(crew1Page.getByText(/Вердикт зафиксирован/)).toBeVisible();

    const c2LoreDay2 = crew2Page.getByRole("button", { name: "Принято" });
    if (await c2LoreDay2.isVisible()) await c2LoreDay2.click();

    await crew2Page.setViewportSize({ width: 1280, height: 860 });
    await crew2Page.screenshot({ path: `${ARTIFACT_DIR}/atlas_prod_spread_desktop.png` });
    await crew2Page.setViewportSize({ width: 390, height: 844 });
    await crew2Page.getByRole("button", { name: "Тренировка без зачёта" }).click();
    await expect(crew2Page.getByRole("heading", { name: "Тренировка без зачёта · 3 минуты" })).toBeVisible();
    await crew2Page.getByRole("button", { name: /Усилить .*B/ }).click();
    await expect(crew2Page.getByText(/Отлично! Правка увеличила результат/)).toBeVisible();
    await crew2Page.screenshot({ path: `${ARTIFACT_DIR}/atlas_prod_player_playground.png` });

    await crew2Page.getByRole("button", { name: "Диагностика за 2 замера" }).click();
    await crew2Page.getByRole("button", { name: "Замер" }).first().click();
    await crew2Page.getByRole("button", { name: "Закрыть", exact: true }).click();

    expect(pageErrors).toEqual([]);

    await adminCtx.close();
    await crew1Ctx.close();
    await crew2Ctx.close();
    await projectorCtx.close();
  });

  test("validates responsive geometry, zero AABB overlaps, zero horizontal overflow, and zero text arrows across 360px..1920px", async ({
    browser,
  }) => {
    const assertCleanGeometry = async (page: import("@playwright/test").Page, label: string) => {
      const report = await page.evaluate(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scrollW = document.documentElement.scrollWidth;
        const badArrows: string[] = [];
        for (const el of document.querySelectorAll("button, h1, h2, h3, summary")) {
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") continue;
          const txt = (el as HTMLElement).innerText?.trim() ?? "";
          if (/[→↗►✨]/u.test(txt)) {
            badArrows.push(txt.slice(0, 60));
          }
        }

        const dock = document.querySelector(".atlas-mobile-dock") as HTMLElement | null;
        const dockRect =
          dock && window.getComputedStyle(dock).display !== "none" ? dock.getBoundingClientRect() : null;
        const devBar = document.querySelector(".dev-inline-bar") as HTMLElement | null;
        const devRect =
          devBar && window.getComputedStyle(devBar).display !== "none"
            ? devBar.getBoundingClientRect()
            : null;

        const overlaps: string[] = [];
        const controls = Array.from(
          document.querySelectorAll(
            "button, input:not([type='checkbox']):not([type='range']), select, summary",
          ),
        ) as HTMLElement[];

        const visibleBoxes: Array<{ el: HTMLElement; rect: DOMRect; name: string }> = [];
        for (const el of controls) {
          const st = window.getComputedStyle(el);
          if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
          const name = (el.getAttribute("aria-label") || el.innerText || el.tagName).trim().slice(0, 32);
          visibleBoxes.push({ el, rect: r, name });

          if (devRect && !devBar?.contains(el)) {
            const ix = Math.min(r.right, devRect.right) - Math.max(r.left, devRect.left);
            const iy = Math.min(r.bottom, devRect.bottom) - Math.max(r.top, devRect.top);
            if (ix > 2 && iy > 2) overlaps.push(`devBar overlaps "${name}"`);
          }
        }

        for (let i = 0; i < visibleBoxes.length; i++) {
          for (let j = i + 1; j < visibleBoxes.length; j++) {
            const a = visibleBoxes[i];
            const b = visibleBoxes[j];
            if (!a || !b) continue;
            if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
            if (dock && dock.contains(a.el) !== dock.contains(b.el)) continue;
            const ix = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
            const iy = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
            if (ix > 3 && iy > 3) {
              overlaps.push(`"${a.name}" overlaps "${b.name}" (${Math.round(ix)}x${Math.round(iy)})`);
            }
          }
        }

        const blockedClicks: string[] = [];
        for (const item of visibleBoxes) {
          if (dock?.contains(item.el)) continue;
          if (dockRect && item.rect.bottom > dockRect.top) continue;
          const cx = item.rect.left + item.rect.width / 2;
          const cy = item.rect.top + item.rect.height / 2;
          if (cx < 2 || cy < 2 || cx > vw - 2 || cy > vh - 2) continue;
          const hit = document.elementFromPoint(cx, cy);
          if (hit && !item.el.contains(hit) && !hit.contains(item.el)) {
            blockedClicks.push(`"${item.name}" covered by <${hit.tagName.toLowerCase()}>`);
          }
        }

        let scrollReachable = true;
        if (dockRect) {
          const docHeight = document.documentElement.scrollHeight;
          const playerPadBottom = Number.parseFloat(
            window.getComputedStyle(document.querySelector(".atlas-player") ?? document.body).paddingBottom ||
              "0",
          );
          if (docHeight > vh && playerPadBottom < dockRect.height) {
            scrollReachable = false;
          }
        }

        return { vw, scrollW, badArrows, overlaps, blockedClicks, scrollReachable };
      });

      expect(report.scrollW, `${label}: horizontal overflow`).toBeLessThanOrEqual(report.vw + 1);
      expect(report.badArrows, `${label}: forbidden arrow/slop glyphs`).toEqual([]);
      expect(report.overlaps, `${label}: interactive control overlaps`).toEqual([]);
      expect(report.blockedClicks, `${label}: hit-test clickability`).toEqual([]);
      expect(report.scrollReachable, `${label}: bottom dock safe padding`).toBe(true);
    };

    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    await page.goto("/?as=1:%D0%92%D0%B5%D0%B4%D1%83%D1%89%D0%B8%D0%B9&surface=admin");
    await expect(page.getByText("Студия ведущего")).toBeVisible();
    await page.setViewportSize({ width: 320, height: 720 });
    await assertCleanGeometry(page, "admin-live-320");
    const scoring = page.getByRole("region", { name: "Таблица оценки команд" });
    if (!(await scoring.isVisible())) await page.locator(".atlas-grading > summary").click();
    await expect(scoring).toBeVisible();
    expect(await scoring.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 360, height: 780 });
    await assertCleanGeometry(page, "admin-live-360");
    await page.screenshot({ path: `${ARTIFACT_DIR}/atlas_v2_admin_mobile_360.png` });

    await page.getByRole("button", { name: "Конструктор смены" }).click();
    await assertCleanGeometry(page, "admin-constructor-360");

    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto("/?as=401:%D0%98%D0%BB%D1%8C%D1%8F");
    await expect(page.getByText("Быстрый вход в команду (стенд)")).toBeVisible();
    await assertCleanGeometry(page, "player-join-spread-1280");
    await page.screenshot({ path: `${ARTIFACT_DIR}/atlas_v2_join_spread_fixed.png` });

    await page.setViewportSize({ width: 360, height: 780 });
    await assertCleanGeometry(page, "player-join-360");
    await page.locator("form .grid.grid-cols-2 button").first().click();
    await assertCleanGeometry(page, "player-onboarding-360");
    await page.getByRole("button", { name: "Пропустить" }).click();

    await expect(page.getByText("Ангар сборки")).toBeVisible();
    await page.setViewportSize({ width: 320, height: 720 });
    await assertCleanGeometry(page, "player-team-320");
    await page.setViewportSize({ width: 360, height: 780 });
    await assertCleanGeometry(page, "player-hangar-360");
    await page.screenshot({ path: `${ARTIFACT_DIR}/atlas_v2_player_mobile_360.png` });

    await page
      .getByRole("navigation", { name: "Нижняя панель игрока" })
      .getByRole("button", { name: "Магазин" })
      .click();
    await assertCleanGeometry(page, "player-market-360");
    await page.screenshot({ path: `${ARTIFACT_DIR}/atlas_v2_market_mobile_360.png` });

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.getByRole("button", { name: "Команда", exact: true }).click();
    await assertCleanGeometry(page, "player-hangar-768");

    await page.setViewportSize({ width: 1280, height: 860 });
    await assertCleanGeometry(page, "player-spread-1280");

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/?view=projector");
    await expect(page.getByText("Прямой эфир событий")).toBeVisible();
    await assertCleanGeometry(page, "projector-1920");

    await ctx.close();
  });
});
