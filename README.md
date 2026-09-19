<div align="center">

<img src="static/logo.png" alt="Retrospectrix" width="120" />

# Retrospectrix

**Бесплатная онлайн-доска для ретроспектив — без регистрации**

Создайте доску, отправьте ссылку команде — все уже на доске. Никаких аккаунтов, почты и триалов.

**[retrospectrix.ru](https://retrospectrix.ru)**

[![CI/CD](https://github.com/neckita39/retro-board/actions/workflows/ci.yml/badge.svg)](https://github.com/neckita39/retro-board/actions/workflows/ci.yml)
![Svelte 5](https://img.shields.io/badge/Svelte-5-ff3e00?logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ed?logo=docker&logoColor=white)

</div>

---

## Возможности

<table>
<tr>
<td width="50%">

**Форматы ретро** — классика (хорошо / не получилось / улучшить), Start Stop Continue, Mad Sad Glad, 4L, Sailboat. Формат выбирается при создании доски

**Реальное время** — карточки, голоса и комментарии обновляются у всех мгновенно (Socket.IO)

**Голосование** — лайки и дизлайки; вес карточки = лайки − дизлайки

**Drag & drop** — перенос карточек между колонками мышью

**Комментарии и картинки** — обсуждение и вложения прямо на доске, лайтбокс

</td>
<td width="50%">

**Режим обсуждения** — ведущий ведёт команду по повестке: одна карточка подсвечена у всех, таймер 5 минут на каждую, пройденные помечаются

**Пространства** — серия ретро одной команды, опционально под паролем

**Таймер** — общий обратный отсчёт на встречу

**Экспорт и API** — JSON и Markdown по коду доски, без ключей — удобно для ботов и AI-агентов

**RU / EN**

</td>
</tr>
</table>

**Шифрование** (AES-256-GCM) · **Мониторинг** (StatsD + Netdata) · **CI/CD** с e2e-гейтом (GitHub Actions)

Контентные страницы: [форматы ретроспективы](https://retrospectrix.ru/formats), [как провести ретро](https://retrospectrix.ru/how-to-run-a-retro), [о проекте](https://retrospectrix.ru/about), [политика конфиденциальности](https://retrospectrix.ru/privacy), [changelog](https://retrospectrix.ru/changelog).

---

## Быстрый старт

```bash
git clone https://github.com/neckita39/retro-board.git
cd retro-board
docker compose up -d --build
```

Откройте http://localhost:3777

<details>
<summary><b>Разработка без Docker для приложения</b></summary>

<br>

```bash
docker compose up -d db        # только PostgreSQL (порт 5433)
npm install
npm run dev
```

Миграции — ручные SQL-файлы в `drizzle/`, применяются `node migrate.js` (в Docker — автоматически при старте).

</details>

---

## Конфигурация

Скопируйте `.env.example` в `.env`:

| Переменная | Описание | По умолчанию |
|-----------|----------|-------------|
| `DATABASE_URL` | Подключение к PostgreSQL | `postgresql://retro:retro@db:5432/retro` |
| `PORT` | Порт приложения | `3000` |
| `ORIGIN` | Публичный URL (CORS, ссылки) | `http://localhost:3777` |
| `ENCRYPTION_KEY` | Ключ шифрования (64 hex) | пусто = без шифрования |
| `BODY_SIZE_LIMIT` | Лимит загрузки картинок, байт | `20971520` (20 MB) |
| `APP_PORT` | Внешний порт в продакшене | `80` |
| `TG_BOT_TOKEN`, `TG_CHAT_ID` | Уведомления о фидбеке в Telegram | пусто = выключено |
| `TG_PROXY` / `TG_API_BASE` | SOCKS-прокси или форвардер, если Telegram API недоступен с хостинга | — |
| `STATSD_HOST`, `STATSD_PORT` | Куда слать метрики | `localhost:8125` |
| `LOG_LEVEL` | Уровень логов Pino | `info` |

Сгенерируйте ключ: `openssl rand -hex 32`

**Продакшен:**

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Тесты

```bash
npm test          # юнит-тесты (Vitest) — без БД и браузера
npm run check     # svelte-check
npm run test:e2e  # Playwright: собирает приложение и гоняет его против настоящего Postgres
```

Для e2e предварительно запустите `docker compose up -d db`. Каждый e2e-тест создаёт свою доску, чистить БД не нужно.

---

## CI/CD

При пуше в `main` GitHub Actions автоматически:

```
push → install → unit tests → build → e2e (Playwright + Postgres) → deploy по SSH
```

Деплой не случится, если упал любой шаг — в том числе e2e.

---

## Данные и приватность

- Доска доступна только по неугадываемой ссылке (`nanoid`, 21 символ). Доски и пространства закрыты от поисковиков (`noindex` + `robots.txt`); индексируются только контентные страницы из `seo-paths.js`.
- Тексты карточек, имена авторов и комментарии шифруются при хранении (см. ниже). Картинки сжимаются в WebP и лежат в PostgreSQL.
- Аккаунтов нет. Одна техническая сессионная кука для подсчёта визитов; имя и язык живут в `localStorage`.
- Удаление доски каскадом удаляет карточки, комментарии, голоса и картинки. Картинки-сироты чистятся автоматически через сутки.

Подробнее — на странице [конфиденциальности](https://retrospectrix.ru/privacy).

---

<details>
<summary><b>Шифрование</b></summary>

<br>

При установке `ENCRYPTION_KEY` содержимое карточек, имена авторов и комментарии шифруются AES-256-GCM перед записью в БД. Без ключа данные хранятся как есть.

Старые данные, созданные до включения шифрования, продолжают работать.

</details>

<details>
<summary><b>Форматы досок</b></summary>

<br>

Реестр пресетов — `board-formats.js` в корне репозитория (там же, где `seo-paths.js`: `server.js` работает в рантайм-образе без `src/`). Его читают сервер, клиент и экспорт.

| Формат | Колонки |
|--------|---------|
| `classic` | went_well · didnt_go_well · improve |
| `start-stop-continue` | start · stop · continue |
| `mad-sad-glad` | mad · sad · glad |
| `4l` | liked · learned · lacked · longed |
| `sailboat` | wind · anchors · rocks · island |

Формат задаётся при создании и не меняется. Id формата совпадает со slug страницы `/formats/<slug>`, поэтому `/new?format=sailboat` предвыбирает его. Ключи `columns` в JSON-экспорте зависят от формата доски (`board.format`).

</details>

<details>
<summary><b>API</b></summary>

<br>

Read-only доступ по коду доски, без аутентификации — код доски и есть ключ:

```
GET /api/v1/boards/{slug}/export.json            # board, columns → cards, votes, comments, image urls
GET /api/v1/boards/{slug}/export.md?lang=en|ru    # Markdown; lang — язык заголовков
GET /api/v1/spaces/{slug}/boards.json             # space, boards → slug, title, format, createdAt, url (новые первыми)
GET /api/v1/spaces/{slug}/boards.md?lang=en|ru     # то же списком ссылок в Markdown
GET /api/v1/spaces/{slug}/analyses.json            # все AI-анализы пространства в формате экспорта доски
GET /api/v1/spaces/{slug}/analyses.md?lang=en|ru   # то же в Markdown; пространство с паролем — заголовок X-Space-Password (401 без него, 403 неверный)
```

Лимит 30 запросов в минуту с IP. Документация — [retrospectrix.ru/api](https://retrospectrix.ru/api).

</details>

<details>
<summary><b>Мониторинг</b></summary>

<br>

```
App (Pino logs + StatsD UDP) → Netdata Agent → Netdata Cloud
```

| Эндпоинт | Назначение |
|----------|------------|
| `GET /health` | Liveness-проверка |
| `GET /ready` | Readiness-проверка (с БД) |
| `GET /metrics` | Метрики приложения |

Продуктовые счётчики: `retro.board.created`, `retro.space.created`, `retro.card.created`, `retro.focus.started`, `retro.export.api`, `retro.guest.from_web`, `retro.guest.source.{google|yandex|search_other|social|direct|other}`.

**Настройка Netdata Cloud:**

1. Зарегистрируйтесь на [app.netdata.cloud](https://app.netdata.cloud)
2. Создайте Space → Room → "Connect Nodes" → Docker
3. Добавьте в `.env`:
   ```env
   NETDATA_CLAIM_TOKEN=your-claim-token
   NETDATA_CLAIM_ROOMS=your-room-id
   ```
4. `docker compose -f docker-compose.prod.yml up -d`

**Логи:**

```bash
docker compose -f docker-compose.prod.yml logs app -f
```

Уровень: `LOG_LEVEL` (default: `info`). Rotation: 3 файла × 10MB.

</details>

---

## Стек

<table>
<tr>
<td align="center"><img src="https://svelte.dev/favicon.png" width="24" /><br><b>SvelteKit</b></td>
<td align="center"><img src="https://raw.githubusercontent.com/tailwindlabs/tailwindcss/HEAD/.github/logo-light.svg" width="24" /><br><b>Tailwind</b></td>
<td align="center"><img src="https://socket.io/images/logo.svg" width="24" /><br><b>Socket.IO</b></td>
<td align="center"><img src="https://www.postgresql.org/media/img/about/press/elephant.png" width="24" /><br><b>PostgreSQL</b></td>
<td align="center"><img src="https://vitest.dev/logo.svg" width="24" /><br><b>Vitest</b></td>
<td align="center"><img src="https://playwright.dev/img/playwright-logo.svg" width="24" /><br><b>Playwright</b></td>
<td align="center"><img src="https://github.githubassets.com/favicons/favicon-dark.svg" width="24" /><br><b>Actions</b></td>
</tr>
</table>

Svelte 5 (runes) · Tailwind 4 · Drizzle ORM · Sharp · Pino · Vite 7 · adapter-node

---

## Автор

Никита Щербо — [nikita.kantiana@gmail.com](mailto:nikita.kantiana@gmail.com). Идеи и баги — в [форму обратной связи](https://retrospectrix.ru/feedback) или issues.
