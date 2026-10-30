# HR Simulator: Срочная вакансия — репозиторий разработки

Статическая игра на чистом HTML, CSS и JavaScript без сборки и зависимостей времени выполнения. Этот файл — для разработчиков; описание для игроков и преподавателей лежит в `hr-simulator/README.md`.

## Структура

- `hr-simulator/` — корень публикации: `index.html`, `styles.css`, `game.js`, `game-data.js`, `assets/` (изображения WebP, сокращённый шрифт и `OFL.txt`) и README для игроков. Только эта папка попадает на хостинг.
- `tools/` — подготовка ресурсов на Python (`optimize_assets.py`): оптимизация изображений, сокращение шрифтов до нужных знаков, проверка. Исходные файлы Noto Sans и Noto Sans Symbols с лицензией лежат в `tools/fonts/NotoSans/`, Press Start 2P — в стартовом наборе. Зависимости: `tools/requirements.txt` (`pip install -r tools/requirements.txt`).
- `tests/` — модульные тесты (`tests/unit/`), сквозные тесты Playwright (`tests/e2e/`), конфигурация Playwright, статический сервер `tests/serve.mjs`, запуск Lighthouse (`tests/lighthouse/`) и `tests/run-in-container.sh`.
- `HR_Simulator_Static_HTML_Starter_Pack/` — исходное ТЗ и сюжетный материал; тесты сверяют с ними тексты игры.
- `package.json` содержит только `devDependencies` (Playwright, axe, Lighthouse); в игру они не попадают.

## Команды

Установка инструментов разработки: `npm install`, затем `npx playwright install` (браузеры).

| Команда | Что делает |
| --- | --- |
| `npm run serve` | Локальный статический сервер на 127.0.0.1:8123 (корень репозитория). |
| `npm run assets` | Пересобирает ресурсы в `hr-simulator/assets` (нужен Python 3 и `tools/requirements.txt`). |
| `npm run assets:check` | Проверяет, что ресурсы соответствуют бюджету и правилам. |
| `npm run assets:glyphs` | Проверяет, что в сокращённом шрифте есть все знаки из `game-data.js` и `index.html`. Стрелку `→` даёт отдельное одноглифовое подмножество Noto Sans Symbols. |
| `npm run test:unit` | Модульные тесты Node (`node --test tests/unit/`). |
| `npm run test:e2e` | Все сквозные тесты Playwright: Chromium, Firefox, WebKit × http и file. |
| `npm run test:e2e:native` | То же только для Chromium и Firefox. |
| `npm run test:e2e:webkit` | Проекты WebKit в Docker (см. ниже). |
| `npm run lighthouse` | Прогон Lighthouse (мобильный и десктопный профили). |
| `npm test` | Модульные и сквозные тесты подряд. |

## WebKit в Docker

На некоторых системах (например, Arch/CachyOS) сборка WebKit от Playwright не запускается из-за системных библиотек. `tests/run-in-container.sh` запускает Playwright в официальном образе `mcr.microsoft.com/playwright` той же версии, что и в `package.json`; репозиторий монтируется по тому же абсолютному пути, чтобы адреса `file://` совпадали. Нужен установленный Docker. Скрипту можно передать любые аргументы Playwright, например `tests/run-in-container.sh --project=webkit-http`.

## Публикация

Публикацию выполняет GitHub Actions: `.github/workflows/pages.yml` при пуше в `main` (или вручную через `workflow_dispatch`) загружает папку `hr-simulator` как артефакт Pages и разворачивает его. Шага сборки нет. Включите в настройках репозитория Pages → Source: GitHub Actions. Пуш в `main` делается вручную и согласуется отдельно — автоматически ничего не отправляется.
