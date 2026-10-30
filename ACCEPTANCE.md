# Приёмка M10: «HR Simulator: Срочная вакансия»

Чек-лист критериев приёмки AC 1–32 из `.gjc/_session-01a188e1-72fe-7612-8417-9d34983d4d74/specs/deep-interview-hr-simulator.md`. Игра: `hr-simulator/` (корень публикации).

Условные обозначения в колонке «Доказательство»:

- `unit/…` — `tests/unit/*.test.mjs` (`node --test tests/unit/`);
- `e2e/…` — `tests/e2e/*.spec.mjs` и общие сценарии `tests/e2e/flows.mjs`, `tests/e2e/helpers.mjs` (Playwright);
- название теста указано в кавычках; тег `@parity` означает, что тест запускается и по `http`, и по `file://`;
- «просмотр» — проверка человеком по артефактам в `tests/artifacts/` (скриншоты, `content-review.md`, листы ассетов).

Статусы: **выполнено** — критерий закрыт автоматической проверкой (или проверкой команды); **выполнено с оговоркой** — закрыт, но часть формулировки подтверждена только просмотром или имеет ограничение (описано в колонке).

## Таблица критериев

### История и содержание

| AC № | Критерий (кратко) | Доказательство | Статус |
|---|---|---|---|
| 1 | Без сохранения открывается экстерьер компании, текст Intro A по SPEC | `e2e/playthrough.spec.mjs` → «full playthrough @parity» (шаг Intro A в `flows.mjs`: заголовок, подзаголовок, текст, кнопка «Далее», вторичная кнопка скрыта) | выполнено |
| 2 | Intro B–D: карточка вакансии, шестеро персонажей с именем и ролью, лид Huntflow, «Начать интервью» | `e2e/playthrough.spec.mjs` → «full playthrough @parity» (Intro B: пункты вакансии и AI-политика; Intro C: 6 карточек, имена и роли, 6 разных загруженных картинок; Intro D: две реплики, кнопка «Начать интервью»); `unit/game-data.test.mjs` → «structure: 5/5/2 scenes, backgrounds, choice ids, offer and ending shape», «money formatting: NBSP between digit groups and before the ruble sign», «mutation (vii): cast name swap fails» | выполнено |
| 3 | Ровно 12 решений 5/5/2 в порядке SPEC, даты, фоны; по три варианта А/Б/В, один верный | `unit/game-data.test.mjs` → «structure: 5/5/2 scenes, backgrounds, choice ids, offer and ending shape», «correctness is derived only from kind === good and equals the pinned table», «mutation (viii): pinned dateLabel drift fails»; `e2e/playthrough.spec.mjs` → «full playthrough @parity» (фон, фаза и дата на каждом из 12 решений; буквы `А Б В`; тексты вариантов равны данным) | выполнено |
| 4 | Реплики и варианты дословно из источника; ситуативное пояснение под верным заголовком + реакция; без повторов и очков | `unit/game-data.test.mjs` → «positive acceptance: the complete data set satisfies the field-exact source validator», «mutation (i)»–«mutation (vi)», «validator hardening: selector, section, coverage and Gate C errors», «kinds equal the Intent Diff map and map to the three feedback headings», «36 feedback texts: unique, 80-450 chars, 2-4 sentences, Russian, no grading words», «reactions: wrong reactions are 1-2 unique non-empty lines; good reactions come from the data», «D12 authored good reaction is exact narration and implies no acceptance»; `e2e/playthrough.spec.mjs` → «full playthrough @parity» (заголовок, реакция и пояснение на экране); просмотр: `tests/artifacts/content-review.md` | выполнено |
| 5 | Переходы между фазами (после 5 и 10) — короткие экраны; оффер после решения 12 — все 9 строк SPEC | `e2e/playthrough.spec.mjs` → «full playthrough @parity» (заголовок и текст обоих переходов; 9 строк оффера по данным); `e2e/layout.spec.mjs` → «scene, feedback, transition, offer, ending» (на 4 вьюпортах: 9 пунктов оффера); `unit/game-data.test.mjs` → «structure: 5/5/2 scenes, backgrounds, choice ids, offer and ending shape» | выполнено |
| 6 | Финал на фоне победы, дата «9 ноября 2026 года», сообщение Геннадия, закрывающая строка SPEC; единственное действие «Начать заново» | `e2e/playthrough.spec.mjs` → «full playthrough @parity» (дата, заголовок, сообщение Геннадия, закрывающий текст; ровно одна кнопка «Начать заново», она в фокусе); `e2e/motion.spec.mjs` → «a tap on the final ending line does not restart; only the button does» | выполнено |

### Движок

| AC № | Критерий (кратко) | Доказательство | Статус |
|---|---|---|---|
| 7 | Верный ответ → реакция + пояснение + «Продолжить»; неверный → реакция + пояснение + «Попробовать ещё раз», тот же вопрос | `e2e/playthrough.spec.mjs` → «full playthrough @parity» (D1: неверный вариант А → заголовок «Что можно улучшить», реакция, пояснение, «Попробовать ещё раз», возврат на тот же вопрос; верный → «Продолжить»); `e2e/keyboard.spec.mjs` → «full keyboard-only playthrough: wrong answer + retry on D1, offer, ending, restart» | выполнено |
| 8 | Пока открыто пояснение, остальные варианты недоступны | `e2e/playthrough.spec.mjs` → «full playthrough @parity» (варианты Б и В `toBeDisabled`, выбранный А помечен `aria-current`) | выполнено |
| 9 | Прогресс пишется в localStorage на каждом шаге; сбои хранилища не ломают игру | `e2e/save-resume.spec.mjs` → «progress is saved per step and resumed fresh @parity», «corrupt and out-of-range saves are ignored and removed @parity», «throwing storage: full playthrough completes without errors @parity», «non-persistent storage matches the recorded expectation @parity»; `e2e/file-storage.expect.json` (для `file://` во всех трёх движках записано `persist`) | выполнено |
| 10 | После перезагрузки с сохранением — «Продолжить» и «Начать заново», вопрос открывается заново; без сохранения — «Далее» | `e2e/save-resume.spec.mjs` → «progress is saved per step and resumed fresh @parity» (экран возобновления, фокус на «Продолжить», возврат на сохранённый шаг, вопрос D7 не отвечен; без сохранения — только «Далее»); `e2e/a11y.spec.mjs` → «resume screen has no violations» | выполнено |
| 11 | Сохранение очищается на финале и при «Начать заново» | `e2e/save-resume.spec.mjs` → «ending and ending restart clear the save @parity», «progress is saved per step and resumed fresh @parity» (рестарт с экрана возобновления удаляет ключ `hrsim.save.v1`); `e2e/playthrough.spec.mjs` → «full playthrough @parity» (после финала ключ пуст) | выполнено |
| 12 | Кнопка полноэкранного режима на Fullscreen API, отражает состояние, скрыта там, где API нет | `e2e/fullscreen.spec.mjs` → «unsupported fullscreen keeps the button hidden», «fullscreen toggles and aria-pressed follows the real state». Оговорка: второй тест завершается досрочно, если в движке кнопка скрыта (API не поддерживается); на реальном iPhone Safari не проверялось | выполнено с оговоркой |

### Визуал и адаптивность

| AC № | Критерий (кратко) | Доказательство | Статус |
|---|---|---|---|
| 13 | Четыре фона в местах по SPEC, `cover`, без искажений, чёткий пиксельный рендер | `e2e/playthrough.spec.mjs` → «full playthrough @parity» (активный фон на каждом шаге равен ожидаемому: company / office / meeting_room / victory); `e2e/layout.spec.mjs` → «intro screens @intro» (все видимые картинки загружены); `styles.css`: `.bg-layer img { object-fit: cover }`; просмотр: `tests/artifacts/screens/*/`. Оговорка: `cover` и отсутствие искажений проверены просмотром и CSS, а не отдельным тестом; фоны даунскейлены в WebP и рисуются с `image-rendering: auto` (сглаживание), а не `pixelated` | выполнено с оговоркой |
| 14 | Широкий экран: только текущий говорящий, крупный вырез слева, панель справа и не перекрывает его; кроссфейд при смене говорящего | `e2e/layout.spec.mjs` → «intro screens @intro», «scene, feedback, transition, offer, ending» (в широком режиме ровно один вырез тогда и только тогда, когда есть говорящий; аватар скрыт; вырез целиком на экране и заканчивается левее панели — тест падает на прежней раскладке с панелью по центру); `e2e/motion.spec.mjs` → «wide mode crossfades speaker to speaker with exactly one opaque layer @motion»; просмотр: скриншоты `desktop`, `laptop`. Оговорка: размер выреза подтверждён просмотром | выполнено с оговоркой |
| 15 | Телефон 390×844: фон на весь экран, аватар в панели, панель ≈ нижние 2/3, внутренний скролл, без горизонтального скролла, кнопки ≥ 44 px | `e2e/layout.spec.mjs` → «intro screens @intro», «scene, feedback, transition, offer, ending» на `phone 390x844` (`assertNoHorizontalOverflow`, `assertButtonsMin44`, `assertPanelReachable`, доля панели 0,60–0,72, аватар есть тогда и только тогда, когда есть говорящий); `e2e/interaction.spec.mjs` → «(e) touch-drag scroll of the panel does not advance @motion» | выполнено |
| 16 | Кремовая панель со ступенчатой сине-navy рамкой в CSS, индикатор «дальше» справа внизу, палитра SPEC; имя говорящего своим цветом у каждого персонажа | `e2e/palette.spec.mjs` → «the SPEC palette is parsed completely», «panel, title, buttons and frame use the SPEC colours (intro)», «spoken dialogue text is ink; speaker name has the speaker colour», «cast names and feedback names carry six distinct speaker colours» (шесть разных цветов имён в галерее, имя в панели и в разборе ответа совпадают; контраст каждого цвета на кремовом ≥ 5,4:1, axe без нарушений), «choices and feedback: frame-blue choice border, caution/success accents, navy feedback border», «secondary button (resume screen): cream fill, navy label and ring» (цвета палитры читаются из `SPEC.md`). Оговорка: ступенчатая рамка и индикатор (пиксельная стрелка `.btn.primary::after` в правом конце ряда действий) проверены просмотром скриншотов; отдельного теста на положение индикатора нет | выполнено с оговоркой |
| 17 | Локальный шрифт в WOFF2 с запасным; `₽`, «», — отображаются верно | `e2e/helpers.mjs` → `assertFontLoaded` (вызывается в «intro screens @intro» и «full playthrough @parity»: обычное и полужирное начертания `Noto Sans` в статусе `loaded`); `npm run assets:glyphs` OK; `unit/repo.test.mjs` → «deploy root: only shipped file kinds, no dev sources» (есть `.woff2` и `OFL.txt`, исходных TTF нет), «all references are relative»; просмотр скриншотов. Оговорка: SPEC рекомендует Pixelify Sans; 30.10.2026 по решению пользователя (пиксельный шрифт плохо читается) он заменён на Noto Sans (OFL 1.1). `→` в Noto Sans нет, он рисуется системным шрифтом | выполнено с оговоркой |
| 18 | 1366×768 и ландшафт телефона пригодны: панель скроллится, а не обрезается | `e2e/layout.spec.mjs` → «intro screens @intro», «scene, feedback, transition, offer, ending» на `laptop 1366x768` и `landscape 844x390` (без горизонтального переполнения, кнопки ≥ 44 px, `assertPanelReachable`; в ландшафте доля панели ≥ 0,8) | выполнено |

### Плавность и доступность

| AC № | Критерий (кратко) | Доказательство | Статус |
|---|---|---|---|
| 19 | Печать по буквам; клик/тап/Enter/Space дописывают текст; варианты — только после полного текста | `e2e/motion.spec.mjs` → «choices hidden while typing; … completes the text @motion» (варианты для каждого способа), «a second tap right after the choices appear never answers @motion»; `e2e/interaction.spec.mjs` → «(a) «Далее» while typing completes the line without advancing; focus stays @motion», «(b) double activation advances exactly one step @motion», «(c) taps on D7 complete lines without double advance @motion», «(d) Space on #primary advances exactly one line @motion», «(f) a human-paced double click (150 ms apart) opens exactly one new screen» (оба клика — «сырые» клики мыши без промежуточных ожиданий; без защиты «Далее» тест падает во всех трёх движках); `e2e/motion.spec.mjs` → «held Space (global key path) advances exactly one line on release» | выполнено |
| 20 | Переходы 120–250 мс; `prefers-reduced-motion` отключает печать и переходы | `e2e/motion.spec.mjs` → «transition durations are within 0.12–0.25 s @motion», «reduced motion: 0 s transitions, instant text, last line and prompt both announced» (по умолчанию все остальные тесты идут с `reducedMotion: 'reduce'`) | выполнено |
| 21 | Полная работа с клавиатуры, видимый фокус, осмысленное перемещение фокуса, семантические кнопки, `aria-live` | `e2e/keyboard.spec.mjs` → «Intro A → Intro B by Enter, D1 answered by keyboard @parity», «Tab order reaches fullscreen and «Далее» on Intro A with a visible focus ring», «full keyboard-only playthrough: wrong answer + retry on D1, offer, ending, restart»; `e2e/a11y.spec.mjs` → «.sr-live mirrors the current dialogue line», «.sr-live announces the question prompt and feedback»; `e2e/motion.spec.mjs` → «the live region gets each line once, never per character @motion», «step headings are announced on titled dialogue steps»; `e2e/playthrough.spec.mjs` (фокус на варианте А после повтора, фокус на «Начать заново») | выполнено |
| 22 | Изображения следующего шага предзагружаются, без мигания | `e2e/motion.spec.mjs` → «step n+1 background is preloaded before it is entered @motion» (запись в `resource timing` для фона `meeting_room` появляется до входа в сцену; только по `http`). Проверяется один показательный переход (фон `meeting_room` после D5), а не все пары шагов | выполнено |
| 23 | Контраст текста по WCAG AA | `e2e/a11y.spec.mjs` → «Intro A–D have no violations», «question screen has no violations», «feedback screens (improve, risky, good) have no violations», «transition screen has no violations», «offer screen has no violations», «ending screen has no violations», «Intro A while the text is being typed has no violations @motion» (axe, включая правило контраста); Lighthouse accessibility 1.00. Оговорка: пункты axe «needs review» по контрасту поверх фоновых картинок (экраны вопроса, пояснения, перехода, финала) разобраны просмотром скриншотов: текст лежит на непрозрачной кремовой панели | выполнено с оговоркой |

### Упаковка и контроль качества

| AC № | Критерий (кратко) | Доказательство | Статус |
|---|---|---|---|
| 24 | `~/HRGAME` — git-репозиторий; `hr-simulator/` с `index.html`, `styles.css`, `game-data.js`, `game.js`, ассетами (фоны, персонажи, аватары, ui, шрифты + `OFL.txt`), `README.md` | `unit/repo.test.mjs` → «deploy root: git-visible files equal files on disk (nothing ignored or stray)», «deploy root: only shipped file kinds, no dev sources», «player README (Russian, no dev tooling)», «root README (Russian, documents dev workflow)», «package.json has no runtime dependencies», «index.html structure», «game scripts use no network or module APIs»; `git log --oneline` — история локальных коммитов (Baseline, M1–M7) | выполнено |
| 25 | Скрипт оптимизации вне `hr-simulator/` пересобирает WebP/WOFF2; визуальная сверка с оригиналами | `tools/optimize_assets.py` (`npm run assets`): изображения — из стартового набора, шрифт — из `tools/fonts/NotoSans/` (исходные TTF и лицензия); `npm run assets:check` OK (в том числе состав `assets/fonts`); `npm run assets:glyphs` OK; просмотр: `tests/artifacts/asset-review/` (листы фонов, персонажей, аватаров и `metrics.json`) | выполнено |
| 26 | Workflow GitHub Pages публикует `hr-simulator/`; не отправлен (push не выполнялся) | `unit/repo.test.mjs` → «Pages workflow publishes hr-simulator without a build» (`.github/workflows/pages.yml`: `configure-pages`, `upload-pages-artifact`, `path: hr-simulator`, `deploy-pages`, нужные права, нет шагов сборки); `unit/repo.test.mjs` → «all references are relative»; `git remote -v` пуст | выполнено |
| 27 | Playwright проходит в Chromium, Firefox, WebKit: полное прохождение, неверный ответ + повтор, сохранение/возобновление, рестарт очищает сохранение | `e2e/playthrough.spec.mjs` → «full playthrough @parity»; `e2e/save-resume.spec.mjs` → «progress is saved per step and resumed fresh @parity», «ending and ending restart clear the save @parity»; результаты: Chromium + Firefox (http + file) — 121 passed, 7 skipped; WebKit (http + file, контейнер) — 60 passed, 4 skipped (см. «Проверки») | выполнено |
| 28 | Скриншоты 1920×1080, 1366×768, 390×844, просмотрены; проверки переполнения/обрезания проходят | `e2e/layout.spec.mjs` → «intro screens @intro», «scene, feedback, transition, offer, ending» (виды `desktop 1920x1080`, `laptop 1366x768`, `phone 390x844`, плюс `landscape 844x390`; `assertNoHorizontalOverflow`, `assertButtonsMin44`, `assertPanelReachable`, `assertVisibleImagesLoaded`); скриншоты: `tests/artifacts/screens/{chromium,firefox,webkit}-http/{desktop,laptop,phone,landscape}/` (15 кадров на вьюпорт); просмотр выполнен | выполнено |
| 29 | Тест прохождения только с клавиатуры | `e2e/keyboard.spec.mjs` → «full keyboard-only playthrough: wrong answer + retry on D1, offer, ending, restart», «Intro A → Intro B by Enter, D1 answered by keyboard @parity» | выполнено |
| 30 | Ноль внешних сетевых запросов; игра проходит и через `file://` | `e2e/fixtures.mjs` — автоматическая защита сети для каждого теста (разрешены только префиксы игры по `http`/`file`, любой другой запрос блокируется; `requestfailed`, ответы ≥ 400, `pageerror`, `console.error` — ошибки); `e2e/smoke.spec.mjs` → «engine launches and localStorage matches recorded expectation @smoke»; все тесты с тегом `@parity` идут по `file://`; `unit/repo.test.mjs` → «game scripts use no network or module APIs», «guardExtraAllow is confined to smoke spec and fixtures» | выполнено |
| 31 | Lighthouse (mobile + desktop): performance ≥ 90 и accessibility ≥ 90 | `tests/lighthouse/run-lighthouse.mjs` (`npm run lighthouse`, 3 запуска mobile + 3 desktop, порог 0,90 по медианам); отчёты `tests/artifacts/lighthouse/*.json`; медианы performance 0,98 (mobile) и 1,00 (desktop), accessibility 1,00 на обоих профилях | выполнено |
| 32 | Автопроверка: нет слов/шаблонов очков в видимом тексте, весь UI русский | `unit/game-data.test.mjs` → «no scoring vocabulary and no fractions other than 5/2 and 24/7 in any player-visible string», «Russian-only: every string has Cyrillic and Latin tokens stay inside the allowlist»; `e2e/content.spec.mjs` → «every rendered screen is Russian-only, has no scoring words and no stray fractions (AC32)»; `e2e/playthrough.spec.mjs` (на экране нет «/12»). | выполнено |

## Проверки

Все команды выполнялись из корня репозитория; результаты зафиксированы лидером до написания этого файла.

| Команда | Результат |
|---|---|
| `node --test tests/unit/` (`npm run test:unit`) | 35 из 35 тестов пройдено |
| `npm run test:e2e:native` — Playwright, Chromium + Firefox, проекты `-http` и `-file` | 121 passed, 7 skipped (запланированно: проекты `-file` запускают только `@parity` и `@smoke`; копия с анимацией `@motion` — только в одном движке; сенсорные тесты пропускаются в Firefox) |
| `npm run test:e2e:webkit` (`tests/run-in-container.sh`, Docker-контейнер; проекты `webkit-http` и `webkit-file`) | 60 passed, 4 skipped. Запуск в контейнере, потому что нативному WebKit на этом хосте Arch не хватает `libicu74` и `libflite` |
| `npm run lighthouse` (3 запуска mobile + 3 desktop) | Медианы performance 0,98 (mobile) и 1,00 (desktop), accessibility 1,00 на обоих профилях. LCP: mobile ≈ 2,5 с, desktop ≈ 0,2–0,8 с; TBT 0; CLS ≤ 0,03. Элемент LCP — текст панели Intro A |
| `npm run assets:check` | OK |
| `npm run assets:glyphs` | OK. Все знаки текста есть в подмножестве Noto Sans, кроме `→` (один вариант ответа, дословно из источника): он рисуется системным шрифтом |

### Бюджеты передачи и размера

| Показатель | Значение | Бюджет | Итог |
|---|---|---|---|
| Передача первого экрана (mobile) | 329 КБ (Lighthouse, без сжатия на локальном сервере) | ≤ 350 КБ | уложились |
| Блокирующие рендер ресурсы | только `styles.css` | — | как задумано |
| Сырые JS + CSS | 94 КБ, из них `game-data.js` (текст истории) 55 КБ; код (`game.js` + `styles.css`) 39 КБ | 80 КБ | **сырой бюджет 80 КБ превышен только файлом с текстом истории**; код уложился |
| Gzip, JS + CSS суммарно | 23,5 КБ (GitHub Pages отдаёт gzip) | 80 КБ | уложились |

### Артефакты проверок

- Скриншоты: `tests/artifacts/screens/`.
- Отчёты Lighthouse: `tests/artifacts/lighthouse/`.
- Листы ассетов и метрики оптимизации: `tests/artifacts/asset-review/`.
- Обзор содержания: `tests/artifacts/content-review.md`, `tests/artifacts/content-dump.md`.

## Пределы

- Реальные iPhone и Android не проверялись: только эмулированные вьюпорты (390×844, 844×390, 1366×768, 1920×1080) и движок WebKit в контейнере. Поведение на настоящих устройствах (сенсорный скролл, динамическая панель адреса, клавиатура ОС) не подтверждено.
- Кнопка полноэкранного режима скрыта там, где Fullscreen API недоступен (iPhone Safari): это задумано (AC 12), но на реальном iPhone не проверялось.
- Пункты axe «needs review» по контрасту поверх фоновых картинок на экранах вопроса, пояснения, перехода и финала разобраны просмотром скриншотов: текст лежит на непрозрачной кремовой панели. Автоматически это правило эти места не закрывает.
- Сырой бюджет JS + CSS 80 КБ превышен файлом `game-data.js` (55 КБ текста истории, он нужен целиком); код укладывается, а по gzip-передаче (23,5 КБ) бюджет соблюдён.
- Шрифт Pixelify Sans из SPEC заменён на Noto Sans по решению пользователя: пиксельное начертание кириллицы плохо читалось. Подмножество без хинтинга; `→` в нём нет и рисуется системным шрифтом.
- Отображаемый текст ждёт загрузки шрифта (`font-display: swap`), поэтому LCP на mobile ≈ 2,5 с при performance 0,98.
- Фоны отдаются в сглаженном виде (`image-rendering: auto`), а не с принудительной пиксельной растеризацией; критерий «чёткий пиксельный рендер» (AC 13) подтверждён просмотром, не тестом.
- Размер выреза говорящего на широком экране (AC 14) и положение индикатора «дальше» справа внизу (AC 16) подтверждены просмотром скриншотов, а не утверждениями в тестах. Отсутствие перекрытия выреза панелью проверяется тестом.
- Предзагрузка (AC 22) подтверждена автоматически на одном показательном переходе (фон `meeting_room` после D5), по `http`.
- Файловые проекты (`*-file`) запускают только тесты `@parity` и `@smoke`; полный набор (раскладка, доступность, анимация, Lighthouse) идёт по `http`.
- Сохранение по `file://` проверяется по записанному ожиданию (`tests/e2e/file-storage.expect.json`: `persist` для Chromium, Firefox и WebKit); в других версиях браузеров или режимах приватности поведение `localStorage` на `file://` может отличаться, а игра в этом случае продолжает работать без сохранения (проверено тестом «throwing storage…»).
- Изменения не отправлялись в удалённый репозиторий (`git remote -v` пуст); публикация через workflow GitHub Pages не запускалась и в реальном окружении Pages не проверялась.
