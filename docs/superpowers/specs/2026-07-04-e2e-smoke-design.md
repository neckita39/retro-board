# E2E смоук-тесты (Playwright)

Дата: 2026-07-04. Статус: дизайн согласован с пользователем (тайминг: после деплоя фидбек-итерации ✓; охват: смоук; запуск: CI, гейтит деплой).

## Цель

Смоук-набор e2e-тестов, прогоняемый в CI на каждый push и блокирующий деплой при падении. Покрывает критические пользовательские пути реального приложения (браузер + сервер + Socket.IO + PostgreSQL), которые юнит-тесты не видят.

## Решения

- **Фреймворк**: `@playwright/test` (devDependency), только chromium.
- **Спеки**: `e2e/*.spec.ts`. Vitest их не подхватит — его `include` ограничен `src/**/*.test.ts` (vite.config.ts), коллизий нет.
- **Запускаемое приложение**: собранный прод-вход `node server.js` (Socket.IO живёт именно там; `npm run dev` не подходит). Порт 3777, `ORIGIN=http://localhost:3777` (обязателен — SvelteKit CSRF-проверка form actions), `BODY_SIZE_LIMIT=20971520`.
- **БД и миграции**: PostgreSQL + `node migrate.js` (идемпотентный, читает `DATABASE_URL`).
  - Локально: `docker compose up -d db` — контейнер БД уже проброшен на `localhost:5433`; `DATABASE_URL=postgresql://retro:retro@localhost:5433/retro`.
  - CI: service-контейнер `postgres:16-alpine` на `localhost:5432`.
- **playwright.config.ts**: `testDir: 'e2e'`, `baseURL: http://localhost:3777`, один воркер (общая БД, realtime-тесты), `webServer` = `node migrate.js && node server.js` с нужным env (сборка — отдельным шагом до запуска тестов, не внутри webServer, чтобы таймаут webServer не зависел от сборки), `reuseExistingServer: !process.env.CI`.
- **npm-скрипт**: `"test:e2e": "playwright test"`. В `.gitignore` добавить `test-results/` и `playwright-report/`.
- **Изоляция данных**: каждый тест создаёт СВОЮ доску через UI (`/new`) — доски адресуются nanoid-слагами, пересечений нет; чистка БД не нужна.

## Смоук-набор (6 спеков)

1. **board-lifecycle**: `/new` → создать доску с названием → редирект на доску, название в хедере → добавить карточку в «Went Well» → карточка видна с текстом.
2. **votes**: на карточке лайк → счётчик 1; клик по дизлайку → лайк снят, дизлайк 1 (серверное снятие противоположного голоса, один emit).
3. **comments**: добавить комментарий → акцентный бейдж с количеством на карточке; в секции Summary у той же карточки комментарий доступен (разворачивается).
4. **card-actions**: перенос карточки в другую колонку через inline-панель → карточка сменила колонку; удаление: первый тап — confirm-состояние, второй — карточка исчезла.
5. **realtime**: два browser context на одной доске → карточка, созданная в A, появляется в B без перезагрузки; голос из B виден в A.
6. **export-api**: доска с карточкой → `GET /api/v1/boards/{slug}/export.md` — 200, `text/markdown`, содержит текст карточки; `export.json` — 200, парсится, карточка в правильной колонке; несуществующий slug — 404.

Селекторы — по ролям/тексту и i18n-строкам EN-локали (тесты выставляют `localStorage['retro-locale']='en'` перед заходом, чтобы не зависеть от локали окружения).

## CI

В `.github/workflows/ci.yml` добавить job `e2e` (после `test`, перед `deploy`):
- `services: postgres` (postgres:16-alpine, user/pass/db = retro, health-check).
- Шаги: checkout → setup-node → `npm ci` → `npx playwright install --with-deps chromium` → `npm run build` → `npx playwright test` (env: `DATABASE_URL=postgresql://retro:retro@localhost:5432/retro`, `PORT=3777`, `ORIGIN=http://localhost:3777`).
- `deploy` получает `needs: [test, e2e]` — красный e2e блокирует деплой.
- При падении — загрузка `playwright-report/` артефактом (`actions/upload-artifact`, `if: failure()`).

## Вне скоупа

- Firefox/WebKit, мобильные вьюпорты.
- Пространства с паролем, таймер, картинки-вложения, тёмная тема, переключение локали (кандидаты на расширение следующим заходом).
- Визуальные скриншот-тесты.

## Риски

- Флаки realtime-теста: ждать появления карточки через `expect(...).toBeVisible()` с дефолтным авто-ожиданием Playwright, не через фиксированные sleep.
- `npm ci` локально требует `--force` (несовпадение версии node с peer-dep vite-plugin-svelte) — в CI обычный `npm ci` уже работает (существующий job).
- Один воркер обязателен: realtime-тесты чувствительны к нагрузке на общий сервер.
