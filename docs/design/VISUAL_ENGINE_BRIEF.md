# ТЗ для Codex: визуальный движок сборки, арт-паки и стиль «Стикерная лаборатория»

> Исполнитель — Codex (с генерацией изображений gpt-image). Репозиторий `stem_bot`. Сначала прочитай `AGENTS.md`, `docs/PROJECT_STATE.md`, `docs/design/VISUAL_RESEARCH.md`, `docs/design/COMPONENTS.md`, `packages/shared/src/{schema,presets,engine}.ts`.
> Правила репозитория обязательны: FSD (`npm run lint` → steiger), Biome, без комментариев в коде, тесты на логику, Conventional Commits без AI-водяных знаков, ветка `feat/visual-engine` от `dev`, PR в `dev`.

---

## 0. Цель

Дать приложению характер и визуальную радость: команда видит **своё существо** (дирижабль, компанию — в зависимости от темы), которое меняется с каждой покупкой. Сделать это **частью SDK**: любая тема получает графику из данных шаблона — автоматически сгенерированный арт-пак, а если арта нет — процедурную отрисовку. Ничего не хардкодится под НейроФауну.

Результат:
1. Пакет `@stem/art`: схема арт-пака, риги объектов, процедурный fallback, генератор промптов, CLI конвейера ассетов.
2. Движок отрисовки в Mini App: сцена сборки, детали-стикеры, тиры, анимации, примерка, экспорт карточки.
3. Три арт-пака (НейроФауна, АэроТех, Стартап) + кастомный набор UI-иконок.
4. Интеграция во все экраны: главная, рынок, предложения, трек, пульт ведущего.

---

## 1. Стиль: «Стикерная лаборатория»

### 1.1 Идея
Физическая игра — это наклейки частей тела на планшете существа. Цифровая версия продолжает этот язык: **каждая деталь — вырезанный стикер** с белой обводкой и мягкой тенью, наклеенный на «полевой лист» лаборатории (миллиметровка, бирки, подписи моно-шрифтом, измерительные засечки). Научная иллюстрация + коллекционные стикеры. Характер — уверенный, чуть дерзкий, «крутая лаборатория», а не детсад.

### 1.2 Правила рисования (для всех ассетов)
- Плоская векторная иллюстрация, **уверенный тёмный контур** одинаковой толщины: 6 px на холсте 1024 (≈ 3 px на 512).
- **Cel-shading в 2–3 тона**: основной цвет, тень (снизу-справа), один блик (сверху-слева). Без градиентов-«мыла», без фотореализма, без 3D-рендера.
- Свет всегда **сверху-слева**. Ракурс деталей существа и дирижабля — **строго сбоку, объект смотрит вправо**. Стартап — **изометрия 30°**, свет сверху-слева.
- Пропорции чуть преувеличены и «коренасты», силуэт читается в 48 px.
- **Без текста, букв, цифр, логотипов, водяных знаков, рамок и фона** внутри изображения.
- Не подражать узнаваемым франшизам, брендам и конкретным художникам. Без крови, ран, пугающего натурализма — аудитория от 14 лет.
- Обводка-«вырезка» стикера, тень, зерно, голографический отлив — **накладываются в приложении CSS-ом**, а не рисуются в ассете (так ассеты остаются чистыми и переиспользуемыми).

### 1.3 Язык статов в форме (геймдизайн)
Деталь должна визуально «говорить», что она даёт:

| Характеристика (любой темы) | Мотив формы |
| :--- | :--- |
| Скорость / Аэродинамика / Рост | обтекаемость, вытянутость, плавники, «стрелы», наклон вперёд |
| Сила / Инновации | масса, шипы, челюсти, клешни, острые углы |
| Выживание / Надёжность / Устойчивость | пластины, панцирь, чешуя, заклёпки, щиты |
| Отрицательный стат | заметная слабость: тонкая кожа, хрупкие суставы, открытые места |

Доминирующий положительный стат берётся из `card.stats` (максимум), слабость — из минимального отрицательного. Эти мотивы автоматически попадают в промпт (см. §5.3).

### 1.4 Эскалация тира (материал, не только рамка)
| Тир | Название | В арте | В приложении (CSS) |
| :---: | :--- | :--- | :--- |
| I | Базовая | простая форма, минимум деталей | обычный стикер |
| II | Усиленная | дополнительные детали, текстура меха/кожи | — |
| III | Продвинутая | броня, орнамент, ремни/клёпки | тонкая цветная обводка тира |
| IV | Элитная | металл, светящиеся акценты | мягкое свечение акцентом темы |
| V | Легендарная | энергия, кристаллы, сияние | анимированный голографический отлив (выключается при reduced-motion / Android LOW) |

Тир всегда дублируется `TierBars` + римской цифрой (информация не только цветом).

### 1.5 Палитры (зафиксировать в манифестах, проверять скриптом)
Хромакей `#FF00FF` **запрещён во всех палитрах** — он служит фоном генерации.

- **НейроФауна — «Полевой бестиарий»**: контур `#1B1F23`; бумага `#F3EEE3`; мох `#5E8C4A`; песок `#D9B26F`; ржавчина `#B8573A`; бирюза `#2F7F86`; кость `#EDE3CF`; слива `#6B4A6E`; биолюминесценция (тиры IV–V) `#7CF29A`.
- **АэроТех — «Ателье чертежей»**: контур `#14202B`; синька `#1F4E79`; холст `#E9EEF2`; латунь `#C8963E`; медь `#B5653A`; сигнальный оранжевый `#FF7A1A`; свечение `#5EE6FF`.
- **Стартап — «Диорама питча»**: контур `#1A1A2E`; бумага `#F5F3FF`; фиолетовый `#6C4CF5`; мята `#3DD6A0`; коралл `#FF6B6B`; солнце `#FFC93C`; свечение `#B7A8FF`.

Цвета характеристик в UI остаются из `docs/design/tokens.json` (оранжевая Скорость, красная Сила, синее Выживание и т. д.) — в арте они используются как акцент детали с доминирующим статом.

### 1.6 Сцена и подложка
Подложка сцены — «полевой лист»: миллиметровка (CSS), угловые засечки, бирка с названием вида и номером команды (моно-шрифт), под объектом — мягкая эллиптическая тень. Светлая и тёмная тема Telegram: в тёмной лист — графитовая «доска» с голубой сеткой, стикеры сохраняют белую обводку.

---

## 2. Архитектура в SDK

```
packages/art/                         @stem/art (новый workspace)
  src/schema.ts                       Zod: ArtPack, Rig, PartAsset, IconSet …
  src/rigs/{creature,airship,campus}.ts   риги объектов (геометрия слотов)
  src/procedural/                     SVG-fallback: силуэт рига, детали по слоту, эмблемы команд
  src/prompts/                        построитель промптов из GameTemplate + стиль-библии
  src/species-name.ts                 имя вида из деталей
  src/index.ts                        публичное API
  scripts/                            CLI: art:prompts · art:ingest · art:validate · art:sheet
  packs/<packId>/manifest.json        манифест арт-пака (коммитится)
  packs/<packId>/assets/*.webp        оптимизированные ассеты (коммитятся, лимиты в §6)
  packs/<packId>/masters/             исходники генерации (gitignore)
  icons/*.svg                         UI-иконки (ручные SVG, §7)
```

### 2.1 Связь с шаблоном
`packages/shared/src/schema.ts` → в `GameTemplateSchema` добавить:
```ts
artPackId: z.string().optional(),
objectRig: z.enum(["creature", "airship", "campus"]).default("creature"),
```
Пресеты: `neurofauna-classic → artPackId "neurofauna", objectRig "creature"`; `neuro-airship-stem → "airship"/"airship"`; `startup-in-a-day → "startup"/"campus"`. Карта находит свой ассет по `card.id`; нет ассета — процедурная деталь. Слот находит сокет по `slot.id`; нет сокета в риге — слот раскладывается на «полке» под сценой (не падать).

### 2.2 Контракт (обязательный)
```ts
export const SlotSocketSchema = z.object({
  slotId: z.string(),                       // совпадает с template.slots[].id
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]), // x, y, w, h в системе рига 1000×1000
  align: z.enum(["center", "bottom", "top", "left", "right"]),     // как вписать деталь в коробку
  z: z.number().int(),                      // порядок слоёв (больше — ближе)
  motion: z.enum(["none", "bob", "sway", "pulse", "flap"]).default("none"),
  pivot: z.tuple([z.number(), z.number()]).default([0.5, 0.5]),    // центр вращения для motion, доля коробки
  mirror: z.boolean().default(false),
});

export const RigSchema = z.object({
  id: z.enum(["creature", "airship", "campus"]),
  viewBox: z.literal("0 0 1000 1000"),
  ghostPath: z.string(),                    // SVG-силуэт пустого объекта (процедурный «скелет»)
  sockets: z.array(SlotSocketSchema),
  shadow: z.object({ cx: z.number(), cy: z.number(), rx: z.number(), ry: z.number() }),
});

export const PartAssetSchema = z.object({
  cardId: z.string(),
  src: z.string(),                          // относительный путь в паке, имя с контент-хешем
  thumb: z.string(),                        // 256 px
  width: z.number(), height: z.number(),
  promptId: z.string(),                     // ссылка на запись в prompts.jsonl
});

export const ArtPackSchema = z.object({
  id: z.string(),
  version: z.number().int(),
  rig: RigSchema.shape.id,
  palette: z.record(z.string(), z.string().regex(/^#[0-9A-F]{6}$/i)),
  rigOverrides: z.array(SlotSocketSchema.partial().required({ slotId: true })).default([]),
  parts: z.array(PartAssetSchema),
  perks: z.record(z.string(), z.string()),  // perkId → эмблема
  stats: z.record(z.string(), z.string()),  // statId → иллюстрированная иконка
  currency: z.string(),
  cells: z.record(z.string(), z.string()),  // тип клетки поля → иконка
  covers: z.object({ hero: z.string(), story: z.string() }).partial(),
  emptyStates: z.record(z.enum(["noTeam", "waiting", "marketClosed", "summary"]), z.string()).partial(),
});
```
Валидация: `art:validate` сверяет манифест с шаблоном (все ли `card.id`, `perk.id`, `stat.id`, типы клеток покрыты; файлы существуют; размеры и вес в лимитах; палитра без `#FF00FF`).

### 2.3 Риги (стартовые координаты, уточнить визуально)
Система координат 1000×1000, объект смотрит вправо.

**creature** (четвероногое существо): `body` [250,380,500,260] center z2 motion `bob` · `head` [640,200,300,320] left z4 `bob` · `front` [560,560,220,340] top z3 · `back` [260,560,220,340] top z1 · `tail` [40,330,290,290] right z1 `sway` pivot [1,0.5] · `special` [360,170,320,250] bottom z5 `pulse`. Тень: cx 500, cy 905, rx 330, ry 38.
**airship**: `envelope` [90,70,820,450] center z2 `bob` · `gondola` [330,560,340,200] top z3 · `propulsion` [20,280,250,260] right z4 `pulse` · `stabilizer` [40,100,260,300] right z1 · `bci` [610,600,200,160] center z5 · `telemetry` [470,760,140,200] top z1 `sway`.
**campus** (изометрическая диорама на плите): плита — процедурная; `prod` (крыша) [330,90,340,300] z5 · `team` (левое крыло) [90,330,330,330] z3 · `mkt` (фасад, щит) [380,520,300,300] z4 · `fin` (правое крыло, хранилище) [600,330,330,330] z3 · `tech` (башня позади) [420,180,200,330] z1 `pulse`.

Детали AI вписываются в коробку слота (`object-fit: contain` + выравнивание `align`); стык прячется под соседним слоем с большим `z`. Пиксельная точность креплений не требуется — это сознательное решение под AI-арт.

---

## 3. Движок отрисовки (apps/web)

FSD-размещение:
```
entities/assembly/            AssemblyStage, PartSticker, useArtPack, lib/compose.ts
features/share-specimen/      экспорт карточки существа (Canvas → PNG) + Telegram share
widgets/slot-build/           переписать: сцена вместо текстовых плиток, плитки — легенда под сценой
shared/ui/icon/               <Icon name> из SVG-спрайта
```

### 3.1 `AssemblyStage`
Пропсы: `template`, `equipped: Record<slotId, cardId|null>`, `size` ("hero" 100% ширины / "card" 160 / "token" 40), `preview?: { slotId, cardId }`, `interactive`, `onSlotTap(slotId)`.
- Подложка «полевой лист» (CSS), процедурный `ghostPath` рига (тонкий пунктир), тень.
- Слои — абсолютное позиционирование в % от коробок рига; `<img decoding="async">` для деталей из пака, inline SVG для процедурных.
- Пустой сокет: пульсирующий «+» в коробке слота (`interactive`), тап → `onSlotTap`.
- `preview`: деталь-кандидат поверх текущей с прозрачностью 0.85 и пунктирной обводкой; заменяемая деталь тускнеет — «примерка» в листе карты рынка.
- Анимации — **один общий CSS-таймлайн** (одна длительность цикла на сцену, фазы через `animation-delay`), только `transform`/`opacity`. `bob` ±1.5 %, `sway` ±6°, `pulse` scale 1→1.04, `flap` ±10°. Выключать при `prefers-reduced-motion` и на Android LOW (`useAndroidDeviceData().performanceClass`).
- Установка детали: при смене `equipped[slot]` новая деталь «падает» в сокет (translateY −30 % → 0, scale 1.15 → 1, 280 мс, easing back-out) + `hapticFeedback.impactOccurred("medium")`; старая — уезжает вниз с fade.
- Доступность: `role="img"`, `aria-label` = «Существо команды „Альфа“: голова льва, туловище акулы, …; пустые: хвост».

### 3.2 `PartSticker`
Деталь как стикер: `filter: drop-shadow(0 0 0 3px #fff) drop-shadow(0 4px 6px rgba(0,0,0,.18))` (или два слоя: белая подложка-маска + деталь — выбрать то, что быстрее на Android; drop-shadow на больших изображениях может быть дорогим — измерить). Тиры IV–V: свечение акцентом; V — голографический отлив: псевдоэлемент с `linear-gradient` и `mask-image` по самому изображению, анимация `background-position` 6 с.

### 3.3 Загрузка и кеш
- `useArtPack(packId)`: ленивый `import()` манифеста (JSON из `@stem/art`), кеш в памяти; предзагрузка ассетов надетых деталей (`<link rel="preload" as="image">` для hero), миниатюры рынка — `loading="lazy"`.
- Ассеты раздаются как статика `/art/<packId>/<file>`: Vite-плагин в `apps/web` копирует `packages/art/packs/*/assets` в `dist/art/` и отдаёт их в dev. Имена с контент-хешем → `Cache-Control: immutable` (правило Caddy для `/art/*` добавить в `deploy/caddy/stem-bot.caddy.tmpl`).
- Нет пака / нет ассета / ошибка загрузки → процедурная деталь, без падения UI.

### 3.4 Процедурный fallback (`@stem/art/procedural`)
Чистые функции → SVG-строка, детерминированно от `card.id`:
- форма детали по слоту (набор 3–4 параметрических силуэтов на слот: голова — овал/клин/рогатая; лапы — колонна/суставчатая; хвост — дуга/плавник…), выбор и пропорции — из хеша `card.id`;
- цвет — из палитры пака по хешу семейства (первая часть `card.id`: `lion`, `shark`…), акцент — цвет доминирующего стата;
- мотив стата — шипы/пластины/плавники добавляются по правилу §1.3;
- тир — число деталей-«украшений».
Это обязательный базовый слой: новая тема без арта выглядит цельно с первой минуты.

### 3.5 Где показывать
| Экран | Что |
| :--- | :--- |
| Главная (`widgets/slot-build`) | `AssemblyStage size="hero"` над легендой слотов; бирка «вид: <имя вида>», шаг, тир-счётчик |
| Рынок (`widgets/shop`) | миниатюра `PartSticker` 64 px в карточке; в листе карты — мини-сцена с `preview` («Примерить») |
| Входящие предложения (`widgets/proposals-inbox`) | миниатюра детали + мини-сцена «как станет» |
| Трек (`pages/team-dashboard/ui/track-screen`) | жетон `size="token"` вместо точки команды |
| Пульт ведущего (`widgets/teams-board`) | `size="card"` у каждой команды |
| Вход / онбординг (`pages/join`) | обложка темы `covers.hero`; шаг онбординга про слоты — анимированная установка детали |
| Пустые состояния | `emptyStates.*` |
| Экспорт (`features/share-specimen`) | карточка 1080×1350: сцена, имя вида, команда, статы с глифами, день смены → `shareMessage`/скачивание |

---

## 4. Набор ассетов

| Группа | Кол-во (сейчас) | Формат | Размер холста | Примечание |
| :--- | :---: | :--- | :--- | :--- |
| Эталон стиля темы (style anchor) | 3 | PNG | 1536×1024 | лист из 6 деталей разных слотов + палитра; **утверждает человек** |
| Детали карт | 21 + 12 + 10 | WebP + thumb | 1024 мастер → 512 + 256 | по одной на `card.id` |
| Эмблемы свойств | 3 + 2 + 2 | WebP | 512 → 256 | круглый значок-медальон |
| Иконки характеристик (иллюстрированные) | 9 | WebP | 256 | форма перекликается с глифом стата (`tri/sq/hex/up/dia`) |
| Валюта | 3 | WebP | 256 | ДНК-жетон, энергоячейка, кредит |
| Клетки поля событий | 6 типов × 3 темы | WebP | 256 | старт, мутация, ресурс, испытание, катастрофа, хищник/вершина |
| Обложки темы | 2 × 3 | WebP | 1200×630, 1080×1920 | герой и сторис |
| Пустые состояния | 4 × 3 | WebP | 768×512 | нет команды, ждём фазу, рынок закрыт, итоги |
| UI-иконки | ~32 | SVG | 24 | рисуются кодом, не генерацией (§7) |

Полная НейроФауна (78 карт из `docs/legacy/neurofauna-data.json`) — после согласования (отдельная задача), конвейер должен это выдерживать без изменений кода.

---

## 5. Конвейер генерации

### 5.1 Шаги
1. `npm run art:prompts -w @stem/art -- --template <templateId>` → `packs/<packId>/prompts.jsonl` (по строке на ассет: `id`, `kind`, `prompt`, `negative`, `size`, `background`, `referenceIds`).
2. **Эталон стиля** (`kind: "anchor"`) генерируется первым. **Остановиться и показать человеку** контактный лист эталонов всех трёх тем — продолжать только после утверждения.
3. Детали и остальные ассеты генерируются **с утверждённым эталоном в качестве референс-изображения**, по одному ассету на вызов (не сетками), фон — сплошной `#FF00FF`.
4. Мастер сохраняется в `packs/<packId>/masters/<id>.png`.
5. `npm run art:ingest -w @stem/art -- --pack <packId>`: хромакей-вырезка `#FF00FF` с допуском и сглаживанием края → проверка альфы (≥ 25 % прозрачных пикселей, объект не касается краёв) → обрезка по альфе → вписывание в квадрат с полями 6 % → WebP 512 (q 82) и 256 (q 78) → контент-хеш в имени → обновление `manifest.json`. Библиотека — `sharp` (devDependency пакета).
6. `npm run art:sheet -w @stem/art -- --pack <packId>` → `packs/<packId>/contact-sheet.html`: все детали на светлом и тёмном фоне, сцены 5 случайных сборок, проверки (нет ассета, превышение веса, отклонение палитры). **Показать человеку перед PR.**
7. `npm run art:validate -w @stem/art` — в CI (`npm run lint` или отдельным шагом): полнота манифеста против шаблона, лимиты, палитра.

Перегенерация одного ассета: `art:prompts --only <cardId>` → генерация → `art:ingest --only <cardId>`.

### 5.2 Стиль-библия (префикс каждого промпта, английский)
```
Sticker-style flat vector illustration for a science lab collectible, single isolated object,
bold confident dark outline of uniform weight, 2-3 tone cel shading, light from top-left,
crisp shapes readable at small size, slightly exaggerated chunky proportions, playful but cool tone for teenagers,
no text, no letters, no numbers, no logos, no frame, no border, no scenery, no ground, no drop shadow,
centered with generous empty margin, plain solid #FF00FF background, consistent with the reference image style.
Palette strictly limited to: {palette hex list}.
```
Негатив (добавлять текстом): `photorealistic, 3D render, gradient mesh, blur, noise, watermark, signature, text, extra limbs, multiple objects, gore, blood, scary, horror, background details, magenta in the object`.

### 5.3 Промпт детали (собирается кодом из данных)
```
{style prefix}
Object: {partNoun} of a {family} — a modular body part for a chimera creature builder, slot "{slotLabel}".
View: strict side view, the creature would face right. {attachRule}
Tier {tierRoman} "{tierName}": {tierDetail}.
Design language: emphasizes {dominantStat} → {dominantMotif}; visible weakness: {weakMotif}.
Accent color: {statAccentHex} used sparingly on {accentPlace}.
```
- `family`, `partNoun` — из `card.name` («Голова льва» → «lion», «head»); для небиологических тем — существительное устройства («mylar balloon envelope», «carbon fiber gondola», «server tower»).
- `attachRule` по слоту (creature): head — «neck joint on the lower-left edge, cut softly so it can tuck under the body»; body — «torso only, no head, no legs, no tail, joints left open»; front/back — «a pair of legs seen from the side, hip joint at the top edge»; tail — «tail base on the right edge, extending to the left»; special — «a back/dorsal feature (mane, shell, horn, fin) with a flat base at the bottom edge». Для airship/campus — аналогичная таблица в коде риг-специфичная.
- `tierDetail` — из таблицы §1.4; `dominantMotif`/`weakMotif` — из §1.3.

Пример готового промпта (Голова льва, тир II, +2 Сила / −1 Выживание):
```
… Object: head of a lion — a modular body part for a chimera creature builder, slot "Голова".
View: strict side view, the creature would face right. Neck joint on the lower-left edge, cut softly so it can tuck under the body.
Tier II "Усиленная": extra detail, textured mane strands, confident expression.
Design language: emphasizes Strength → massive jaw, visible fangs, angular brow; visible weakness: Survival → thin exposed ears, no armor.
Accent color: #C9422F used sparingly on the eyes and nose.
```

### 5.4 Прочие промпты
- **Эмблема свойства**: «round medallion badge, emblem of {perk concept}, symmetrical, {palette}».
- **Иконка характеристики**: «small emblem for the stat {stat}, built around a {shape} silhouette ({tri: forward-pointing triangle, sq: square, hex: hexagon, up: upward triangle, dia: diamond})».
- **Валюта**: НейроФауна — «DNA helix token coin»; АэроТех — «glowing energy cell canister»; Стартап — «faceted credit chip coin».
- **Клетки поля**: «tile icon for the board event {type}: resource → stacked supplies, mutation → swirling helix, challenge/hunt → paw strike, catastrophe → cracked earth with lightning, apex/predator → looming shadow eyes (not scary), start → flag».
- **Обложки/пустые состояния**: те же правила, но с фоном-«полевым листом» (миллиметровка, бирки без читаемого текста), без `#FF00FF`.

---

## 6. Лимиты и производительность
- Деталь: WebP 512 ≤ 35 КБ, 256 ≤ 12 КБ. Иконки 256 ≤ 10 КБ. Обложки ≤ 120 КБ. Пак целиком ≤ 3 МБ.
- Первая отрисовка главной: манифест + надетые детали + иконки ≤ 600 КБ.
- Анимации только `transform`/`opacity`; голографический отлив и idle-анимации выключаются на Android LOW и при `prefers-reduced-motion`.
- Проверить на 375 px, светлая/тёмная тема, медленная сеть (DevTools throttling «Slow 4G»): сцена видна сразу (процедурный слой), арт догружается без скачков вёрстки (фиксированные коробки).

---

## 7. UI-иконки (SVG, рисуются кодом)
Сетка 24, живая зона 20, штрих 2 px, скругления 2, концы скруглённые; «дуотон»: контур `currentColor` + одна заливка-пятно `var(--icon-accent)` с opacity .25. Единый силуэтный язык с «лабораторией» (колбы, бирки, засечки) там, где уместно.

Набор: `market` (прилавок-тент), `team` (две фигуры), `track` (спираль/трасса с флажком), `rules` (раскрытая книга-журнал), `phase-scoring` (чек-лист), `phase-market` (тент с монетой), `phase-turn` (кубик со стрелкой), `phase-summary` (кубок), `timer`, `lock`, `undo`, `propose` (рука с карточкой), `captain` (корона-бирка), `member`, `check`, `warning`, `info`, `share`, `settings`, `reward` (монета с плюсом), `plus`, `minus`, `feed` (лента), `trophy`, `flag`, `dice`, `map`, `bell`, `qr`, `link`, `copy`, `close`, `back`, `species` (колба), `try-on` (силуэт с плюсом).

Сборка: `icons/*.svg` → один спрайт `/art/icons.svg` (`<symbol id="i-…">`), компонент `<Icon name size label?>` в `shared/ui/icon`. Заменить эмодзи и буквенные пиктограммы в интерфейсе (табы, фазы, кнопки пульта, тосты).

---

## 8. Экспорт карточки существа (`features/share-specimen`)
Canvas 1080×1350: «полевой лист», сцена в высоком разрешении (ассеты 512), бирка: имя вида (`speciesName(parts)`), команда, день смены, три стата с глифами и значениями, тиры деталей точками. Выгрузка — `shareMessage` (если доступен через подготовленное сообщение бота) или `downloadFile`/`navigator.share`, иначе скачивание PNG. Кнопка «Поделиться видом» на главной и в итогах дня.

`speciesName`: НейроФауна — склейка корней семейств головы+туловища+хвоста («лев»+«акула»+«скорпион» → «Львакулоскорп»), правила склейки в коде с тестами; АэроТех — «NX-{номер} „{семейство оболочки}“»; Стартап — «{семейство продукта}{семейство tech}Labs».

---

## 9. Тесты и приёмка

Тесты (vitest):
- схемы `@stem/art` и все три манифеста валидны; `art:validate` ловит пропущенный `card.id`, превышение веса, `#FF00FF` в палитре;
- построитель промптов: детерминирован, содержит стиль-префикс, attachRule слота, мотив доминирующего стата и тир;
- процедурный fallback: один и тот же `card.id` → одинаковый SVG; разные слоты → разные силуэты;
- `speciesName` — таблица примеров;
- `compose` сцены: порядок слоёв по `z`, неизвестный слот уходит на «полку», `preview` заменяет ровно один слот.

Приёмка:
1. Все три темы рисуют сборку **без единого AI-ассета** (только процедурный слой) — проверка до генерации.
2. Утверждённые эталоны стиля трёх тем (скрин контактного листа в PR).
3. Все карты, свойства, статы, валюты, клетки трёх тем имеют ассеты; `art:validate` зелёный; лимиты веса соблюдены.
4. Главная: сцена с анимацией установки детали; рынок: миниатюры и «примерка»; трек: жетоны; пульт: сцены команд; онбординг: обложка.
5. Светлая и тёмная тема, 375 px, reduced-motion — скриншоты в PR.
6. `npm run lint && npm run typecheck && npm test && npm run build` зелёные; бандл web без ассетов вырос ≤ 25 КБ gzip.
7. Обновлены `CHANGELOG.md`, `docs/PROJECT_STATE.md`, `docs/design/COMPONENTS.md` (новые компоненты), `docs/ARCHITECTURE.md` (пакет `@stem/art`).

---

## 10. Порядок работы (контрольные точки)
1. `@stem/art`: схема, риги, процедурный fallback, `speciesName` + тесты → `AssemblyStage` в Mini App на процедурном слое для всех тем. **PR #1**.
2. Генерация эталонов стиля трёх тем → **стоп, показать человеку**.
3. После утверждения: конвейер `art:prompts/ingest/sheet/validate`, генерация пака НейроФауны, интеграция на всех экранах. **PR #2** (с контактным листом).
4. Паки АэроТех и Стартап. **PR #3**.
5. UI-иконки, голографический отлив, экспорт карточки, жетоны трека. **PR #4**.

Если в процессе стиль начинает «плыть» (детали выглядят как из разных игр) — остановиться, перегенерировать эталон и уточнить стиль-префикс, а не чинить по одной детали.
