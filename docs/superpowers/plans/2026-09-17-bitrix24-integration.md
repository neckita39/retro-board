# Интеграция с Битрикс24 — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Карточку ретро-доски внутри пространства можно превратить в задачу Битрикс24 через вебхук пространства; результат виден всем участникам как бейдж-ссылка.

**Architecture:** Вся логика в SvelteKit: клиент REST 3.0/legacy в `src/lib/server/bitrix.ts`, три экшена пространства, экшен `createTask` и JSON-эндпоинт проверки группы на маршруте доски. Состояние подключения — таблица `space_bitrix` (вебхук зашифрован AES-256-GCM), результат — две колонки на `cards`. Участники узнают о задаче событием `card:task` через новый канал шины `emitBoard` → комната доски в `server.js`.

**Tech Stack:** SvelteKit (Svelte 5 runes), Drizzle ORM + PostgreSQL, Socket.IO (`server.js`), Vitest, Playwright, Tailwind 4 с токенами из `src/app.css`.

**Spec:** `docs/superpowers/specs/2026-09-17-bitrix24-integration-design.md` — план аргументирует от спеки; исполнитель читает обе. Секция 5 спеки (заметки макета 1–31) обязательна для UI-задач.

## Global Constraints

- Только токены дизайн-системы (`DESIGN-SYSTEM.md`): радиусы 8/12/16/24/full, высоты 28/32/38/54, тени `shadow-1`/`shadow-2` или 1px `border-border`, никаких сырых цветов, тинтов, градиентов и `shadow-*` Tailwind.
- Все пользовательские строки через `t('key')` (клиент) / `translate(locale, key)` (сервер и чистые модули); каждый ключ добавляется и в `src/lib/i18n/en.json`, и в `src/lib/i18n/ru.json` — `dictionaries.test.ts` ловит рассинхрон.
- Слово «вебхук» допустимо только в панели пространства и в модальных текстах `bitrix.error.invalid_webhook` / `bitrix.error.scope`, которые задаёт Секция 2 спеки.
- Секрет вебхука никогда не попадает в логи, сообщения ошибок, метрики, page data, экспорт, сокет.
- Bitrix-вызовы: только POST + JSON, `redirect: 'manual'`, таймаут 15 с (30 с для загрузки файла), ошибка определяется по ключу `error` в теле, не по статусу.
- `server.js` держит свою копию схемы: новые колонки `cards`/`spaces` добавляются и в `src/lib/server/db/schema.ts`, и в `server.js`.
- Миграции — ручной SQL в `drizzle/NNNN_*.sql` с разделителем `--> statement-breakpoint`; следующий номер `0008`.
- Коммиты на русском в стиле репозитория, каждая задача заканчивается коммитом; тесты `npm test` зелёные перед каждым коммитом; `npm run check` без новых ошибок.
- Никаких `throw error()` в `createTask` и `GET /[slug]/bitrix/group` — только `fail(status, { bitrixError })` / `json(..., { status })`; клиент ветвится по `bitrixError`, никогда по статусу.

---

## Структура файлов

| Файл | Ответственность | Задача |
|---|---|---|
| `drizzle/0008_bitrix.sql` | таблица `space_bitrix`, колонки `cards.bitrix_task_id/url`, `spaces.access_token` | 1 |
| `src/lib/server/db/schema.ts` | `spaceBitrix`, новые колонки | 1 |
| `server.js` | копия схемы (1); `space:join` по `access_token` (2); ретранслятор `board` и `bitrix:opened` (7) | 1, 2, 7 |
| `src/lib/types.ts` | `Card.bitrixTaskId/Url`, `CardTask`, `BitrixInfo` | 1 |
| `src/lib/server/export.ts`, `export.test.ts` | `task` в JSON/MD | 1 |
| `src/lib/server/space-access.ts`, `space-access.test.ts` | `canViewSpace` сравнивает cookie с `access_token` | 2 |
| `src/routes/spaces/[slug]/+page.server.ts` | cookie доступа (2); экшены `bitrixConnect/Disconnect/SetGroup`, load `bitrix`/`encryptionEnabled` (5) | 2, 5 |
| `src/routes/new/+page.server.ts` | cookie доступа при создании пространства с паролем | 2 |
| `src/lib/server/crypto.ts`, `crypto.test.ts` | `encryptionEnabled` | 3 |
| `src/lib/server/bitrix.ts`, `bitrix.test.ts` | адрес, SSRF, транспорты, ошибки (3); функции портала, файл, семафор (4) | 3, 4 |
| `src/lib/server/bitrix-flows.ts`, `bitrix-flows.test.ts` | статусы видов, разбор форм, оркестрация создания задачи с внедрёнными зависимостями | 5, 8 |
| `src/lib/server/bitrix-connection.ts` | чтение/запись `space_bitrix`, расшифровка, `last_error` | 5 |
| `src/lib/server/bitrix-limits.ts` | лимитеры и `runningCards` | 5 |
| `src/lib/components/BitrixPanel.svelte` | панель пространства A1–A4 | 6 |
| `src/routes/spaces/[slug]/+page.svelte` | триггер панели, одна панель за раз, `?bitrix=1` | 6 |
| `src/lib/server/bus.ts`, `bus.test.ts` | `emitBoard` | 7 |
| `src/lib/stores/board.svelte.ts` | `bitrix`, `bitrixOffer`, `setBitrix`, `setTask` | 7 |
| `src/lib/stores/socket.svelte.ts` | `card:task`, `trackTaskOpened` | 7 |
| `src/lib/stores/bitrix-task.svelte.ts` | состояние модалки | 7 |
| `src/lib/stores/toast.svelte.ts`, `src/lib/components/Toasts.svelte` | `external` | 7 |
| `src/routes/[slug]/+page.server.ts` | load `bitrix`/`bitrixOffer`; экшен `createTask` | 8 |
| `src/routes/[slug]/bitrix/group/+server.ts` | проверка группы | 8 |
| `src/routes/[slug]/+page.svelte` | `boardStore.setBitrix` | 8 |
| `src/lib/bitrix-draft.ts`, `bitrix-draft.test.ts` | чистая сборка черновика | 9 |
| `src/lib/components/TaskBadge.svelte` | бейдж-ссылка (`md` 32 и `sm` 28) | 10 |
| `src/lib/components/BitrixTaskModal.svelte` | преформа C1–C4 | 10 |
| `src/lib/components/Card.svelte`, `SummaryRow.svelte`, `Summary.svelte`, `Board.svelte`, `Header.svelte` | точки входа | 10 |
| `src/app.css` | подсказка `.icon-tip` для иконок карточки | 10 |
| `e2e/mock-bitrix.mjs`, `e2e/bitrix.spec.ts`, `e2e/helpers.ts`, `e2e/fixtures/card.png`, `playwright.config.ts` | e2e | 11 |
| `docker-compose.yml`, `.env.example` | `ENCRYPTION_KEY` локально, флаги | 11 |
| `src/routes/changelog/+page.svelte`, `CLAUDE.md`, `DESIGN-SYSTEM.md` | документация, финальная проверка | 12 |

Порядок зависимостей: 1 → 2 → 3 → 4 → 5 → 6; 7 после 1; 8 после 4, 5, 7; 9 после 1; 10 после 6, 7, 8, 9; 11 после 10; 12 после 11; 13 последней (фоны плиток форматов, добавлена по просьбе пользователя).

## Контракт имён (обязателен для всех задач)

### Типы (`src/lib/types.ts`)

```ts
export interface CardTask { id: number; url: string }
export interface BitrixInfo {
	spaceSlug: string;
	portal: string;
	userName: string;
	groupId: number | null;
	groupName: string | null;
}
// Card получает:
bitrixTaskId: number | null;
bitrixTaskUrl: string | null;
```

### Сервер: `src/lib/server/bitrix.ts`

```ts
export type BitrixErrorKind =
	| 'invalid_url' | 'invalid_webhook' | 'scope' | 'access' | 'limit'
	| 'group' | 'rejected' | 'network' | 'timeout' | 'shape';
export class BitrixError extends Error {
	kind: BitrixErrorKind; code?: string; status?: number; field?: string;
	constructor(kind: BitrixErrorKind, message: string, extra?: { code?: string; status?: number; field?: string });
}
export interface Webhook { url: string; portal: string; userId: number } // url всегда с завершающим '/'
export function parseWebhookUrl(raw: string, opts?: { allowHttp?: boolean }): Webhook | null;
export function isBlockedHost(hostname: string): boolean; // localhost, без точки, *.local, приватные IPv4/IPv6, ::ffff:-mapped
export interface CallOptions { fetchFn?: typeof fetch; timeoutMs?: number; idempotencyKey?: string }
export async function callLegacy(webhook: Webhook, method: string, params: unknown, opts?: CallOptions): Promise<unknown>; // возвращает result
export async function callV3(webhook: Webhook, method: string, params: unknown, opts?: CallOptions): Promise<unknown>;     // возвращает result
export async function verifyWebhook(webhook: Webhook, opts?: CallOptions): Promise<{ userId: number; userName: string; timeZone: string | null; portalOffset: string | null }>;
export async function checkTasksScope(webhook: Webhook, opts?: CallOptions): Promise<void>; // бросает BitrixError('scope')
export type GroupResolution = { status: 'ok'; name: string } | { status: 'notFound' } | { status: 'noScope' };
export async function resolveGroup(webhook: Webhook, groupId: number, opts?: CallOptions): Promise<GroupResolution>;
export interface TaskFields { title: string; description: string; groupId: number | null; deadline: string | null /* YYYY-MM-DD */; important: boolean }
export function deadlineIso(date: string, timeZone: string | null, portalOffset: string | null): string; // 'YYYY-MM-DDT19:00:00+HH:MM'
export function idempotencyKey(cardId: string, fields: TaskFields): string; // sha256 hex
export async function createTask(webhook: Webhook, fields: TaskFields, tz: { timeZone: string | null; portalOffset: string | null }, key: string, opts?: CallOptions): Promise<CardTask>;
export async function tagTask(webhook: Webhook, taskId: number, opts?: CallOptions): Promise<void>;
export const IMAGE_MAX_BYTES: number; // из BITRIX_IMAGE_MAX_BYTES, default 4 * 1024 * 1024
export async function attachImage(webhook: Webhook, userId: number, taskId: number, image: { cardId: string; mimeType: string; data: Buffer }, opts?: CallOptions): Promise<void>;
```

Правила: `callLegacy` бьёт в `${webhook.url}${method}`, `callV3` — в `${webhook.url.replace('/rest/', '/rest/api/')}${method}`; оба: `POST`, `Content-Type: application/json`, `Accept: application/json`, `redirect: 'manual'`, `AbortController` с таймаутом (`opts.timeoutMs ?? 15000`); статус 3xx → `BitrixError('invalid_webhook')`; тело > 1 МБ → `shape`; тело с ключом `error` → классификация (см. таблицы спеки), иначе возвращаем `result`. В `message` никогда не попадает `webhook.url`/код.

### Сервер: `src/lib/server/bitrix-connection.ts`

```ts
export interface BitrixConnection {
	spaceId: string; portal: string; userId: number; userName: string;
	timeZone: string | null; portalOffset: string | null;
	groupId: number | null; groupName: string | null; lastError: string | null;
	webhook: Webhook | null; // null — расшифровка/парсинг не прошли (ключ сменили)
}
export async function loadConnection(spaceId: string): Promise<BitrixConnection | null>;
export async function saveConnection(input: { spaceId: string; webhookUrl: string; portal: string; userId: number; userName: string; timeZone: string | null; portalOffset: string | null; groupId: number | null; groupName: string | null }): Promise<void>; // upsert, last_error = NULL
export async function updateGroup(spaceId: string, groupId: number | null, groupName: string | null): Promise<void>;
export async function deleteConnection(spaceId: string): Promise<void>;
export async function setLastError(spaceId: string, kind: 'invalid_webhook' | 'scope' | 'access' | null): Promise<void>;
export function publicInfo(c: BitrixConnection): { portal: string; userName: string; groupId: number | null; groupName: string | null; lastError: string | null };
```

### Сервер: `src/lib/server/bitrix-limits.ts`

```ts
export const connectLimiter: RateLimiter;   // 5 / 60_000, ключ — IP
export const groupLimiter: RateLimiter;     // 30 / 60_000, ключ — IP
export const createIpLimiter: RateLimiter;  // 10 / 60_000, ключ — IP
export const createSpaceLimiter: RateLimiter; // 30 / 3_600_000, ключ — `space:${spaceId}`
export const runningCards: Set<string>;
```

### Сервер: `src/lib/server/crypto.ts`

```ts
export const encryptionEnabled: boolean; // !!encKey
```

### Сервер: `src/lib/server/bus.ts`

```ts
export function emitBoard(boardSlug: string, event: string, payload: unknown): boolean; // канал 'board'
```

### Сервер: `src/lib/server/space-access.ts`

```ts
export function canViewSpace(space: { slug: string; passwordHash: string | null; creatorToken: string; accessToken: string }, cookies: Cookies): boolean;
// без пароля — true; иначе cookie создателя === creatorToken ИЛИ cookie `retro_space_{slug}` === accessToken
```

### Формы и ответы

Экшены пространства (`/spaces/[slug]`), поля форм: `bitrixConnect` — `webhook`, `groupId`; `bitrixSetGroup` — `groupId`; `bitrixDisconnect` — без полей.
Успех: `{ bitrixAction: 'connect' | 'disconnect' | 'setGroup', bitrixSuccess: true, groupNameUnavailable?: true }`.
Отказ: `fail(status, { bitrixAction, bitrixError: kind, field?: 'webhook' | 'groupId' })`.

Экшен доски `/[slug]?/createTask`, поля: `cardId`, `title`, `description`, `groupId`, `deadline`, `important` (`on`), `source`.
Успех: `{ task: CardTask, imageAttached: boolean | null }`.
Отказ: `fail(status, { bitrixError: kind, field?: string, message?: string, task?: CardTask })` (`task` только у `exists`).
Виды ошибок экшена сверх `BitrixErrorKind`: `forbidden` 403, `not_found` 404, `not_connected` 409, `exists` 409, `running` 409, `invalid` 422, `rate_limited` 429, `encryption` 503. Статусы: 401 `invalid_webhook` · 403 `forbidden|scope|access` · 404 `not_found` · 409 `not_connected|exists|running|group` · 422 `invalid|rejected` · 429 `rate_limited` · 502 `network|timeout|shape|limit` · 503 `encryption`.

`GET /[slug]/bitrix/group?id=N` → `200 { name }` | `200 { notFound: true }` | `200 { unknown: true }` | `403 { bitrixError: 'forbidden' }` | `409 { bitrixError: 'not_connected' }` | `429 { bitrixError: 'rate_limited' }` | `400 { bitrixError: 'invalid' }`.

Page data: пространство — `bitrix: { portal, userName, groupId, groupName, lastError } | null`, `encryptionEnabled: boolean`; доска — `bitrix: BitrixInfo | null`, `bitrixOffer: boolean`, карточки с `bitrixTaskId`, `bitrixTaskUrl`.

### Сокет и шина

- Шина → `server.js`: `bus.emit('board', { boardSlug, event, payload })` → `io.to(boardSlug).emit(event, payload)`.
- Сервер → клиент: `card:task { cardId: string, task: CardTask }`.
- Клиент → сервер: `bitrix:opened { source: 'card' | 'summary', creatorToken: string }`; сервер: нет комнаты или `!isRoomCreator(creatorToken)` или `source` не из списка → `return`; иначе `metric('retro.bitrix.task.opened.' + source, 1)`.

### Клиентские сторы

```ts
// boardStore (src/lib/stores/board.svelte.ts)
bitrix = $state<BitrixInfo | null>(null);
bitrixOffer = $state(false);
setBitrix(info: BitrixInfo | null, offer: boolean): void;
setTask(cardId: string, task: CardTask): void;   // патчит карточку

// socketStore (src/lib/stores/socket.svelte.ts)
trackTaskOpened(source: 'card' | 'summary'): void; // emit bitrix:opened с currentCreatorToken
// on('card:task') → boardStore.setTask

// bitrixTaskStore (src/lib/stores/bitrix-task.svelte.ts)
current = $state<{ cardId: string; source: 'card' | 'summary' } | null>(null);
submitting = $state(false);
open(cardId: string, source: 'card' | 'summary'): void; // ставит current, submitting = false, зовёт socketStore.trackTaskOpened(source)
close(): void; // current = null, submitting = false
// Удалённую карточку и чужой card:task обрабатывает $effect внутри BitrixTaskModal (см. «Уточнения контракта»),
// а не стор: иначе цикл импортов board.svelte.ts → bitrix-task.svelte.ts → socket.svelte.ts → board.svelte.ts

// toastStore: ToastAction получает external?: boolean
```

### Компоненты

- `TaskBadge.svelte` props: `{ task: CardTask; size?: 'md' | 'sm' }` (`md` = 32px карточка/D2, `sm` = 28px строка D1); `<a target="_blank" rel="noopener">`, `data-testid="task-badge"`.
- `BitrixTaskModal.svelte` без пропсов, читает `bitrixTaskStore`, `boardStore`, монтируется один раз в `Board.svelte`; форма `data-testid="bitrix-task-form"`, кнопка отправки `data-testid="bitrix-task-submit"`.
- `BitrixPanel.svelte` props: `{ bitrix, encryptionEnabled, form, open, onclose }`; корень `data-testid="bitrix-panel"`.
- Кнопка «В задачу» на карточке: `data-testid="card-task-button"`; в фокусной строке Summary: `data-testid="summary-task-button"`; пункт меню: `data-testid="menu-bitrix-connect"`; триггер панели: `data-testid="bitrix-panel-toggle"`.

### Ключи i18n (все — в обоих словарях)

```
bitrix.panel.toggle            Битрикс24 / Bitrix24
bitrix.panel.intro             Карточки досок этого пространства можно превращать в задачи портала. Ключ вебхука хранится зашифрованно и после сохранения не показывается.
bitrix.panel.webhook           Входящий вебхук / Inbound webhook
bitrix.panel.webhookPlaceholder https://портал.bitrix24.ru/rest/1/…/
bitrix.panel.group             Группа по умолчанию (id, необязательно) / Default group (id, optional)
bitrix.panel.connect           Подключить / Connect
bitrix.panel.connecting        Проверяем… / Checking…
bitrix.panel.cancel            Отмена / Cancel
bitrix.panel.hint              Где взять: Битрикс24 → Разработчикам → Другое → Входящий вебхук. Права: Задачи, Диск, Рабочие группы соцсети.
bitrix.panel.connected         Подключено / Connected
bitrix.panel.disconnected      Отключено / Disconnected
bitrix.panel.saved             Сохранено / Saved
bitrix.panel.createdBy         Задачи создаёт: / Tasks are created by:
bitrix.panel.createdByHint     ответственный и постановщик всех задач из этого пространства / responsible and creator of every task from this space
bitrix.panel.defaultGroup      Группа по умолчанию: / Default group:
bitrix.panel.noGroup           не задана / not set
bitrix.panel.groupEmptyHint    пусто = без группы / empty = no group
bitrix.panel.save              Сохранить / Save
bitrix.panel.disconnect        Отключить / Disconnect
bitrix.panel.disconnectConfirm Нажмите ещё раз — отключить / Click again to disconnect
bitrix.panel.lastError         Вебхук перестал работать — подключите заново. / The webhook stopped working — reconnect it.
bitrix.panel.encryptionOff     На сервере не настроено шифрование, подключение недоступно. / Encryption is not configured on this server; connecting is unavailable.
bitrix.panel.groupNameUnavailable Название группы недоступно: у вебхука нет права «Рабочие группы соцсети». / Group name unavailable: the webhook lacks the Social network workgroups permission.
bitrix.menu.connect            Подключить Битрикс24 / Connect Bitrix24
bitrix.card.create             В задачу Битрикс24 / To Bitrix24 task
bitrix.card.task               Задача #{id} / Task #{id}
bitrix.card.taskTitle          Задача #{id} в Битрикс24 / Task #{id} in Bitrix24
bitrix.form.title              Задача в Битрикс24 / Bitrix24 task
bitrix.form.subtitle           {portal} · тег retro добавится автоматически / {portal} · the retro tag is added automatically
bitrix.form.close              Закрыть / Close
bitrix.form.name               Название / Title
bitrix.form.description        Описание / Description
bitrix.form.group              Группа (id) / Group (id)
bitrix.form.groupNotFound      Группа не найдена — проверьте id или очистите поле / Group not found — check the id or clear the field
bitrix.form.deadline           Срок / Deadline
bitrix.form.important          Важная задача / Important task
bitrix.form.imageNote          Картинка карточки будет прикреплена / The card image will be attached
bitrix.form.responsible        Ответственный и постановщик: {name} / Responsible and creator: {name}
bitrix.form.cancel             Отмена / Cancel
bitrix.form.submit             Создать задачу / Create task
bitrix.form.creating           Создаём… / Creating…
bitrix.form.creatingWithImage  Создаём и прикрепляем картинку… / Creating and attaching the image…
bitrix.form.retry              Повторить / Retry
bitrix.form.settingsLink       Настройки пространства → / Space settings →
bitrix.summary.create          В задачу / To task
bitrix.draft.fromRetro         Из ретро «{board}» · колонка «{column}» / From retro “{board}” · column “{column}”
bitrix.draft.fromAnalysis      Из AI-анализа «{board}» / From AI analysis “{board}”
bitrix.draft.author            Автор: {name} / Author: {name}
bitrix.draft.votes             голосов: {n} / votes: {n}
bitrix.draft.against           против: {n} / against: {n}
bitrix.draft.comments          Комментарии: / Comments:
bitrix.draft.anonymous         Аноним / Anonymous
bitrix.draft.photoCard         Карточка из ретро «{board}» / Card from retro “{board}”
bitrix.error.invalid_url       (панель) Это не похоже на входящий вебхук. Нужна ссылка вида https://портал.bitrix24.ru/rest/1/…/
bitrix.error.invalid_webhook   Вебхук больше не работает — портал отклонил запрос. / The webhook no longer works — the portal rejected the request.
bitrix.error.invalid_webhook_panel Портал отклонил вебхук. Проверьте, что он не удалён и не истёк. / The portal rejected the webhook. Check it hasn't been deleted or expired.
bitrix.error.scope             У вебхука нет права «Задачи». Добавьте права Задачи, Диск и Рабочие группы соцсети и попробуйте снова. / The webhook lacks the Tasks permission. Add Tasks, Drive and Social network workgroups, then try again.
bitrix.error.access            Портал отказал: проверьте тариф и права или обратитесь в поддержку Битрикс24. / The portal refused: check your plan and permissions or contact Bitrix24 support.
bitrix.error.limit             Портал перегружен, попробуйте через минуту. / The portal is overloaded, try again in a minute.
bitrix.error.group             Группа не найдена или недоступна. / Group not found or unavailable.
bitrix.error.rejected          Портал отклонил задачу: {message} / The portal rejected the task: {message}
bitrix.error.network           Портал не отвечает. Задача не создана — проверьте связь и попробуйте ещё раз. / The portal isn't responding. The task was not created — check the connection and try again.
bitrix.error.network_panel     Портал не отвечает. Попробуйте через минуту. / The portal isn't responding. Try again in a minute.
bitrix.error.timeout           = network
bitrix.error.shape             Непонятный ответ портала. Попробуйте ещё раз. / Unexpected reply from the portal. Try again.
bitrix.error.forbidden         Нет прав создавать задачи с этой доски. / You can't create tasks from this board.
bitrix.error.not_found         Карточка удалена — задача не создана. / The card was deleted — no task was created.
bitrix.error.not_connected     Битрикс24 не подключён к этому пространству. / Bitrix24 is not connected to this space.
bitrix.error.running           Задачу уже создаёт другой ведущий — подождите. / Another facilitator is already creating this task — please wait.
bitrix.error.invalid           Проверьте поля формы. / Check the form fields.
bitrix.error.rate_limited      Лимит: 30 задач в час на пространство и 10 в минуту. Попробуйте позже. / Limit: 30 tasks per hour per space and 10 per minute. Try again later.
bitrix.error.rate_limited_panel Слишком много попыток. Попробуйте через минуту. / Too many attempts. Try again in a minute.
bitrix.error.encryption        На сервере не настроено шифрование, подключение недоступно. / Encryption is not configured on this server; connecting is unavailable.
bitrix.toast.created           Задача #{id} создана / Task #{id} created
bitrix.toast.createdNoImage    Задача #{id} создана, картинка не прикреплена / Task #{id} created, the image was not attached
bitrix.toast.open              Открыть / Open
bitrix.toast.cardGone          Карточка удалена — задача не создана / The card was deleted — no task was created
bitrix.toast.error             Не удалось создать задачу / Could not create the task
apiExport.task                 Задача / Task
```

### Метрики (StatsD, `metric(name, value, type)`)

`retro.bitrix.task.opened.{card|summary}`, `retro.bitrix.task.requested`, `retro.bitrix.task.created.{card|summary|other}`, `retro.bitrix.task.duration_ms` (`ms`), `retro.bitrix.task.failed.{kind}`, `retro.bitrix.task.image_attached`, `retro.bitrix.task.image_failed`, `retro.bitrix.task.image_skipped`, `retro.bitrix.task.tag_failed`, `retro.bitrix.task.orphaned`, `retro.bitrix.connected`, `retro.bitrix.connect_failed.{kind}`, `retro.bitrix.disconnected`.

---

### Сервер: `src/lib/server/bitrix-flows.ts` (чистый модуль, без БД и `$env`)

```ts
import type { BitrixErrorKind, TaskFields, Webhook, CallOptions } from './bitrix.js';
import type { CardTask } from '$lib/types.js';
export type ActionErrorKind = BitrixErrorKind | 'forbidden' | 'not_found' | 'not_connected' | 'exists' | 'running' | 'invalid' | 'rate_limited' | 'encryption';
export function statusForKind(kind: ActionErrorKind): number; // таблица статусов из «Формы и ответы»
export function persistsLastError(kind: ActionErrorKind): kind is 'invalid_webhook' | 'scope' | 'access';
export function parseGroupId(raw: FormDataEntryValue | string | null | undefined): number | null | 'invalid'; // '' / null → null; целое > 0 → число; иначе 'invalid'
export type TaskSource = 'card' | 'summary' | 'other';
export type ParsedTaskForm =
	| { ok: true; cardId: string; fields: TaskFields; source: TaskSource }
	| { ok: false; field: 'cardId' | 'title' | 'description' | 'groupId' | 'deadline' };
export function parseTaskForm(form: FormData): ParsedTaskForm; // title: trim, 1..250; description ≤ 20000; deadline '' или валидная YYYY-MM-DD; important === 'on'; source вне {card,summary} → 'other'

export interface CreateTaskDeps {
	webhook: Webhook;
	connection: { userId: number; timeZone: string | null; portalOffset: string | null };
	card: { id: string; imageId: string | null };
	fields: TaskFields;
	source: TaskSource;
	callOpts?: CallOptions;
	saveTask(cardId: string, task: CardTask): Promise<boolean>; // UPDATE ... WHERE bitrix_task_id IS NULL; false — 0 строк
	imageSize(imageId: string): Promise<number | null>;          // octet_length без чтения байтов; null — нет строки
	loadImage(imageId: string): Promise<{ mimeType: string; data: Buffer } | null>;
	emit(cardId: string, task: CardTask): void;                   // emitBoard(slug, 'card:task', ...)
	metric(name: string, value: number, type?: string): void;
	now(): number;
}
export type CreateTaskOutcome =
	| { ok: true; task: CardTask; imageAttached: boolean | null }
	| { ok: false; kind: ActionErrorKind; field?: string; message?: string };
export async function createTaskFlow(deps: CreateTaskDeps): Promise<CreateTaskOutcome>;
// Порядок: createTask (ключ idempotencyKey(card.id, fields)) → saveTask (false → metric orphaned, {ok:false, kind:'not_found'})
// → tagTask (ошибка → metric tag_failed) → если imageId: imageSize > IMAGE_MAX_BYTES → image_skipped, false; иначе loadImage + attachImage (ошибка → image_failed, false; успех → image_attached, true)
// → metric created.{source} + duration_ms → emit → {ok:true}. BitrixError из createTask → {ok:false, kind, field, message}.
```

`parseTaskForm`, `parseGroupId`, `statusForKind` и `createTaskFlow` задаются в задаче 5 (первые три) и задаче 8 (`createTaskFlow`, дописывается в тот же файл).

## Уточнения контракта

- **Модалка и исчезнувшая карточка.** `BitrixTaskModal.svelte` держит `$effect`: если `bitrixTaskStore.current` не null, а карточки `current.cardId` нет в `boardStore.cards` — при `!submitting` модалка закрывается и показывает тост `error` `bitrix.toast.cardGone`; при `submitting` ничего не делает. Второй `$effect`: если у текущей карточки появился `bitrixTaskId`, а модалка не в состоянии отправки — закрыться без тоста (задачу создал другой ведущий).
- **Импорты сторов без циклов:** `bitrix-task.svelte.ts` импортирует `socket.svelte.ts`; `socket.svelte.ts` и `board.svelte.ts` не импортируют `bitrix-task.svelte.ts`.
- **Интерполяция i18n:** `translate(locale, key, params)` заменяет `{name}`; формы множественного числа — через `|` при параметре `n` (`голос|голоса|голосов`). Алиасов нет: одинаковый текст пишется в каждый ключ отдельно (`bitrix.error.timeout` = текст `bitrix.error.network`).
- **Владение ключами i18n** (каждая задача добавляет в `en.json` и `ru.json` только свои ключи, тексты берутся из списка выше):
  - задача 1: `apiExport.task`;
  - задача 6: `bitrix.panel.*`, все `bitrix.error.*` (включая `_panel`-варианты), `bitrix.menu.connect`;
  - задача 9: `bitrix.draft.*` (`bitrix.draft.votes` = `голос: {n}|голоса: {n}|голосов: {n}` → лучше `{n} голос|{n} голоса|{n} голосов`, EN `{n} vote|{n} votes`; `against` — «против: {n}» без форм множественного числа);
  - задача 10: `bitrix.card.*`, `bitrix.form.*`, `bitrix.summary.*`, `bitrix.toast.*`.
- **Ключи тостов:** `bitrix.toast.forbidden/notFound` из спеки заменены на `bitrix.error.forbidden/not_found`; `bitrix.toast.error` — тост для `result.type === 'error'` (решение C9).
- **Тесты без БД.** Юнит-тесты — только чистые модули (`bitrix.ts` через `fetchFn`, `bitrix-flows.ts` через deps, `bitrix-draft.ts`, `bus.ts`, `crypto.ts`, `space-access.ts` через фейковые cookies, `export.ts`). Экшены и эндпоинты — тонкие обёртки, их покрывает e2e (задача 11).
- **Команды:** `npm test` (все юнит-тесты), `npx vitest run src/lib/server/bitrix.test.ts` (один файл), `npm run check`, `npm run build`, e2e `docker compose up -d db && npm run test:e2e` (или `npx playwright test e2e/bitrix.spec.ts`).

## Добавки к контракту от авторов задач

Эти имена появились при расписывании задач; они обязательны так же, как контракт выше. Подробности — в «Interfaces» соответствующей задачи.

**Задача 1**

- src/lib/server/db/schema.ts: export const spaceBitrix = pgTable('space_bitrix', { spaceId: uuid PK → spaces.id ON DELETE CASCADE; webhookEnc: text notNull; portal: text notNull; userId: integer notNull; userName: text notNull; timeZone: text | null; portalOffset: text | null; groupId: integer | null; groupName: text | null; connectedAt: timestamptz notNull defaultNow; lastError: text | null }) — в контракте только упомянута в таблице файлов, здесь с точными полями
- src/lib/server/db/schema.ts и server.js: spaces.accessToken: text('access_token').notNull().default(sql`gen_random_uuid()::text`) — при insert через Drizzle поле необязательно
- src/lib/server/db/schema.ts и server.js: cards.bitrixTaskId: integer('bitrix_task_id') (number | null), cards.bitrixTaskUrl: text('bitrix_task_url') (string | null)
- src/lib/server/export.ts: ExportCard.task: CardTask | null (поле есть у каждой карточки JSON-экспорта; стоит между imageUrl и createdAt)
- Формат Markdown-экспорта: строка задачи `  [${translate(lang, 'apiExport.task')} #${task.id}](${task.url})` сразу после строки картинки и перед комментариями, например `  [Task #745181](https://…)`

**Задача 3**

- src/lib/server/bitrix.ts: export async function bitrixRequest(webhook: Webhook, method: string, params: unknown, api: 'legacy' | 'v3', opts?: CallOptions): Promise<{ result: unknown; time?: { date_finish?: string } }> — весь разобранный ответ после проверки ошибок. callLegacy и callV3 — обёртки, которые возвращают из него .result. Задача 4 берёт portalOffset из time.date_finish ответа profile.
- src/lib/server/bitrix.ts: export function classifyBitrixError(body: Record<string, unknown>, status: number, api: 'legacy' | 'v3', secret?: string): BitrixError — раскладывает тело с ключом error по видам (без контекстного group). secret — код вебхука: его вхождения в тексте портала заменяются на '***' до обрезки до 300 символов. Экспортирована для тестов.

**Задача 4**

- src/lib/server/bitrix.ts: export function withUploadSlot<T>(fn: () => Promise<T>): Promise<T> — семафор уровня модуля на одну загрузку в Битрикс24 (цепочка промисов). Упавшая работа освобождает слот и возвращает свою ошибку. Задача 8 захватывает слот до чтения байтов картинки: withUploadSlot(async () => { const img = await deps.loadImage(imageId); if (img) await attachImage(webhook, userId, taskId, { cardId, ...img }, callOpts); })
- src/lib/server/bitrix.ts: TaskFields и GroupResolution объявляются в задаче 4 (в контракте они есть, но задача 3 их не объявляет). Если задача 3 их уже объявила, дублировать нельзя

**Задача 5**

- src/lib/server/bitrix-connection.ts: export function toConnection(row: typeof spaceBitrix.$inferSelect, decryptFn: (data: string) => string | null, allowHttpUrls?: boolean): BitrixConnection — чистое преобразование строки в подключение (decrypt → parseWebhookUrl, иначе webhook: null); loadConnection передаёт decrypt и process.env.BITRIX_ALLOW_HTTP === '1'
- ~~BITRIX_LIMIT_MULTIPLIER~~ — снято решением C1 предполётной проверки: e2e разводит лимиты заголовком x-forwarded-for, флаг не нужен.
- Семантика publicInfo (сигнатура не меняется): lastError = c.lastError ?? (c.webhook ? null : 'invalid_webhook') — нерасшифрованный вебхук показывается панели как invalid_webhook
- Семантика statusForKind: 'invalid_url' → 422 (в таблице статусов спеки вида нет)
- Семантика parseTaskForm (сигнатура не меняется): cardId обязан быть UUID и приводится к нижнему регистру; в description \r\n и \r заменяются на \n до проверки лимита 20 000; значения-файлы считаются пустыми полями. parseGroupId принимает только 1..2147483647 (integer в Postgres)
- Логи экшенов пространства: console.warn(JSON.stringify({ event: 'bitrix:connect_failed' | 'bitrix:set_group_failed', space, kind, code, status })) и console.info({ event: 'bitrix:connected', space, portal }) — без адреса и кода вебхука

**Задача 6**

- src/lib/bitrix-panel.ts: export function panelErrorKey(kind: string): string — timeout/shape/limit сводятся к network, дальше bitrix.error.{kind}_panel если ключ есть в словаре, иначе bitrix.error.{kind}, для неизвестного вида bitrix.error.network_panel
- src/lib/bitrix-panel.ts: export function panelSuccessKey(action: string | null | undefined): string | null — connect → bitrix.panel.connected, disconnect → bitrix.panel.disconnected, setGroup → bitrix.panel.saved, иначе null
- Тест src/lib/bitrix-panel.test.ts (новый файл задачи 6, в таблице файлов плана его нет, как и bitrix-panel.ts)
- DOM-контракт для e2e (задача 11) и меню (задача 10): корень панели id="bitrix-panel" (на него ссылается aria-controls триггера); поле вебхука id="bitrix-webhook" (его фокусирует ?bitrix=1); поле группы в форме подключения id="bitrix-group"; инлайн-правка группы id="bitrix-group-edit"; доступные имена EN: «Inbound webhook», «Default group (id, optional)», кнопки «Connect» / «Cancel» / «Disconnect» → «Click again to disconnect» / «Save», заголовок h2 «Bitrix24 · {portal}»
- BitrixPanel prop form типизирован как { bitrixAction?: string; bitrixSuccess?: boolean; bitrixError?: string; field?: string; groupNameUnavailable?: boolean } | null | undefined, страница передаёт ActionData как есть

**Задача 8**

- src/lib/server/bitrix-flows.ts: export function canCreateTask(board: { slug: string; creatorToken: string }, space: { slug: string; passwordHash: string | null; creatorToken: string; accessToken: string }, cookies: Cookies): boolean — (cookie retro_creator_{board.slug} === board.creatorToken, токен непустой) ИЛИ (cookie retro_space_creator_{space.slug} === space.creatorToken, токен непустой), И canViewSpace(space, cookies). Общая проверка прав для экшена createTask и GET /[slug]/bitrix/group, покрыта юнит-тестами.
- src/lib/server/bitrix.ts (задача 4 должна экспортировать): export async function withUploadSlot<T>(fn: () => Promise<T>): Promise<T> — модульный семафор на одну загрузку в процессе, таймаут 30 с считается с постановки в очередь, по таймауту бросает BitrixError('timeout'). attachImage сам слот НЕ берёт: createTaskFlow оборачивает в слот loadImage + attachImage, иначе будет взаимная блокировка.

**Задача 9**

- src/lib/bitrix-draft.ts: export interface DraftInput { card: { content: string; authorName: string | null; imageId: string | null }; board: { title: string; slug: string; format: string }; columnTitle: string | null; comments: { authorName: string | null; content: string; imageId: string | null }[]; likes: number; dislikes: number; origin: string; locale: Locale } (Locale из $lib/i18n/index.js)
- src/lib/bitrix-draft.ts: export function buildTaskDraft(input: DraftInput): { title: string; description: string }
- i18n-ключ bitrix.draft.fromRetroNoColumn: ru «Из ретро «{board}»» / en «From retro “{board}”». Строка источника при columnTitle === null на обычной доске
- Уточнение текстов в контракте: bitrix.draft.votes = «{n} голос|{n} голоса|{n} голосов» / «{n} vote|{n} votes» (вместо «голосов: {n}» / «votes: {n}» в общем списке); bitrix.draft.against = «против: {n}» / «against: {n}» без форм множественного числа

**Задача 10**

- src/lib/bitrix-task-result.ts: export type TaskFormField = 'title' | 'description' | 'groupId' | 'deadline'
- src/lib/bitrix-task-result.ts: export interface TaskFormReaction { type: 'form'; errorKey: string | null; params: Record<string, string>; settings: boolean; retry: boolean; field: TaskFormField | null; groupNotFound: boolean }
- src/lib/bitrix-task-result.ts: export type TaskReaction = { type: 'created'; task: CardTask; toastKey: 'bitrix.toast.created' | 'bitrix.toast.createdNoImage' } | { type: 'exists'; task: CardTask | null } | { type: 'closeWithToast'; toastKey: string } | { type: 'toast'; toastKey: string } | TaskFormReaction
- src/lib/bitrix-task-result.ts: export function taskResultReaction(result: ActionResult): TaskReaction | null — таблица реакций на ответ createTask, ветвление только по bitrixError; redirect → null
- src/app.css: CSS-класс .icon-tip (подсказка ::after из aria-label, опора — relative на группе иконок); уже упомянут в таблице файлов, но не как имя

**Задача 11**

- e2e/helpers.ts: createBoardInSpace(page: Page, spaceSlug: string, title: string): Promise<{ slug: string; adminUrl: string }> — было Promise<string>; adminUrl = `${origin}/${slug}?admin=${cookie retro_creator_{slug}}`
- e2e/helpers.ts: export const BITRIX_MOCK = 'http://localhost:4779'
- e2e/helpers.ts: export const BITRIX_WEBHOOK = 'http://localhost:4779/rest/1/testcode/'
- e2e/helpers.ts: export const CARD_PNG = 'e2e/fixtures/card.png'
- e2e/helpers.ts: export async function addCardWithImage(page: Page, columnName: string, text: string, fixture: string = CARD_PNG): Promise<void>
- e2e/helpers.ts: export async function openBitrixPanel(page: Page): Promise<Locator> — кликает bitrix-panel-toggle, пока aria-expanded не станет 'true'; возвращает getByTestId('bitrix-panel')
- e2e/helpers.ts: export async function connectBitrix(page: Page, spaceUrl: string, opts?: { group?: number }): Promise<Locator> — ждёт в панели текст владельца 'Ivan Petrov'
- e2e/helpers.ts: export async function openCardTaskModal(page: Page, cardText: string): Promise<Locator> — возвращает getByTestId('bitrix-task-form')
- e2e/mock-bitrix.mjs: POST /__mode { mode: 'ok'|'invalid_webhook'|'scope'|'disk_fail'|'error'|'delay', delayMs?: number } (для delay по умолчанию 2000 мс); GET /__calls → Array<{ method: string /* в нижнем регистре */, api: boolean, userId: number, body: unknown, headers: Record<string,string>, status: number, response: unknown }>; POST /__reset; GET /health
- e2e/mock-bitrix.mjs: владелец вебхука — profile { ID: '1', NAME: 'Ivan', LAST_NAME: 'Petrov', TIME_ZONE: 'Europe/Kaliningrad' }, time.date_finish с '+02:00'; группы { 42: 'Платформа' }; хранилище ID 11; mode error = 503 QUERY_LIMIT_EXCEEDED (вид limit); scope = insufficient_scope для tasks.*; disk_fail = insufficient_scope для disk.*
- playwright.config.ts: env приложения BITRIX_ALLOW_HTTP: '1' и ADDRESS_HEADER: 'x-forwarded-for'; use.extraHTTPHeaders: { 'x-forwarded-for': '127.0.0.1' }; третий webServer 'node e2e/mock-bitrix.mjs' на http://localhost:4779/health
- .gitignore: !e2e/fixtures/*.png (иначе *.png не даёт закоммитить фикстуру)
- Крючки разметки, на которые опирается e2e (по спеке, в контракте явно не перечислены): aria-expanded на bitrix-panel-toggle; input[name="webhook"] и input[name="groupId"] внутри bitrix-panel; скрытые input[name="cardId"] и input[name="source"] внутри bitrix-task-form; error-box с role="alert" внутри role="dialog" преформы; ссылка «Space settings →» с href '/spaces/{slug}?bitrix=1'; текст bitrix-task-submit меняется на bitrix.form.creatingWithImage или bitrix.form.retry; ссылка «Open» в тосте задачи с target="_blank"

---

### Task 1: Данные — миграция, схемы, типы, экспорт

**Files:**
- Create: `drizzle/0008_bitrix.sql`
- Modify: `src/lib/server/db/schema.ts` (импорт `sql` после строки 1; таблица `spaces`, строки 11–20; новая таблица `spaceBitrix` сразу после `spaceAnalyses`, то есть после строки 52; таблица `cards`, строки 63–74)
- Modify: `server.js` (копия схемы: `spaces` на строках 52–60, `cards` на строках 81–89)
- Modify: `src/lib/types.ts` (`Card` на строках 14–24; новые `CardTask`, `BitrixInfo` сразу после `Card`)
- Modify: `src/lib/server/export.ts` (импорты на строках 1–7; `ExportCard` на строках 19–27; `CardRow` на строках 41–48; объект карточки в `assembleExport` на строках 79–80; `toMarkdown` на строках 138–140)
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/ru.json` (после `apiExport.dislikes`, строка 129)
- Modify: `src/lib/stores/board.test.ts` (фикстура `makeCard`, строки 16–29)
- Modify: `src/lib/server/space-export.test.ts` (литерал `BoardExport`, строка 46)
- Test: `src/lib/server/export.test.ts`

**Interfaces:**
- Consumes: ничего из других задач. Существующие `translate(locale, key, params)` из `$lib/i18n/index.js`, `migrate.js` (применяет `drizzle/*.sql` по имени файла, режет по `--> statement-breakpoint`, без транзакции).
- Produces:
  - Таблица `space_bitrix` и Drizzle-таблица `spaceBitrix` в `src/lib/server/db/schema.ts` с полями `spaceId: string` (PK, FK → `spaces.id` ON DELETE CASCADE), `webhookEnc: string`, `portal: string`, `userId: number`, `userName: string`, `timeZone: string | null`, `portalOffset: string | null`, `groupId: number | null`, `groupName: string | null`, `connectedAt: Date` (default now), `lastError: string | null`. Использует задача 5 (`bitrix-connection.ts`).
  - `spaces.accessToken: string`: NOT NULL, в БД default `gen_random_uuid()::text`, при insert через Drizzle поле необязательно. Использует задача 2 (`canViewSpace`, `space:join`, `enablePassword`). В page data, сокет и экспорт токен не попадает: все load проецируют строку пространства явно, так и оставить.
  - `cards.bitrixTaskId: number | null`, `cards.bitrixTaskUrl: string | null`, те же поля в копии `cards` в `server.js`. `decryptCard` в `server.js` разворачивает строку целиком (`{ ...card }`), а `src/routes/[slug]/+page.server.ts` — через `...c`, поэтому `board:state`, `card:created`, `card:updated` и page data доски получают поля без правки обработчиков. Использует задача 8 (`saveTask`: `UPDATE … WHERE bitrix_task_id IS NULL`).
  - Типы в `src/lib/types.ts`: `interface CardTask { id: number; url: string }`, `interface BitrixInfo { spaceSlug: string; portal: string; userName: string; groupId: number | null; groupName: string | null }`, `Card.bitrixTaskId: number | null`, `Card.bitrixTaskUrl: string | null`. Используют задачи 7–10.
  - `ExportCard.task: CardTask | null` в `src/lib/server/export.ts`. В JSON поле есть у каждой карточки. В Markdown под карточкой (после строки картинки, перед комментариями) идёт строка `  [Task #745181](https://…)` / `  [Задача #745181](https://…)`. Её проверяет e2e задачи 11 (тест 8, «Экспорт JSON содержит `task`»).
  - Ключ i18n `apiExport.task`: `Task` / `Задача`.

- [ ] **Step 1: Write the failing test**

В `src/lib/server/export.test.ts` фикстуры строк получают новые колонки. Сначала массив `cardRows` на строках 11–28.

Было:
```ts
const cardRows = [
	{
		id: 'c1',
		columnType: 'went_well',
		content: 'CI is green',
		authorName: 'Maria',
		imageId: 'img-1',
		createdAt: new Date('2026-07-01T10:00:00Z')
	},
	{
		id: 'c2',
		columnType: 'improve',
		content: 'Fewer meetings',
		authorName: null,
		imageId: null,
		createdAt: new Date('2026-07-01T11:00:00Z')
	}
];
```

Стало:
```ts
const cardRows = [
	{
		id: 'c1',
		columnType: 'went_well',
		content: 'CI is green',
		authorName: 'Maria',
		imageId: 'img-1',
		bitrixTaskId: null,
		bitrixTaskUrl: null,
		createdAt: new Date('2026-07-01T10:00:00Z')
	},
	{
		id: 'c2',
		columnType: 'improve',
		content: 'Fewer meetings',
		authorName: null,
		imageId: null,
		bitrixTaskId: null,
		bitrixTaskUrl: null,
		createdAt: new Date('2026-07-01T11:00:00Z')
	}
];
```

Затем в `describe('экспорт не-классического формата', …)` строка 106.

Было:
```ts
		{ id: 'c1', columnType: 'rocks', content: 'legacy auth expires', authorName: null, imageId: null, createdAt: new Date('2026-07-01T10:00:00Z') }
```

Стало:
```ts
		{ id: 'c1', columnType: 'rocks', content: 'legacy auth expires', authorName: null, imageId: null, bitrixTaskId: null, bitrixTaskUrl: null, createdAt: new Date('2026-07-01T10:00:00Z') }
```

В конец файла дописать:
```ts

describe('задача Битрикс24 в экспорте', () => {
	const TASK_URL = 'https://bitrix24.team/workgroups/group/2014/tasks/task/view/745181/';
	const rows = [{ ...cardRows[0], bitrixTaskId: 745181, bitrixTaskUrl: TASK_URL }, cardRows[1]];

	it('JSON: у карточки с задачей task = { id, url }, у карточки без задачи — null', () => {
		const data = assembleExport(board, rows, [], [], ORIGIN);
		expect(data.columns.went_well[0].task).toEqual({ id: 745181, url: TASK_URL });
		expect(data.columns.improve[0].task).toBeNull();
	});

	it('JSON: id без ссылки задачей не считается', () => {
		const data = assembleExport(board, [{ ...cardRows[1], bitrixTaskId: 7, bitrixTaskUrl: null }], [], [], ORIGIN);
		expect(data.columns.improve[0].task).toBeNull();
	});

	it('Markdown: строка со ссылкой под карточкой — после картинки, перед комментариями', () => {
		const md = toMarkdown(assembleExport(board, rows, [], commentRows, ORIGIN), 'en');
		expect(md).toContain(
			`- CI is green — *Maria*\n  ![image](https://x.test/api/image/img-1)\n  [Task #745181](${TASK_URL})\n  - Huge relief! — *Peter*\n`
		);
		expect(md.match(/\[Task #/g)).toHaveLength(1);
	});

	it('Markdown: подпись строки задачи на русском', () => {
		const md = toMarkdown(assembleExport(board, rows, [], [], ORIGIN), 'ru');
		expect(md).toContain(`  [Задача #745181](${TASK_URL})\n`);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/export.test.ts`
Expected: FAIL, `Tests 4 failed | 6 passed (10)`. Шесть старых тестов зелёные, падают четыре новых:
- `JSON: у карточки с задачей…`: `AssertionError: expected undefined to deeply equal { id: 745181, …(1) }`;
- `JSON: id без ссылки…`: `AssertionError: expected undefined to be null`;
- оба Markdown-теста: `expected '# Sprint 42\n\n*Exported: …' to contain '- CI is green — *Maria*\n  ![image](h…'` (у русского — `to contain '  [Задача #745181](https://bitrix24.t…'`).

- [ ] **Step 3: Типы `CardTask`, `BitrixInfo` и поля карточки**

В `src/lib/types.ts` заменить интерфейс `Card` (строки 14–24) на блок ниже. Он включает сам `Card` и два новых интерфейса сразу за ним:

```ts
export interface Card {
	id: string;
	boardId: string;
	columnType: ColumnType;
	content: string;
	authorName: string | null;
	imageId: string | null;
	imageWidth: number | null;
	imageHeight: number | null;
	/** Задача Битрикс24, созданная из карточки; null — задачи нет */
	bitrixTaskId: number | null;
	bitrixTaskUrl: string | null;
	createdAt: string;
}

/** Задача Битрикс24 карточки: id на портале и готовая ссылка на неё */
export interface CardTask {
	id: number;
	url: string;
}

/** Подключение Битрикс24 пространства для преформы на доске — без секрета вебхука */
export interface BitrixInfo {
	spaceSlug: string;
	portal: string;
	userName: string;
	groupId: number | null;
	groupName: string | null;
}
```

- [ ] **Step 4: Поле `task` в экспорте**

В `src/lib/server/export.ts` нужно пять правок.

1) Импорты: после строки `import { findBoardFormat } from '$lib/formats.js';` добавить
```ts
import type { CardTask } from '$lib/types.js';
```

2) `ExportCard`.

Было:
```ts
	imageUrl: string | null;
	createdAt: string;
	comments: ExportComment[];
}
```

Стало:
```ts
	imageUrl: string | null;
	/** Задача Битрикс24 карточки; null — задачи нет */
	task: CardTask | null;
	createdAt: string;
	comments: ExportComment[];
}
```

3) `CardRow` (структурный тип строки Drizzle).

Было:
```ts
	imageId: string | null;
	createdAt: Date;
}
interface VoteRow {
```

Стало:
```ts
	imageId: string | null;
	bitrixTaskId: number | null;
	bitrixTaskUrl: string | null;
	createdAt: Date;
}
interface VoteRow {
```

4) `assembleExport`: объект карточки внутри `.map((card) => ({ … }))`, отступ 4 таба.

Было:
```ts
				imageUrl: imageUrl(card.imageId),
				createdAt: card.createdAt.toISOString(),
```

Стало:
```ts
				imageUrl: imageUrl(card.imageId),
				task:
					card.bitrixTaskId !== null && card.bitrixTaskUrl
						? { id: card.bitrixTaskId, url: card.bitrixTaskUrl }
						: null,
				createdAt: card.createdAt.toISOString(),
```

5) `toMarkdown`: строка задачи между картинкой и комментариями.

Было:
```ts
			if (card.imageUrl) {
				md += `  ![image](${card.imageUrl})\n`;
			}

			for (const comment of card.comments) {
```

Стало:
```ts
			if (card.imageUrl) {
				md += `  ![image](${card.imageUrl})\n`;
			}

			if (card.task) {
				md += `  [${translate(lang, 'apiExport.task')} #${card.task.id}](${card.task.url})\n`;
			}

			for (const comment of card.comments) {
```

`space-export.ts` не меняется: `loadSpaceAnalyses` передаёт в `assembleExport` полные строки `db.select().from(cards)`, и новые колонки в них уже есть.

- [ ] **Step 5: Ключ `apiExport.task` в обоих словарях**

`src/lib/i18n/en.json`.

Было:
```json
	"apiExport.dislikes": "{n} dislike|{n} dislikes",

	"export.api": "API for agents",
```

Стало:
```json
	"apiExport.dislikes": "{n} dislike|{n} dislikes",
	"apiExport.task": "Task",

	"export.api": "API for agents",
```

`src/lib/i18n/ru.json`.

Было:
```json
	"apiExport.dislikes": "{n} дизлайк|{n} дизлайка|{n} дизлайков",

	"export.api": "API для агентов",
```

Стало:
```json
	"apiExport.dislikes": "{n} дизлайк|{n} дизлайка|{n} дизлайков",
	"apiExport.task": "Задача",

	"export.api": "API для агентов",
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/server/export.test.ts`
Expected: PASS, `Tests 10 passed (10)`.

- [ ] **Step 7: Миграция `drizzle/0008_bitrix.sql`**

Создать файл:

```sql
CREATE TABLE IF NOT EXISTS "space_bitrix" (
	"space_id" uuid PRIMARY KEY NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
	"webhook_enc" text NOT NULL,
	"portal" text NOT NULL,
	"user_id" integer NOT NULL,
	"user_name" text NOT NULL,
	"time_zone" text,
	"portal_offset" text,
	"group_id" integer,
	"group_name" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "bitrix_task_id" integer;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "bitrix_task_url" text;
--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "access_token" text DEFAULT gen_random_uuid()::text NOT NULL;
```

Почему так:
- `gen_random_uuid()` встроен в PostgreSQL 13+ и уже используется в `0000` и `0006`.
- Это волатильный DEFAULT, поэтому `ADD COLUMN` переписывает таблицу и вычисляет значение для каждой строки: бэкфилл получает разные токены, а не один общий.
- Все четыре оператора идемпотентны (`IF NOT EXISTS`). `migrate.js` не оборачивает файл в транзакцию, поэтому после частичного падения повторный запуск безопасен.

- [ ] **Step 8: Drizzle-схема `src/lib/server/db/schema.ts`**

1) Сразу после строки 1 (`import { pgTable, … } from 'drizzle-orm/pg-core';`) добавить:
```ts
import { sql } from 'drizzle-orm';
```

2) Таблицу `spaces` (строки 11–20) заменить на:
```ts
export const spaces = pgTable('spaces', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull(),
	passwordHash: text('password_hash'),
	creatorToken: text('creator_token').notNull().default(''),
	// Формат последней созданной здесь доски — предвыбор для следующей
	lastFormat: text('last_format'),
	// Значение cookie доступа к закрытому пространству; новое при каждом включении пароля
	accessToken: text('access_token').notNull().default(sql`gen_random_uuid()::text`),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
```

3) Между концом `spaceAnalyses` (строка 52, `});`) и `export const images` вставить:
```ts

// Подключение Битрикс24: одна строка на пространство. Секрет — только код вебхука,
// он живёт внутри шифротекста webhook_enc; хост и id владельца не секрет.
export const spaceBitrix = pgTable('space_bitrix', {
	spaceId: uuid('space_id')
		.primaryKey()
		.references(() => spaces.id, { onDelete: 'cascade' }),
	webhookEnc: text('webhook_enc').notNull(),
	portal: text('portal').notNull(),
	userId: integer('user_id').notNull(),
	userName: text('user_name').notNull(),
	// IANA-зона из profile.TIME_ZONE; NULL, если портал вернул пустую строку
	timeZone: text('time_zone'),
	// Смещение сервера портала из time.date_finish ответа profile, например '+03:00'
	portalOffset: text('portal_offset'),
	groupId: integer('group_id'),
	groupName: text('group_name'),
	connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
	// invalid_webhook | scope | access — пишут только экшены на пути fail
	lastError: text('last_error')
});
```

4) Таблицу `cards` (строки 63–74) заменить на:
```ts
export const cards = pgTable('cards', {
	id: uuid('id').primaryKey().defaultRandom(),
	boardId: uuid('board_id')
		.notNull()
		.references(() => boards.id, { onDelete: 'cascade' }),
	// Id колонки внутри формата доски (board-formats.js); валидируется сервером
	columnType: text('column_type').notNull(),
	content: text('content').notNull(),
	authorName: text('author_name'),
	imageId: uuid('image_id').references(() => images.id, { onDelete: 'set null' }),
	// Задача Битрикс24 из карточки: id и готовая ссылка, считаются один раз при создании
	bitrixTaskId: integer('bitrix_task_id'),
	bitrixTaskUrl: text('bitrix_task_url'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
```

`db/index.ts` регистрирует модуль целиком (`import * as schema`), больше ничего не нужно.

- [ ] **Step 9: Копия схемы в `server.js`**

`sql` уже импортирован на строке 13 (`import { eq, and, inArray, sql, isNull, lt, isNotNull } from 'drizzle-orm';`). Таблицу `space_bitrix` в `server.js` не дублируем: он её не читает.

`spaces` (строки 52–60).

Было:
```js
	lastFormat: text('last_format'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

const boards = pgTable('boards', {
```

Стало:
```js
	lastFormat: text('last_format'),
	accessToken: text('access_token').notNull().default(sql`gen_random_uuid()::text`),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

const boards = pgTable('boards', {
```

`cards` (строки 81–89).

Было:
```js
	imageId: uuid('image_id').references(() => images.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

const votes = pgTable(
```

Стало:
```js
	imageId: uuid('image_id').references(() => images.id, { onDelete: 'set null' }),
	bitrixTaskId: integer('bitrix_task_id'),
	bitrixTaskUrl: text('bitrix_task_url'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

const votes = pgTable(
```

Обработчики `board:join` / `card:create` / `card:update` не трогаем: `decryptCard` делает `{ ...card }`, и поля задачи уходят клиенту сами.

Run: `node --check server.js`
Expected: без вывода, код выхода 0.

- [ ] **Step 10: Фикстуры, которые иначе уронят `npm run check`**

Литералы `Card` и `ExportCard` в тестах svelte-check проверяет по типам. Без этого шага он даёт 2 ошибки:
- `Type '{ id: string; … }' is not assignable to type 'Card'` в `board.test.ts`;
- `Property 'task' is missing in type '…' but required in type 'ExportCard'` в `space-export.test.ts`.

`src/lib/stores/board.test.ts`, функция `makeCard`.

Было:
```ts
		imageWidth: null,
		imageHeight: null,
		createdAt: '2025-01-01T00:00:00Z',
		...overrides
	};
}

function makeVote(overrides: Partial<Vote> = {}): Vote {
```

Стало:
```ts
		imageWidth: null,
		imageHeight: null,
		bitrixTaskId: null,
		bitrixTaskUrl: null,
		createdAt: '2025-01-01T00:00:00Z',
		...overrides
	};
}

function makeVote(overrides: Partial<Vote> = {}): Vote {
```

`src/lib/server/space-export.test.ts`, строка 46.

Было:
```ts
			again_well: [{ content: 'Deploys are smooth (in 3 boards)', authorName: 'AI analysis', likes: 0, dislikes: 0, imageUrl: null, createdAt: '2026-08-17T10:00:00.000Z', comments: [] }],
```

Стало:
```ts
			again_well: [{ content: 'Deploys are smooth (in 3 boards)', authorName: 'AI analysis', likes: 0, dislikes: 0, imageUrl: null, task: null, createdAt: '2026-08-17T10:00:00.000Z', comments: [] }],
```

Других мест, где собирается литерал `Card`, в коде нет:
- `src/routes/[slug]/+page.server.ts` разворачивает строку Drizzle (`...c`);
- `socket.svelte.ts` получает карточки с сервера;
- `analysis-job.ts` вставляет строки `cards`, а новые колонки там nullable.

- [ ] **Step 11: Полный прогон тестов и типов**

Run: `npm test`
Expected: все файлы зелёные: `Test Files 25 passed (25)`, `Tests 197 passed (197)` (193 до задачи + 4 новых). `dictionaries.test.ts` зелёный, так как ключ есть в обоих словарях.

Run: `npm run check`
Expected: `svelte-check found 0 errors and 0 warnings`.

- [ ] **Step 12: Ручная проверка миграции на локальной БД**

Юнит-тесты БД не трогают, поэтому проверяем руками на compose-сервисе `db`. Хост-порт у него 5433, как в `playwright.config.ts`. В `.env` стоит 5432, поэтому `DATABASE_URL` задаём явно.

Run: `docker compose up -d db && DATABASE_URL=postgresql://retro:retro@localhost:5433/retro node migrate.js`
Expected: `Applied: 0008_bitrix.sql`, затем `Migrations complete.`

Run: `docker compose exec db psql -U retro -d retro -c '\d space_bitrix'`
Expected: 11 колонок:
- `space_id uuid not null`;
- `webhook_enc`, `portal`, `user_name` — `text not null`;
- `user_id integer not null`;
- `time_zone`, `portal_offset`, `group_name`, `last_error` — `text` nullable;
- `group_id integer` nullable;
- `connected_at timestamp with time zone not null default now()`.

Ниже: `"space_bitrix_pkey" PRIMARY KEY, btree (space_id)` и `FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE`.

Run: `docker compose exec db psql -U retro -d retro -c '\d cards'`
Expected: в конце списка колонок `bitrix_task_id | integer` и `bitrix_task_url | text`, обе nullable.

Run: `docker compose exec db psql -U retro -d retro -c "SELECT count(*) AS spaces, count(DISTINCT access_token) AS distinct_tokens, bool_and(access_token ~ '^[0-9a-f-]{36}$') AS uuid_like FROM spaces"`
Expected: `spaces` = `distinct_tokens`: у каждого старого пространства свой токен. `uuid_like` = `t` (или пусто, если пространств нет).

Run: `docker compose exec -T db psql -U retro -d retro -v ON_ERROR_STOP=1 < drizzle/0008_bitrix.sql`
Expected: четыре `NOTICE: … already exists, skipping`, `CREATE TABLE` / `ALTER TABLE` без ошибок: повторный прогон безопасен.

Run: `DATABASE_URL=postgresql://retro:retro@localhost:5433/retro node migrate.js`
Expected: только `Migrations complete.` — файл уже записан в `__drizzle_migrations`.

- [ ] **Step 13: Commit**

```bash
git add drizzle/0008_bitrix.sql src/lib/server/db/schema.ts server.js src/lib/types.ts src/lib/server/export.ts src/lib/server/export.test.ts src/lib/server/space-export.test.ts src/lib/stores/board.test.ts src/lib/i18n/en.json src/lib/i18n/ru.json
git commit -F - <<'EOF'
Битрикс24: таблица space_bitrix, задача на карточке, токен доступа пространства

Миграция 0008: space_bitrix (зашифрованный вебхук пространства, владелец,
часовой пояс, группа по умолчанию, последняя ошибка), cards.bitrix_task_id
и bitrix_task_url, spaces.access_token с бэкфиллом отдельным uuid на каждую
строку. Схема в schema.ts и копия в server.js, типы CardTask и BitrixInfo.
Экспорт: поле task у карточки в JSON и строка со ссылкой на задачу в Markdown.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Проверяемая cookie доступа к закрытому пространству

Сейчас cookie `retro_space_{slug}` хранит константу `'authenticated'`, а `canViewSpace`, `load`, `createBoard` пространства и `space:join` в `server.js` проверяют только, что она есть. Гость по ссылке на закрытое пространство подделывает cookie, создаёт доску и становится её создателем (спека, Секция 1, «Колонка `spaces.access_token`»). В этой задаче cookie начинает хранить `spaces.access_token` (колонку добавила задача 1), и все проверки сравнивают значение cookie с колонкой. Сравнение — простое `===`, как у `creator_token`.

Полный список чтений и записей cookie найден grep-ом `grep -rn 'retro_space_\${' src server.js | grep -v retro_space_creator_` (до правок 7 строк):
- `src/lib/server/space-access.ts:11` — проверка, что cookie есть;
- `src/routes/spaces/[slug]/+page.server.ts:51` (запись в `load` при `?admin=`), `:61` (проверка наличия в `load`), `:194` (запись в `verify`), `:237` (проверка наличия в `createBoard`);
- `src/routes/new/+page.server.ts:60` (запись в `createSpace`);
- `server.js:396` (проверка наличия в `space:join`).

**Меняется только эта задача:**
- Все, кто уже вызывает `canViewSpace` (`src/routes/[slug]/+page.server.ts:67`, `src/routes/spaces/[slug]/analysis/+server.ts:14`, экшены `dismissAnalysis` и `analyze`), получают строку пространства целиком через `db.query.spaces.findFirst`, то есть вместе с `accessToken`. Правка им не нужна, строже они станут сами.
- `src/lib/server/space-export.ts` проверяет пароль по заголовку `X-Space-Password` и cookie не читает.
- `src/routes/spaces/[slug]/+server.ts` и `src/routes/[slug]/+server.ts` смотрят только cookie создателя.
- Поле page data `authenticated` на странице пространства остаётся: это флаг для клиента, а не значение cookie.

**Files:**
- Modify: `src/lib/server/space-access.ts` — функция `canViewSpace` целиком (строки 1–12)
- Test: `src/lib/server/space-access.test.ts` — файл целиком (строки 1–22)
- Modify: `src/routes/spaces/[slug]/+page.server.ts`:
  - `load`: запись cookie при `?admin=` и проверка доступа (строки 47–62);
  - `verify`: запись cookie (строки 194–196);
  - `disablePassword`: только комментарий (строка 215);
  - `enablePassword`: целиком (строки 219–234);
  - `createBoard`: начало экшена (строки 236–243).

  Задача 1 этот файл не трогает, номера строк актуальны.
- Modify: `src/routes/new/+page.server.ts` — экшен `createSpace` (строки 53–66)
- Modify: `server.js` — обработчик `socket.on('space:join', …)` и комментарий над ним (сейчас строки 382–397; задача 1 добавила строки в копию схемы выше, поэтому ищите по тексту `socket.on('space:join'`)

**Interfaces:**
- Consumes (задача 1):
  - `drizzle/0008_bitrix.sql` добавляет колонку `spaces.access_token text NOT NULL` с бэкфиллом `gen_random_uuid()::text`;
  - `src/lib/server/db/schema.ts`: в таблице `spaces` есть `accessToken: text('access_token').notNull()` (тип строки `accessToken: string`);
  - `server.js`: в копии `spaces` есть `accessToken: text('access_token')…`.
- Produces:
  - `export function canViewSpace(space: { slug: string; passwordHash: string | null; creatorToken: string; accessToken: string }, cookies: Cookies): boolean;` — без пароля `true`; иначе `true`, если cookie `retro_space_creator_{slug}` равна непустому `creatorToken` или cookie `retro_space_{slug}` равна непустому `accessToken`. Используют задача 8 (`createTask`, `GET /[slug]/bitrix/group`) и задача 11.
  - Инвариант для задачи 11 (e2e 11 и 15): cookie `retro_space_{slug}` всегда равна `spaces.access_token`. `enablePassword` выдаёт новый токен `nanoid(32)`, после этого старые cookie не действуют. Подделанная `retro_space_{slug}=x` не открывает страницу пространства, не даёт создать доску и не пускает в комнату `space:{slug}`.

- [ ] **Step 1: Проверить, что задача 1 на месте, и записать исходное состояние `check`**

Run:
```bash
grep -n "access_token" drizzle/0008_bitrix.sql src/lib/server/db/schema.ts server.js
npm run check 2>&1 | tail -3
```
Expected:
- в каждом из трёх файлов найдена хотя бы одна строка:
  - в миграции — `ALTER TABLE … "spaces" ADD COLUMN "access_token" …`;
  - в `schema.ts` — `accessToken: text('access_token').notNull()…`;
  - в `server.js` — `accessToken: text('access_token')…`.

  Если хотя бы одной строки нет, остановитесь: задача 1 не завершена.
- Запомните число `errors` из вывода `svelte-check`. В шаге 11 оно не должно вырасти.

- [ ] **Step 2: Write the failing test**

Заменить `src/lib/server/space-access.test.ts` целиком:

```ts
import { describe, it, expect } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import { canViewSpace } from './space-access.js';

const jar = (entries: Record<string, string>) => ({ get: (name: string) => entries[name] } as unknown as Cookies);
const open = { slug: 'sp', passwordHash: null, creatorToken: 'tok', accessToken: 'acc-token' };
const locked = { slug: 'sp', passwordHash: 'hash', creatorToken: 'tok', accessToken: 'acc-token' };

describe('canViewSpace', () => {
	it('без пароля видят все', () => {
		expect(canViewSpace(open, jar({}))).toBe(true);
		expect(canViewSpace(open, jar({ retro_space_sp: 'x' }))).toBe(true);
	});
	it('с паролем — cookie доступа, равная access_token, или создатель', () => {
		expect(canViewSpace(locked, jar({}))).toBe(false);
		expect(canViewSpace(locked, jar({ retro_space_sp: 'acc-token' }))).toBe(true);
		expect(canViewSpace(locked, jar({ retro_space_creator_sp: 'tok' }))).toBe(true);
		expect(canViewSpace(locked, jar({ retro_space_creator_sp: 'wrong' }))).toBe(false);
	});
	it('подделанная cookie доступа не открывает пространство', () => {
		expect(canViewSpace(locked, jar({ retro_space_sp: 'x' }))).toBe(false);
		expect(canViewSpace(locked, jar({ retro_space_sp: 'authenticated' }))).toBe(false);
		expect(canViewSpace(locked, jar({ retro_space_sp: '' }))).toBe(false);
	});
	it('cookie, выданная до смены токена, больше не действует', () => {
		expect(canViewSpace({ ...locked, accessToken: 'new-token' }, jar({ retro_space_sp: 'acc-token' }))).toBe(false);
	});
	it('токен в cookie другого пространства не подходит', () => {
		expect(canViewSpace(locked, jar({ retro_space_other: 'acc-token' }))).toBe(false);
	});
	it('пустой creatorToken у старого пространства не открывает доступ', () => {
		expect(canViewSpace({ ...locked, creatorToken: '' }, jar({ retro_space_creator_sp: '' }))).toBe(false);
	});
	it('пустой accessToken не совпадает с пустой cookie', () => {
		expect(canViewSpace({ ...locked, accessToken: '' }, jar({ retro_space_sp: '' }))).toBe(false);
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/server/space-access.test.ts`

Expected: FAIL, `Tests  2 failed | 5 passed (7)`:
- `подделанная cookie доступа не открывает пространство` — `AssertionError: expected true to be false`: текущий код пускает с любой непустой cookie (`'x'`).
- `cookie, выданная до смены токена, больше не действует` — `AssertionError: expected true to be false`.

Остальные пять тестов проходят и на старом коде: их значения совпадают с поведением проверки на наличие cookie.

- [ ] **Step 4: Write minimal implementation**

Заменить `src/lib/server/space-access.ts` целиком:

```ts
import type { Cookies } from '@sveltejs/kit';

/**
 * Кто может смотреть пространство: пароля нет, это создатель или у посетителя
 * cookie доступа, равная access_token (её выдают verify, ?admin= и enablePassword).
 * Сравниваем значение, а не наличие: cookie с любым другим значением — подделка.
 */
export function canViewSpace(
	space: { slug: string; passwordHash: string | null; creatorToken: string; accessToken: string },
	cookies: Cookies
): boolean {
	if (!space.passwordHash) return true;
	const creatorCookie = cookies.get(`retro_space_creator_${space.slug}`) ?? '';
	if (space.creatorToken && creatorCookie === space.creatorToken) return true;
	const accessCookie = cookies.get(`retro_space_${space.slug}`) ?? '';
	// Та же строка равенства продублирована в server.js (space:join) — меняйте обе
	return !!space.accessToken && accessCookie === space.accessToken;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/server/space-access.test.ts`
Expected: PASS, `Tests  7 passed (7)`.

- [ ] **Step 6: `load` и `verify` пространства кладут в cookie `access_token`**

В `src/routes/spaces/[slug]/+page.server.ts`, функция `load`.

Было (строки 47–62):

```ts
	if (adminParam && adminParam === space.creatorToken) {
		cookies.set(`retro_space_creator_${params.slug}`, adminParam, {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		cookies.set(`retro_space_${params.slug}`, 'authenticated', {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		isCreator = true;
		showCreatedToast = true;
	} else if (creatorCookie && creatorCookie === space.creatorToken) {
		isCreator = true;
	}

	const hasPassword = !!space.passwordHash;
	const accessCookie = cookies.get(`retro_space_${params.slug}`);
	if (hasPassword && !accessCookie && !isCreator) {
```

Стало:

```ts
	if (adminParam && adminParam === space.creatorToken) {
		cookies.set(`retro_space_creator_${params.slug}`, adminParam, {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		// Значение cookie доступа — секрет пространства, а не константа:
		// canViewSpace и server.js сравнивают его с access_token
		cookies.set(`retro_space_${params.slug}`, space.accessToken, {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		isCreator = true;
		showCreatedToast = true;
	} else if (creatorCookie && creatorCookie === space.creatorToken) {
		isCreator = true;
	}

	const hasPassword = !!space.passwordHash;
	// Без пароля canViewSpace пускает всех; с паролем — создателя или cookie, равную access_token
	if (!isCreator && !canViewSpace(space, cookies)) {
```

Тело ветки (`return { space: …, authenticated: false, … }`) и всё ниже не меняются. `canViewSpace` уже импортирован (строка 32). Переменная `hasPassword` по-прежнему нужна в итоговом `return`.

В экшене `verify`.

Было (строки 194–196):

```ts
		cookies.set(`retro_space_${params.slug}`, 'authenticated', {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
```

Стало:

```ts
		// Пароль верный — выдаём текущий токен доступа; после следующего enablePassword он перестанет действовать
		cookies.set(`retro_space_${params.slug}`, space.accessToken, {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
```

- [ ] **Step 7: `enablePassword` выдаёт новый токен, `disablePassword` токен не трогает**

Заменить экшен `enablePassword` целиком (строки 219–234):

```ts
	enablePassword: async ({ request, params, cookies }) => {
		const token = cookies.get(`retro_space_creator_${params.slug}`) ?? '';
		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404);
		if (!space.creatorToken || token !== space.creatorToken) throw error(403, 'Forbidden');

		const formData = await request.formData();
		const password = (formData.get('password') as string)?.trim();
		if (!password) return fail(400, { passwordAction: 'enable', passwordError: 'empty_password' });

		const passwordHash = await hashPassword(password);
		// Новый пароль — новый токен доступа: cookie, выданные раньше (в том числе
		// под прошлым паролем), перестают открывать пространство сами
		const accessToken = nanoid(32);
		await db.update(spaces).set({ passwordHash, accessToken }).where(eq(spaces.id, space.id));
		cookies.set(`retro_space_${params.slug}`, accessToken, {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		return { passwordAction: 'enable', passwordSuccess: true };
	},
```

`nanoid` уже импортирован (строка 9). Форма `?/enablePassword` работает через `use:enhance`, поэтому `Set-Cookie` из ответа браузер применяет без перезагрузки.

В `disablePassword` поведение не меняется. Над строкой 215 `await db.update(spaces).set({ passwordHash: null })…` добавить комментарий:

```ts
		// access_token не трогаем: без пароля cookie не проверяется, а включение
		// пароля (enablePassword) всё равно выдаёт новый токен
		await db.update(spaces).set({ passwordHash: null }).where(eq(spaces.id, space.id));
```

- [ ] **Step 8: `createBoard` проверяет доступ через `canViewSpace`**

Было (строки 236–243):

```ts
	createBoard: async ({ request, params, cookies }) => {
		const accessCookie = cookies.get(`retro_space_${params.slug}`);
		if (!accessCookie) throw error(403, 'Not authenticated');

		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404);
```

Стало:

```ts
	createBoard: async ({ request, params, cookies }) => {
		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404);
		// Раньше хватало любой cookie retro_space_{slug}: подделав её, гость создавал
		// доску в закрытом пространстве и становился её создателем
		if (!canViewSpace(space, cookies)) throw error(403, 'Not authenticated');
```

Остальное тело экшена (`formData`, `insert`, cookie создателя доски, `redirect`) не меняется.

- [ ] **Step 9: `/new` — cookie доступа при создании пространства с паролем**

В `src/routes/new/+page.server.ts`, экшен `createSpace`.

Было (строки 53–66):

```ts
		const slug = nanoid(21);
		const creatorToken = nanoid(32);
		const passwordHash = password ? await hashPassword(password) : null;

		await db.insert(spaces).values({ name, slug, passwordHash, creatorToken });

		if (passwordHash) {
			cookies.set(`retro_space_${slug}`, 'authenticated', {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 365
			});
		}
```

Стало:

```ts
		const slug = nanoid(21);
		const creatorToken = nanoid(32);
		// Токен cookie доступа генерируем сами, а не берём DEFAULT колонки: значение нужно
		// сразу для cookie, и вставка не зависит от того, есть ли у колонки default
		const accessToken = nanoid(32);
		const passwordHash = password ? await hashPassword(password) : null;

		await db.insert(spaces).values({ name, slug, passwordHash, creatorToken, accessToken });

		if (passwordHash) {
			cookies.set(`retro_space_${slug}`, accessToken, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 365
			});
		}
```

- [ ] **Step 10: `server.js` — `space:join` сравнивает cookie с `access_token`**

Новый корневой модуль не заводим: Dockerfile не меняется, а `server.js` не видит `src/`. Строку равенства дублируем с комментарием.

Было (комментарий над обработчиком и проверка внутри `socket.on('space:join', …)`):

```js
	// Пространство с паролем: в комнату пускаем только с cookie доступа или
	// cookie создателя (те же правила, что у страницы). Статус анализа несёт
	// slug доски-анализа, а он должен быть виден лишь тем, кто прошёл пароль.
```

```js
			if (space.passwordHash) {
				const jar = parseCookies(socket.handshake?.headers?.cookie);
				const creator = !!space.creatorToken && jar[`retro_space_creator_${slug}`] === space.creatorToken;
				if (!creator && !jar[`retro_space_${slug}`]) return;
			}
```

Стало:

```js
	// Пространство с паролем: в комнату пускаем только с cookie доступа, равной
	// spaces.access_token, или cookie создателя (те же правила, что у страницы). Статус анализа несёт
	// slug доски-анализа, а он должен быть виден лишь тем, кто прошёл пароль.
```

```js
			if (space.passwordHash) {
				const jar = parseCookies(socket.handshake?.headers?.cookie);
				const creator = !!space.creatorToken && jar[`retro_space_creator_${slug}`] === space.creatorToken;
				// Дубль равенства из canViewSpace (src/lib/server/space-access.ts): server.js
				// не импортирует src/, меняйте обе строки вместе
				const access = !!space.accessToken && jar[`retro_space_${slug}`] === space.accessToken;
				if (!creator && !access) return;
			}
```

Run: `node --check server.js`
Expected: пустой вывод, exit code 0.

- [ ] **Step 11: Grep — не осталось константы и проверки на одно наличие; unit-тесты, типы, сборка**

Run:
```bash
grep -rn "'authenticated'" src server.js --exclude='*.test.ts'
grep -rn 'retro_space_\${' src server.js | grep -v retro_space_creator_
grep -rn 'retro_space_\${' src server.js | grep -v retro_space_creator_ | grep -v accessToken
```

Expected:
- первая команда — пустой вывод;
- вторая — ровно 6 строк: `space-access.ts` (get), `spaces/[slug]/+page.server.ts` ×3 (set в `load`, `verify`, `enablePassword`), `new/+page.server.ts` (set), `server.js` (`jar[…] === space.accessToken`);
- третья — ровно одна строка:

  ```
  src/lib/server/space-access.ts:15:	const accessCookie = cookies.get(`retro_space_${space.slug}`) ?? '';
  ```

  В ней стоит `accessCookie`, а не `accessToken`, поэтому фильтр её не убирает. Это правильно: значение сравнивается с `space.accessToken` строкой ниже (строка 17). В пяти остальных строках второй команды `accessToken` есть. Если третья команда вывела что-то ещё, значит где-то осталась запись константы или проверка на одно наличие. Чаще всего это старая строка `const accessCookie = cookies.get(…)` в `load` или `createBoard` из `spaces/[slug]/+page.server.ts`. Вернитесь к шагам 6 и 8.

Run:
```bash
npm test
npm run check 2>&1 | tail -3
npm run build
```

Expected:
- `npm test` — все файлы зелёные, в том числе `space-access.test.ts` (7 passed);
- `npm run check` — число `errors` не больше записанного в шаге 1. Типы сходятся, потому что после задачи 1 `space.accessToken: string`, а `db.query.spaces.findFirst` отдаёт строку со всеми полями, совместимую с новой сигнатурой `canViewSpace`;
- `npm run build` — exit code 0.

- [ ] **Step 12: Прогнать затронутые e2e**

Существующие e2e с пространствами продолжают проходить, потому что создатель всегда проходит проверку, а открытые пространства по-прежнему открыты:
- **`createLockedSpace`** (`e2e/helpers.ts`). `/new?/createSpace` вставляет строку с `accessToken` и сразу ставит `retro_space_{slug}` = этот токен плюс cookie создателя. Редирект на `/spaces/{slug}?admin=…` в `load` ещё раз ставит cookie создателя и cookie доступа = `space.accessToken` (то же значение), а `isCreator = true`, поэтому страница открыта.
- **`createBoardInSpace`** после `createLockedSpace` или `createSpace`. `createBoard` проходит `canViewSpace`: у закрытого пространства через cookie создателя (и через совпадающую cookie доступа), у открытого — сразу, потому что `passwordHash` пустой.
- **`analysis.spec.ts` «a locked space hides the analysis…»**:
  - pageA — создатель: `analyze` проходит `canViewSpace`, а `space:join` в `server.js` пускает по `creator`, так что тосты приходят;
  - pageB без cookie: `/spaces/{slug}/analysis` отдаёт 403 (нет cookie создателя, а `'' !== accessToken`); на доске `spaceViewable = false`, кнопки анализа нет. Итог тот же, что и раньше.
- **`export-api.spec.ts` «a password-protected space needs the password in the API»**: `space-export.ts` проверяет только заголовок `X-Space-Password` и cookie не читает, поведение не меняется.
- **`space-rename.spec.ts`** и остальные тесты `analysis.spec.ts` работают на открытых пространствах: там `canViewSpace` возвращает `true` без cookie. Переименование проверяет только cookie создателя.

Проверку подделанной cookie (спека, Секция 6, e2e № 15) и создателя доски без cookie закрытого пространства (e2e № 11) добавляет задача 11 в `e2e/bitrix.spec.ts`.

Run:
```bash
docker compose up -d db
npm run build
npx playwright test e2e/analysis.spec.ts e2e/export-api.spec.ts e2e/space-rename.spec.ts
```

Перед запуском убедитесь, что порт 4777 свободен (`lsof -i :4777`). Локально действует `reuseExistingServer`, и Playwright подхватит уже запущенный `node server.js` со старым кодом. Миграцию `0008` применяет `node migrate.js` из `webServer`.

Expected: `20 passed` (13 + 3 + 4).

- [ ] **Step 13: Commit**

```bash
git add src/lib/server/space-access.ts src/lib/server/space-access.test.ts "src/routes/spaces/[slug]/+page.server.ts" src/routes/new/+page.server.ts server.js
git commit -m "$(cat <<'EOF'
Проверяемая cookie доступа к закрытому пространству

retro_space_{slug} хранит spaces.access_token вместо константы: canViewSpace
и space:join сравнивают значение, а не наличие. enablePassword выдаёт новый
токен, createBoard проверяет доступ через canViewSpace.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Клиент Битрикс24: адрес, SSRF, транспорт, ошибки; флаг шифрования

Задача закладывает нижний слой интеграции. Во-первых, флаг `encryptionEnabled` в `crypto.ts`: без ключа `encrypt()` молча возвращает открытый текст, а хранить так вебхук нельзя. Во-вторых, первая половина `src/lib/server/bitrix.ts`:
- разбор адреса входящего вебхука;
- защита от SSRF;
- два транспорта (старый REST и REST 3.0);
- разбор ошибок портала по видам.

Функции портала (`verifyWebhook`, `createTask`, `attachImage` и т. д.) и семафор добавит в тот же файл задача 4 — здесь их нет. БД, `$env` и сеть не нужны: юнит-тесты гоняют транспорт через подменный `fetchFn`.

Опора в спеке: Секция 2 («Адрес вебхука», «Защита от SSRF», «Транспорт», «Таксономия ошибок портала», «Шифрование») и Секция 6 (Vitest, пункты про `bitrix.test.ts` и `crypto.test.ts`). Образец стиля — `src/lib/server/deepseek.ts` и `deepseek.test.ts`: `AbortController`, таймер держится до конца чтения тела, текст исходной ошибки в `message` не попадает.

**Files:**
- Modify: `src/lib/server/crypto.ts` (новый экспорт сразу после блока `if (ENCRYPTION_KEY) { … }`, текущие строки 6–11)
- Modify: `src/lib/server/crypto.test.ts` (два теста в конец `describe`, после теста «null и пустая строка проходят насквозь», текущие строки 29–33)
- Create: `src/lib/server/bitrix.ts`
- Test: `src/lib/server/bitrix.test.ts` (новый)

**Interfaces:**
- Consumes: ничего из предыдущих задач. Правки задач 1–2 этих файлов не касаются. Внешние опоры: глобальные `fetch`, `Response`, `AbortController`, `Buffer` (Node 22), `process.env.BITRIX_ALLOW_HTTP`.
- Produces (точно по контракту, плюс два дополнения):
  ```ts
  // src/lib/server/crypto.ts
  export const encryptionEnabled: boolean; // !!encKey

  // src/lib/server/bitrix.ts
  export type BitrixErrorKind =
  	| 'invalid_url' | 'invalid_webhook' | 'scope' | 'access' | 'limit'
  	| 'group' | 'rejected' | 'network' | 'timeout' | 'shape';
  export class BitrixError extends Error {
  	kind: BitrixErrorKind; code?: string; status?: number; field?: string;
  	constructor(kind: BitrixErrorKind, message: string, extra?: { code?: string; status?: number; field?: string });
  }
  export interface Webhook { url: string; portal: string; userId: number } // url всегда с завершающим '/'
  export function parseWebhookUrl(raw: string, opts?: { allowHttp?: boolean }): Webhook | null;
  export function isBlockedHost(hostname: string): boolean;
  export interface CallOptions { fetchFn?: typeof fetch; timeoutMs?: number; idempotencyKey?: string }
  export async function callLegacy(webhook: Webhook, method: string, params: unknown, opts?: CallOptions): Promise<unknown>; // result
  export async function callV3(webhook: Webhook, method: string, params: unknown, opts?: CallOptions): Promise<unknown>;     // result
  // дополнения к контракту:
  export async function bitrixRequest(webhook: Webhook, method: string, params: unknown, api: 'legacy' | 'v3', opts?: CallOptions): Promise<{ result: unknown; time?: { date_finish?: string } }>;
  export function classifyBitrixError(body: Record<string, unknown>, status: number, api: 'legacy' | 'v3', secret?: string): BitrixError;
  ```
  Чем это пригодится задаче 4:
  - `verifyWebhook` берёт `portalOffset` из `(await bitrixRequest(wh, 'profile', {}, 'legacy', opts)).time?.date_finish`.
  - `createTask` ловит `BitrixError` с `code`, оканчивающимся на `ACCESSDENIEDEXCEPTION`, или с `field` при заданной `groupId` и переводит его в `group`.
  - `callV3` отдаёт `result` без распаковки (`{ item }`); `item` достаёт вызывающая функция.

Поведение транспорта, на которое опираются задачи 4, 5 и 8:

| Ситуация | Результат |
|---|---|
| `fetchFn` бросил, сигнал не отменён | `BitrixError('network')` |
| `fetchFn` бросил или тело оборвалось после таймаута (`opts.timeoutMs ?? 15000`, таймер до конца чтения тела) | `BitrixError('timeout')` |
| статус 3xx или `res.type === 'opaqueredirect'` | `BitrixError('invalid_webhook', …, { status })` |
| `content-length` > 1 МБ или прочитано > 1 МБ | `BitrixError('shape')` |
| тело не JSON, JSON не объект | `BitrixError('shape', …, { status })` |
| в теле есть ключ `error` (при любом статусе, даже пустой строкой) | `classifyBitrixError(...)` |
| нет ни `error`, ни `result` | `BitrixError('shape', …, { status })` |
| есть `result` (в том числе `false`) | `{ result, time?: { date_finish } }` |

Разбор ошибки портала по коду (регистр не важен):

| Код | Вид |
|---|---|
| `INVALID_CREDENTIALS`, `NO_AUTH_FOUND` | `invalid_webhook` |
| `insufficient_scope`, `…INSUFFICIENTSCOPEEXCEPTION` | `scope` |
| `ERROR_METHOD_NOT_FOUND` | `scope` для `v3`, `rejected` для `legacy` |
| `ACCESS_DENIED`, `…ACCESSDENIEDEXCEPTION`, `OVERLOAD_LIMIT`, `PORTAL_DELETED` | `access` |
| `QUERY_LIMIT_EXCEEDED`, `OPERATION_TIME_LIMIT` | `limit` |
| `…VALIDATION_*`, `ERROR_CORE`, пустой код, прочее | `rejected` |

`code` — код портала (при пустом — `undefined`). `field` — `validation[0].field`. `status` — HTTP-статус. `message` — текст портала:
- `error_description`, либо `error.message` плюс `validation[0].message`;
- все вхождения кода вебхука заменены на `***`;
- `<br>` заменены пробелами, пробелы схлопнуты;
- длина не больше 300 символов.

Собственные сообщения транспорта — `Bitrix {api} {method}: …`, без адреса.

- [ ] **Step 1: Write the failing test — `encryptionEnabled` в `crypto.test.ts`**

В `src/lib/server/crypto.test.ts` внутри `describe('encrypt/decrypt на стороне SvelteKit', …)` после теста «null и пустая строка проходят насквозь» (перед закрывающей `});` на строке 34) добавить:

```ts

	it('encryptionEnabled: true с ключом из 64 hex-символов', async () => {
		const { encryptionEnabled } = await load(KEY);
		expect(encryptionEnabled).toBe(true);
	});

	it('encryptionEnabled: false без ключа и с ключом не той длины', async () => {
		expect((await load(undefined)).encryptionEnabled).toBe(false);
		expect((await load('abcd')).encryptionEnabled).toBe(false);
	});
```

Хелпер `load()` уже есть в файле: `vi.resetModules()` + `vi.stubEnv('ENCRYPTION_KEY', …)` + динамический импорт. Модуль читает ключ при импорте, поэтому каждый вызов даёт свежий экземпляр.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/crypto.test.ts`
Expected: FAIL — `Tests  2 failed | 3 passed (5)`: `AssertionError: expected undefined to be true` и `expected undefined to be false`. Экспорта пока нет.

- [ ] **Step 3: Write minimal implementation — флаг в `crypto.ts`**

В `src/lib/server/crypto.ts`.

Было (строки 6–13):

```ts
if (ENCRYPTION_KEY) {
	encKey = Buffer.from(ENCRYPTION_KEY, 'hex');
	if (encKey.length !== 32) {
		encKey = null;
	}
}

// Зеркало encrypt() из server.js: тот же формат, чтобы карточки, созданные
```

Стало:

```ts
if (ENCRYPTION_KEY) {
	encKey = Buffer.from(ENCRYPTION_KEY, 'hex');
	if (encKey.length !== 32) {
		encKey = null;
	}
}

// Без ключа encrypt() возвращает открытый текст — для вебхука Битрикс24 это
// недопустимо, поэтому экшен подключения проверяет флаг до любого вызова портала
export const encryptionEnabled = !!encKey;

// Зеркало encrypt() из server.js: тот же формат, чтобы карточки, созданные
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/crypto.test.ts`
Expected: PASS — `Tests  5 passed (5)`.

- [ ] **Step 5: Write the failing test — адрес вебхука и закрытые хосты**

Создать `src/lib/server/bitrix.test.ts` с таким содержимым:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isBlockedHost, parseWebhookUrl } from './bitrix.js';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('parseWebhookUrl', () => {
	it('принимает входящий вебхук, приводит хост к нижнему регистру и добавляет завершающий слэш', () => {
		const expected = { url: 'https://portal.bitrix24.ru/rest/7/AbC123xyz/', portal: 'portal.bitrix24.ru', userId: 7 };
		expect(parseWebhookUrl('  https://Portal.Bitrix24.RU/rest/7/AbC123xyz  ', { allowHttp: false })).toEqual(expected);
		expect(parseWebhookUrl('https://portal.bitrix24.ru/rest/7/AbC123xyz/', { allowHttp: false })).toEqual(expected);
	});

	it('нестандартный порт остаётся в адресе и в portal, стандартный — выбрасывается', () => {
		expect(parseWebhookUrl('https://b24.example.com:8443/rest/2/abc/', { allowHttp: false })).toEqual({
			url: 'https://b24.example.com:8443/rest/2/abc/',
			portal: 'b24.example.com:8443',
			userId: 2
		});
		expect(parseWebhookUrl('https://b24.example.com:443/rest/2/abc/', { allowHttp: false })?.portal).toBe('b24.example.com');
	});

	it('http без флага — отказ; с флагом разрешён только http://localhost', () => {
		const local = 'http://localhost:4779/rest/1/testcode/';
		expect(parseWebhookUrl('http://portal.bitrix24.ru/rest/1/abc/', { allowHttp: false })).toBeNull();
		expect(parseWebhookUrl('http://portal.bitrix24.ru/rest/1/abc/', { allowHttp: true })).toBeNull();
		expect(parseWebhookUrl(local, { allowHttp: false })).toBeNull();
		expect(parseWebhookUrl(local, { allowHttp: true })).toEqual({ url: local, portal: 'localhost:4779', userId: 1 });
		expect(parseWebhookUrl('https://localhost:4779/rest/1/testcode/', { allowHttp: true })).toBeNull();
		expect(parseWebhookUrl('http://127.0.0.1:4779/rest/1/testcode/', { allowHttp: true })).toBeNull();
	});

	it('без opts флаг берётся из BITRIX_ALLOW_HTTP', () => {
		const local = 'http://localhost:4779/rest/1/testcode/';
		vi.stubEnv('BITRIX_ALLOW_HTTP', '');
		expect(parseWebhookUrl(local)).toBeNull();
		vi.stubEnv('BITRIX_ALLOW_HTTP', '1');
		expect(parseWebhookUrl(local)).toEqual({ url: local, portal: 'localhost:4779', userId: 1 });
	});

	it.each([
		'https://127.0.0.1/rest/1/abc/',
		'https://2130706433/rest/1/abc/',
		'https://0x7f000001/rest/1/abc/',
		'https://127.1/rest/1/abc/',
		'https://0177.0.0.1/rest/1/abc/',
		'https://10.1.2.3/rest/1/abc/',
		'https://172.20.0.5/rest/1/abc/',
		'https://192.168.0.10/rest/1/abc/',
		'https://169.254.169.254/rest/1/abc/',
		'https://100.100.0.1/rest/1/abc/',
		'https://0.0.0.0/rest/1/abc/',
		'https://[::1]/rest/1/abc/',
		'https://[::]/rest/1/abc/',
		'https://[::ffff:7f00:1]/rest/1/abc/',
		'https://[::ffff:192.168.0.1]/rest/1/abc/',
		'https://[fd12:3456::1]/rest/1/abc/',
		'https://[fe80::1]/rest/1/abc/',
		'https://localhost/rest/1/abc/',
		'https://db/rest/1/abc/',
		'https://netdata./rest/1/abc/',
		'https://printer.local/rest/1/abc/'
	])('приватный или служебный хост %s — отказ', (raw) => {
		expect(parseWebhookUrl(raw, { allowHttp: false })).toBeNull();
	});

	it.each([
		'https://portal.bitrix24.ru/rest/1/abc/profile',
		'https://portal.bitrix24.ru/rest/1/abc/extra/',
		'https://portal.bitrix24.ru/rest/api/1/abc/',
		'https://portal.bitrix24.ru/rest/abc/',
		'https://portal.bitrix24.ru/rest/0/abc/',
		'https://portal.bitrix24.ru/rest/3000000000/abc/',
		'https://portal.bitrix24.ru/rest/1/ab-c/',
		'https://portal.bitrix24.ru/rest/1/abc/?x=1',
		'https://portal.bitrix24.ru/rest/1/abc/?',
		'https://portal.bitrix24.ru/rest/1/abc/#top',
		'https://portal.bitrix24.ru/api/1/abc/',
		'https://user:pass@portal.bitrix24.ru/rest/1/abc/',
		'ftp://portal.bitrix24.ru/rest/1/abc/',
		'portal.bitrix24.ru/rest/1/abc/',
		'не ссылка',
		''
	])('адрес не той формы %s — отказ', (raw) => {
		expect(parseWebhookUrl(raw, { allowHttp: false })).toBeNull();
	});
});

describe('isBlockedHost', () => {
	it.each([
		'localhost',
		'LOCALHOST',
		'db',
		'netdata',
		'app',
		'printer.local',
		'printer.local.',
		'dev.localhost',
		'127.0.0.1',
		'127.1',
		'2130706433',
		'0x7f000001',
		'0.0.0.0',
		'10.0.0.1',
		'100.64.0.1',
		'100.127.255.255',
		'127.255.255.254',
		'169.254.169.254',
		'172.16.0.1',
		'172.31.255.255',
		'192.168.1.1',
		'[::]',
		'[::1]',
		'::1',
		'[::ffff:7f00:1]',
		'[::ffff:a00:1]',
		'[::ffff:c0a8:1]',
		'[fc00::1]',
		'[fdff::1]',
		'[fe80::1]',
		'[febf::1]',
		'',
		'evil.com:80',
		'bad host.ru'
	])('%s — закрыт', (host) => {
		expect(isBlockedHost(host)).toBe(true);
	});

	it.each([
		'portal.bitrix24.ru',
		'bitrix24.team',
		'b24-abc123.bitrix24.com',
		'8.8.8.8',
		'11.0.0.1',
		'100.63.255.255',
		'100.128.0.1',
		'169.255.0.1',
		'172.15.255.255',
		'172.32.0.1',
		'192.169.0.1',
		'[2a00:1450:4001::1]',
		'[::ffff:808:808]',
		'[fec0::1]'
	])('%s — открыт', (host) => {
		expect(isBlockedHost(host)).toBe(false);
	});

	it('localhost закрыт и в тестовом режиме: пропускает его только parseWebhookUrl с allowHttp', () => {
		vi.stubEnv('BITRIX_ALLOW_HTTP', '1');
		expect(isBlockedHost('localhost')).toBe(true);
	});
});

```

Хосты в тестах записаны в том виде, в каком их отдаёт `new URL(...).hostname`:
- `2130706433`, `0x7f000001`, `127.1` и `0177.0.0.1` парсер сводит к `127.0.0.1`;
- `[::ffff:192.168.0.1]` — к `[::ffff:c0a8:1]`;
- пустые `?` и `#` парсер выбрасывает, поэтому `parseWebhookUrl` проверяет их по исходной строке.

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/lib/server/bitrix.test.ts`
Expected: FAIL — `Error: Failed to load url ./bitrix.js (resolved id: ./bitrix.js) in …/src/lib/server/bitrix.test.ts. Does the file exist?`, `Test Files  1 failed (1)`, `Tests  no tests`.

- [ ] **Step 7: Write minimal implementation — `bitrix.ts`, часть 1 (типы, адрес, SSRF)**

Создать `src/lib/server/bitrix.ts`:

```ts
// Клиент Битрикс24: разбор адреса входящего вебхука, защита от SSRF, транспорт
// старого REST и REST 3.0, классификация ошибок портала. Код вебхука — секрет:
// в message, логи и метрики попадают только api, метод, код ошибки и HTTP-статус.

export type BitrixErrorKind =
	| 'invalid_url'
	| 'invalid_webhook'
	| 'scope'
	| 'access'
	| 'limit'
	| 'group'
	| 'rejected'
	| 'network'
	| 'timeout'
	| 'shape';

export class BitrixError extends Error {
	kind: BitrixErrorKind;
	code?: string;
	status?: number;
	field?: string;

	constructor(kind: BitrixErrorKind, message: string, extra: { code?: string; status?: number; field?: string } = {}) {
		super(message);
		this.name = 'BitrixError';
		this.kind = kind;
		this.code = extra.code;
		this.status = extra.status;
		this.field = extra.field;
	}
}

export interface Webhook {
	url: string; // https://host/rest/{userId}/{code}/ — всегда с завершающим '/'
	portal: string;
	userId: number;
}

// ---------- Адрес вебхука ----------

const WEBHOOK_PATH = /^\/rest\/([1-9]\d{0,9})\/([A-Za-z0-9]+)\/?$/;
const MAX_USER_ID = 2_147_483_647; // user_id — integer в Postgres

export function parseWebhookUrl(raw: string, opts: { allowHttp?: boolean } = {}): Webhook | null {
	const allowHttp = opts.allowHttp ?? process.env.BITRIX_ALLOW_HTTP === '1';
	const input = typeof raw === 'string' ? raw.trim() : '';
	// new URL молча выбрасывает пустые '?' и '#', поэтому смотрим на исходную строку
	if (!input || /[?#]/.test(input)) return null;

	let u: URL;
	try {
		u = new URL(input);
	} catch {
		return null;
	}
	if (u.username || u.password) return null;

	// http://localhost:{port} — только для e2e с моком (BITRIX_ALLOW_HTTP=1)
	const local = allowHttp && u.protocol === 'http:' && u.hostname === 'localhost';
	if (!local && (u.protocol !== 'https:' || isBlockedHost(u.hostname))) return null;

	const m = WEBHOOK_PATH.exec(u.pathname);
	if (!m) return null;
	const userId = Number(m[1]);
	if (userId > MAX_USER_ID) return null;

	return { url: `${u.protocol}//${u.host}/rest/${userId}/${m[2]}/`, portal: u.host, userId };
}

// ---------- Защита от SSRF ----------

function ipv4ToInt(host: string): number | null {
	const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
	if (!m) return null;
	const octets = m.slice(1).map(Number);
	if (octets.some((o) => o > 255)) return null;
	return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

const BLOCKED_IPV4 = [
	'0.0.0.0/8',
	'10.0.0.0/8',
	'100.64.0.0/10',
	'127.0.0.0/8',
	'169.254.0.0/16',
	'172.16.0.0/12',
	'192.168.0.0/16'
].map((cidr) => {
	const [ip, bits] = cidr.split('/');
	return { net: ipv4ToInt(ip) as number, shift: 32 - Number(bits) };
});

function isBlockedIpv4(ip: number): boolean {
	return BLOCKED_IPV4.some(({ net, shift }) => ip >>> shift === net >>> shift);
}

// Восемь 16-битных групп канонической записи (new URL отдаёт IPv6 сжатым, в hex, без точек)
function ipv6Groups(host: string): number[] | null {
	const halves = host.split('::');
	if (halves.length > 2) return null;
	const head = halves[0] ? halves[0].split(':') : [];
	const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
	const gap = 8 - head.length - tail.length;
	if (halves.length === 1 ? gap !== 0 : gap < 1) return null;
	const parts = [...head, ...new Array<string>(halves.length === 2 ? gap : 0).fill('0'), ...tail];
	if (!parts.every((p) => /^[0-9a-f]{1,4}$/.test(p))) return null;
	return parts.map((p) => parseInt(p, 16));
}

function isBlockedIpv6(host: string): boolean {
	const g = ipv6Groups(host);
	if (!g) return true;
	const zeroPrefix = g.slice(0, 5).every((x) => x === 0);
	if (zeroPrefix && g[5] === 0) return true; // ::, ::1 и устаревшие ::a.b.c.d
	if (zeroPrefix && g[5] === 0xffff) return isBlockedIpv4(((g[6] << 16) | g[7]) >>> 0); // ::ffff:-mapped
	if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7
	if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10
	return false;
}

// Хост приводим к виду, который отдаёт new URL(...).hostname: так 127.1, 2130706433,
// 0x7f000001 и [::ffff:127.0.0.1] проверяются так же, как 127.0.0.1 и [::ffff:7f00:1]
function canonicalHost(hostname: string): string | null {
	let h = hostname.trim().toLowerCase();
	if (!h || /[/?#@\\\s]/.test(h)) return null;
	if (h.includes(':') && !h.startsWith('[')) h = `[${h}]`;
	try {
		return new URL(`https://${h}/`).hostname.replace(/\.+$/, '');
	} catch {
		return null;
	}
}

// DNS не резолвим: https с проверкой сертификата делает подмену DNS на приватный адрес бесполезной
export function isBlockedHost(hostname: string): boolean {
	const host = canonicalHost(hostname);
	if (!host) return true;
	if (host.startsWith('[')) return isBlockedIpv6(host.slice(1, -1));
	const ipv4 = ipv4ToInt(host);
	if (ipv4 !== null) return isBlockedIpv4(ipv4);
	if (!host.includes('.')) return true; // localhost, db, netdata, app
	return host.endsWith('.local') || host.endsWith('.localhost');
}

```

Как устроена проверка хоста:
- `canonicalHost` прогоняет строку через тот же `new URL`. Поэтому `isBlockedHost` одинаково строг и к `hostname` из `parseWebhookUrl`, и к «сырой» строке (`::1`, `127.1`).
- Тестовый режим живёт только в `parseWebhookUrl`: при `allowHttp` пропускается ровно `http://localhost[:port]`, а `isBlockedHost('localhost')` всегда `true`.

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/lib/server/bitrix.test.ts`
Expected: PASS — `Tests  90 passed (90)`.

- [ ] **Step 9: Write the failing test — транспорт, коды портала, секрет**

В `src/lib/server/bitrix.test.ts` заменить шапку файла.

Было (строки 1–6):

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isBlockedHost, parseWebhookUrl } from './bitrix.js';

afterEach(() => {
	vi.unstubAllEnvs();
});
```

Стало:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	BitrixError,
	bitrixRequest,
	callLegacy,
	callV3,
	classifyBitrixError,
	isBlockedHost,
	parseWebhookUrl,
	type BitrixErrorKind,
	type Webhook
} from './bitrix.js';

const CODE = 'k3yS3cr3tC0de9xy';
const WH: Webhook = { url: `https://portal.bitrix24.ru/rest/7/${CODE}/`, portal: 'portal.bitrix24.ru', userId: 7 };

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const legacyError = (code: string, description = 'Ошибка') => ({ error: code, error_description: description });
const v3Error = (code: string, message = 'Ошибка', validation?: { field: string; message: string }[]) => ({
	error: { code, message, ...(validation ? { validation } : {}) }
});

// Подменный fetch: запоминает адрес и init каждого вызова
function fakeFetch(reply: (url: string, init: RequestInit) => Response | Promise<Response>) {
	const calls: { url: string; init: RequestInit }[] = [];
	const fetchFn = (async (url: string, init: RequestInit) => {
		calls.push({ url, init });
		return reply(url, init);
	}) as unknown as typeof fetch;
	return { fetchFn, calls };
}

// fetch, который не отвечает и падает только по отмене сигнала
function hangingFetch() {
	return fakeFetch(
		(_url, init) =>
			new Promise<Response>((_, reject) => {
				init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
			})
	).fetchFn;
}

async function failure(fetchFn: typeof fetch, api: 'legacy' | 'v3' = 'legacy', timeoutMs?: number): Promise<BitrixError> {
	try {
		await bitrixRequest(WH, 'tasks.task.add', {}, api, { fetchFn, timeoutMs });
	} catch (err) {
		if (err instanceof BitrixError) return err;
		throw err;
	}
	throw new Error('ожидали BitrixError');
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.useRealTimers();
});
```

Затем дописать в конец файла, после `describe('isBlockedHost', …)`:

```ts
describe('транспорт', () => {
	it('callLegacy: POST JSON на адрес вебхука с redirect manual, возвращает result', async () => {
		const { fetchFn, calls } = fakeFetch(() => json({ result: { ID: '7' } }));
		const out = await callLegacy(WH, 'profile', { a: 1 }, { fetchFn, idempotencyKey: 'ignored' });

		expect(out).toEqual({ ID: '7' });
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(`https://portal.bitrix24.ru/rest/7/${CODE}/profile`);
		expect(calls[0].init.method).toBe('POST');
		expect(calls[0].init.redirect).toBe('manual');
		expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
		const headers = calls[0].init.headers as Record<string, string>;
		expect(headers['Content-Type']).toBe('application/json');
		expect(headers.Accept).toBe('application/json');
		expect(headers['Idempotency-Key']).toBeUndefined();
		expect(JSON.parse(calls[0].init.body as string)).toEqual({ a: 1 });
	});

	it('callV3: адрес с /rest/api/, заголовок Idempotency-Key, возвращает result целиком', async () => {
		const item = { id: 745181, link: '/workgroups/group/2014/tasks/task/view/745181/' };
		const { fetchFn, calls } = fakeFetch(() => json({ result: { item } }));
		const out = await callV3(WH, 'tasks.task.add', { fields: { title: 'Починить CI' } }, { fetchFn, idempotencyKey: 'abc123' });

		expect(out).toEqual({ item });
		expect(calls[0].url).toBe(`https://portal.bitrix24.ru/rest/api/7/${CODE}/tasks.task.add`);
		expect(calls[0].init.method).toBe('POST');
		expect(calls[0].init.redirect).toBe('manual');
		expect((calls[0].init.headers as Record<string, string>)['Idempotency-Key']).toBe('abc123');
		expect(JSON.parse(calls[0].init.body as string)).toEqual({ fields: { title: 'Починить CI' } });
	});

	it('callV3 без ключа идемпотентности заголовок не шлёт', async () => {
		const { fetchFn, calls } = fakeFetch(() => json({ result: { item: { id: 1 } } }));
		await callV3(WH, 'tasks.task.field.list', {}, { fetchFn });
		expect((calls[0].init.headers as Record<string, string>)['Idempotency-Key']).toBeUndefined();
	});

	it('bitrixRequest отдаёт result и time.date_finish; result false — тоже успех', async () => {
		const { fetchFn } = fakeFetch(() =>
			json({ result: { ID: '1' }, time: { start: 1, date_finish: '2026-09-17T12:00:00+02:00' } })
		);
		await expect(bitrixRequest(WH, 'profile', {}, 'legacy', { fetchFn })).resolves.toEqual({
			result: { ID: '1' },
			time: { date_finish: '2026-09-17T12:00:00+02:00' }
		});

		const noTime = fakeFetch(() => json({ result: false }));
		const res = await bitrixRequest(WH, 'tasks.task.file.attach', {}, 'v3', { fetchFn: noTime.fetchFn });
		expect(res.result).toBe(false);
		expect(res.time).toBeUndefined();
	});

	it('ошибка определяется по ключу error, а не по статусу', async () => {
		const at200 = await failure(fakeFetch(() => json(legacyError('QUERY_LIMIT_EXCEEDED', 'Too many requests'), 200)).fetchFn);
		expect(at200).toMatchObject({ kind: 'limit', code: 'QUERY_LIMIT_EXCEEDED', status: 200, message: 'Too many requests' });

		const emptyCode = await failure(fakeFetch(() => json(legacyError('', 'Not found'), 400)).fetchFn);
		expect(emptyCode).toMatchObject({ kind: 'rejected', status: 400, message: 'Not found' });
		expect(emptyCode.code).toBeUndefined();
	});

	it('3xx → invalid_webhook, за редиректом не идём', async () => {
		const { fetchFn, calls } = fakeFetch(() => new Response(null, { status: 301, headers: { location: 'http://10.0.0.1/' } }));
		expect(await failure(fetchFn)).toMatchObject({ kind: 'invalid_webhook', status: 301 });
		expect(calls).toHaveLength(1);
	});

	it('тело больше 1 МБ → shape: по заголовку и по фактическому размеру', async () => {
		const declared = await failure(
			fakeFetch(() => new Response('{"result":1}', { headers: { 'content-length': String(5 * 1024 * 1024) } })).fetchFn
		);
		expect(declared.kind).toBe('shape');

		const streamed = await failure(fakeFetch(() => json({ result: 'x'.repeat(1024 * 1024) })).fetchFn);
		expect(streamed.kind).toBe('shape');
	});

	it('не-JSON → shape со статусом', async () => {
		const err = await failure(fakeFetch(() => new Response('<html>502 Bad Gateway</html>', { status: 502 })).fetchFn);
		expect(err).toMatchObject({ kind: 'shape', status: 502 });
	});

	it('JSON без result и без error → shape', async () => {
		expect((await failure(fakeFetch(() => json({ foo: 1 })).fetchFn)).kind).toBe('shape');
		expect((await failure(fakeFetch(() => json([1, 2])).fetchFn)).kind).toBe('shape');
		expect((await failure(fakeFetch(() => json(null)).fetchFn)).kind).toBe('shape');
	});

	it('сетевой сбой → network', async () => {
		const { fetchFn } = fakeFetch(() => {
			throw new TypeError('fetch failed');
		});
		expect((await failure(fetchFn)).kind).toBe('network');
	});

	it('нет ответа до таймаута → timeout', async () => {
		expect((await failure(hangingFetch(), 'legacy', 10)).kind).toBe('timeout');
	});

	it('заголовки пришли, а тело не дочитано до таймаута → timeout', async () => {
		const { fetchFn } = fakeFetch(
			(_url, init) =>
				new Response(
					new ReadableStream({
						start(ctrl) {
							init.signal?.addEventListener('abort', () => ctrl.error(new DOMException('aborted', 'AbortError')));
						}
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
		);
		expect((await failure(fetchFn, 'v3', 20)).kind).toBe('timeout');
	});

	it('таймаут по умолчанию — 15 секунд', async () => {
		vi.useFakeTimers();
		let settled = false;
		const pending = callLegacy(WH, 'profile', {}, { fetchFn: hangingFetch() }).catch((err: unknown) => err);
		void pending.then(() => (settled = true));

		await vi.advanceTimersByTimeAsync(14_999);
		expect(settled).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		const err = await pending;
		expect(err).toBeInstanceOf(BitrixError);
		expect((err as BitrixError).kind).toBe('timeout');
	});

	it('после ответа таймер снят', async () => {
		vi.useFakeTimers();
		await callLegacy(WH, 'profile', {}, { fetchFn: fakeFetch(() => json({ result: {} })).fetchFn });
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('коды портала → виды ошибок', () => {
	interface CodeCase {
		name: string;
		body: Record<string, unknown>;
		status: number;
		api: 'legacy' | 'v3';
		kind: BitrixErrorKind;
	}
	const V3 = 'BITRIX_REST_V3_EXCEPTION_';
	const cases: CodeCase[] = [
		{ name: 'INVALID_CREDENTIALS', body: legacyError('INVALID_CREDENTIALS'), status: 401, api: 'legacy', kind: 'invalid_webhook' },
		{ name: 'NO_AUTH_FOUND', body: legacyError('NO_AUTH_FOUND'), status: 401, api: 'v3', kind: 'invalid_webhook' },
		{ name: 'insufficient_scope', body: legacyError('insufficient_scope'), status: 401, api: 'legacy', kind: 'scope' },
		{ name: 'INSUFFICIENTSCOPEEXCEPTION', body: v3Error(`${V3}INSUFFICIENTSCOPEEXCEPTION`), status: 403, api: 'v3', kind: 'scope' },
		{ name: 'ERROR_METHOD_NOT_FOUND на v3', body: legacyError('ERROR_METHOD_NOT_FOUND'), status: 404, api: 'v3', kind: 'scope' },
		{ name: 'ERROR_METHOD_NOT_FOUND на старом REST', body: legacyError('ERROR_METHOD_NOT_FOUND'), status: 404, api: 'legacy', kind: 'rejected' },
		{ name: 'ACCESS_DENIED', body: legacyError('ACCESS_DENIED'), status: 401, api: 'legacy', kind: 'access' },
		{ name: 'ACCESSDENIEDEXCEPTION', body: v3Error(`${V3}ACCESSDENIEDEXCEPTION`, 'Доступ запрещен'), status: 403, api: 'v3', kind: 'access' },
		{ name: 'OVERLOAD_LIMIT', body: legacyError('OVERLOAD_LIMIT'), status: 401, api: 'legacy', kind: 'access' },
		{ name: 'PORTAL_DELETED', body: legacyError('PORTAL_DELETED'), status: 403, api: 'legacy', kind: 'access' },
		{ name: 'QUERY_LIMIT_EXCEEDED', body: legacyError('QUERY_LIMIT_EXCEEDED'), status: 503, api: 'v3', kind: 'limit' },
		{ name: 'OPERATION_TIME_LIMIT', body: legacyError('OPERATION_TIME_LIMIT'), status: 429, api: 'legacy', kind: 'limit' },
		{ name: 'VALIDATION_DTOVALIDATIONEXCEPTION', body: v3Error(`${V3}VALIDATION_DTOVALIDATIONEXCEPTION`), status: 400, api: 'v3', kind: 'rejected' },
		{ name: 'ERROR_CORE', body: legacyError('ERROR_CORE'), status: 400, api: 'legacy', kind: 'rejected' },
		{ name: 'неизвестный код', body: v3Error('SOMETHING_NEW'), status: 422, api: 'v3', kind: 'rejected' }
	];

	it.each(cases)('$name ($api, $status) → $kind', async ({ body, status, api, kind }) => {
		const err = await failure(fakeFetch(() => json(body, status)).fetchFn, api);
		expect(err).toBeInstanceOf(BitrixError);
		expect(err.kind).toBe(kind);
		expect(err.status).toBe(status);
	});

	it('ошибка строкой: code из error, текст из error_description', async () => {
		const err = await failure(fakeFetch(() => json(legacyError('ERROR_CORE', 'Задача не найдена'), 400)).fetchFn);
		expect(err).toMatchObject({ kind: 'rejected', code: 'ERROR_CORE', message: 'Задача не найдена' });
	});

	it('ошибка объектом v3: code, message и field из validation[0]', async () => {
		const body = v3Error(`${V3}VALIDATION_DTOVALIDATIONEXCEPTION`, 'Ошибка валидации.', [
			{ field: 'title', message: 'Поле "title" обязательно' }
		]);
		const err = await failure(fakeFetch(() => json(body, 400)).fetchFn, 'v3');
		expect(err).toMatchObject({
			kind: 'rejected',
			code: `${V3}VALIDATION_DTOVALIDATIONEXCEPTION`,
			field: 'title',
			message: 'Ошибка валидации: Поле "title" обязательно'
		});
	});

	it('текст портала без <br>, обрезан до 300 символов', async () => {
		const br = await failure(fakeFetch(() => json(legacyError('ERROR_CORE', 'Первая строка<br>Вторая<BR />третья'), 400)).fetchFn);
		expect(br.message).toBe('Первая строка Вторая третья');

		const long = await failure(fakeFetch(() => json(legacyError('ERROR_CORE', 'я'.repeat(500)), 400)).fetchFn);
		expect(long.message).toHaveLength(300);
	});

	it('classifyBitrixError работает и без транспорта', () => {
		const err = classifyBitrixError(legacyError('ACCESS_DENIED', 'REST is available only by subscription'), 401, 'v3');
		expect(err).toBeInstanceOf(BitrixError);
		expect(err).toMatchObject({ kind: 'access', code: 'ACCESS_DENIED', status: 401 });
		expect(err.field).toBeUndefined();
	});
});

describe('секрет вебхука', () => {
	it('не попадает в message, stack и сериализацию ни при одном виде ошибки', async () => {
		const failures = [
			await failure(
				fakeFetch(() => {
					throw new TypeError(`fetch failed: ${WH.url}profile`);
				}).fetchFn
			),
			await failure(fakeFetch(() => new Response(null, { status: 302, headers: { location: WH.url } })).fetchFn),
			await failure(fakeFetch(() => new Response(`<html>${WH.url}</html>`, { status: 500 })).fetchFn),
			await failure(fakeFetch(() => json({ foo: WH.url })).fetchFn),
			await failure(fakeFetch(() => json(legacyError('INVALID_CREDENTIALS', `Webhook ${WH.url} (${CODE}) not found`), 401)).fetchFn),
			await failure(
				fakeFetch(() => json(v3Error('BITRIX_REST_V3_EXCEPTION_VALIDATION_X', CODE, [{ field: 'title', message: WH.url }]), 400))
					.fetchFn,
				'v3'
			),
			await failure(hangingFetch(), 'v3', 5)
		];

		expect(failures.map((e) => e.kind)).toEqual([
			'network',
			'invalid_webhook',
			'shape',
			'shape',
			'invalid_webhook',
			'rejected',
			'timeout'
		]);
		for (const err of failures) {
			expect(err.message).not.toContain(CODE);
			expect(String(err.stack)).not.toContain(CODE);
			expect(JSON.stringify(err)).not.toContain(CODE);
		}
	});
});

describe('BitrixError', () => {
	it('это Error с kind, code, status и field', () => {
		const err = new BitrixError('rejected', 'Портал отклонил', { code: 'ERROR_CORE', status: 400, field: 'title' });
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe('BitrixError');
		expect(err).toMatchObject({ kind: 'rejected', code: 'ERROR_CORE', status: 400, field: 'title', message: 'Портал отклонил' });
		expect(new BitrixError('network', 'нет связи').code).toBeUndefined();
	});
});
```

Как устроены тесты:
- Подменный `fakeFetch` собирает адрес и `init` каждого вызова.
- `hangingFetch` отвечает только отменой по сигналу. Так проверяются таймауты: маленький `timeoutMs` на реальных таймерах и дефолт 15 с на `vi.useFakeTimers()` + `advanceTimersByTimeAsync`.
- `afterEach` возвращает реальные таймеры и снимает `stubEnv`.

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run src/lib/server/bitrix.test.ts`
Expected: FAIL — `Tests  34 failed | 91 passed (125)`. Причины: `TypeError: (0 , bitrixRequest) is not a function`, `(0 , callLegacy) is not a function`, `(0 , callV3) is not a function`, `(0 , classifyBitrixError) is not a function`. Тесты адреса, хостов и `BitrixError` проходят.

- [ ] **Step 11: Write minimal implementation — `bitrix.ts`, часть 2 (ошибки портала и транспорт)**

Дописать в конец `src/lib/server/bitrix.ts`, после `isBlockedHost`:

```ts
// ---------- Ошибки портала ----------

type BitrixApi = 'legacy' | 'v3';

const KIND_BY_CODE = new Map<string, BitrixErrorKind>([
	['INVALID_CREDENTIALS', 'invalid_webhook'],
	['NO_AUTH_FOUND', 'invalid_webhook'],
	['INSUFFICIENT_SCOPE', 'scope'],
	['ACCESS_DENIED', 'access'],
	['OVERLOAD_LIMIT', 'access'],
	['PORTAL_DELETED', 'access'],
	['QUERY_LIMIT_EXCEEDED', 'limit'],
	['OPERATION_TIME_LIMIT', 'limit']
]);

function kindForCode(code: string, api: BitrixApi): BitrixErrorKind {
	const upper = code.toUpperCase();
	const known = KIND_BY_CODE.get(upper);
	if (known) return known;
	if (upper.endsWith('INSUFFICIENTSCOPEEXCEPTION')) return 'scope';
	if (upper.endsWith('ACCESSDENIEDEXCEPTION')) return 'access';
	// на v3-адресе метод «не найден», когда у вебхука нет права или портал без REST 3.0
	if (upper === 'ERROR_METHOD_NOT_FOUND') return api === 'v3' ? 'scope' : 'rejected';
	return 'rejected'; // BITRIX_REST_V3_EXCEPTION_VALIDATION_*, ERROR_CORE, пустой код и прочее
}

const MESSAGE_MAX = 300;

function portalMessage(text: string, secret: string | undefined): string {
	const redacted = secret ? text.split(secret).join('***') : text;
	return redacted
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, MESSAGE_MAX);
}

// Ошибку определяет ключ error в теле, а не статус. Старый REST и системные ошибки:
// { error: 'CODE', error_description }; REST 3.0: { error: { code, message, validation? } }.
// Контекстный вид group (ACCESSDENIEDEXCEPTION при выставленной группе) решает createTask.
export function classifyBitrixError(
	body: Record<string, unknown>,
	status: number,
	api: BitrixApi,
	secret?: string
): BitrixError {
	const raw = body.error;
	let code = '';
	let text = '';
	let field: string | undefined;

	if (raw && typeof raw === 'object') {
		const e = raw as { code?: unknown; message?: unknown; validation?: unknown };
		code = typeof e.code === 'string' ? e.code : '';
		text = typeof e.message === 'string' ? e.message : '';
		const first: unknown = Array.isArray(e.validation) ? e.validation[0] : undefined;
		if (first && typeof first === 'object') {
			const v = first as { field?: unknown; message?: unknown };
			if (typeof v.field === 'string' && v.field) field = v.field;
			if (typeof v.message === 'string' && v.message && !text.includes(v.message)) {
				text = text ? `${text.replace(/[\s.:]+$/, '')}: ${v.message}` : v.message;
			}
		}
	} else {
		code = typeof raw === 'string' ? raw : '';
		text = typeof body.error_description === 'string' ? body.error_description : '';
	}

	return new BitrixError(kindForCode(code, api), portalMessage(text || code || 'Bitrix24 error', secret), {
		code: code || undefined,
		status,
		field
	});
}

// ---------- Транспорт ----------

export interface CallOptions {
	fetchFn?: typeof fetch;
	timeoutMs?: number;
	idempotencyKey?: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 1024 * 1024;

function webhookSecret(webhook: Webhook): string | undefined {
	return /\/rest\/\d+\/([^/]+)\/$/.exec(webhook.url)?.[1];
}

async function readLimitedBody(res: Response, signal: AbortSignal, where: string): Promise<string> {
	const tooLarge = () => new BitrixError('shape', `${where}: response is larger than 1 MB`, { status: res.status });
	if (Number(res.headers.get('content-length')) > MAX_BODY_BYTES) {
		res.body?.cancel().catch(() => {});
		throw tooLarge();
	}
	if (!res.body) return '';

	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const next = await reader.read().catch(() => {
			throw signal.aborted
				? new BitrixError('timeout', `${where}: timed out while reading the body`)
				: new BitrixError('network', `${where}: connection dropped`);
		});
		if (next.done) break;
		size += next.value.byteLength;
		if (size > MAX_BODY_BYTES) {
			reader.cancel().catch(() => {});
			throw tooLarge();
		}
		chunks.push(next.value);
	}
	return Buffer.concat(chunks).toString('utf8');
}

// Полный разобранный ответ: result и time.date_finish (смещение сервера портала для verifyWebhook)
export async function bitrixRequest(
	webhook: Webhook,
	method: string,
	params: unknown,
	api: BitrixApi,
	opts: CallOptions = {}
): Promise<{ result: unknown; time?: { date_finish?: string } }> {
	const base = api === 'v3' ? webhook.url.replace('/rest/', '/rest/api/') : webhook.url;
	const where = `Bitrix ${api} ${method}`;
	const fetchFn = opts.fetchFn ?? fetch;
	const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
	if (api === 'v3' && opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

	const controller = new AbortController();
	// Таймер живёт до конца чтения тела, как в deepseek.ts
	const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

	try {
		const payload = JSON.stringify(params ?? {});
		let res: Response;
		try {
			res = await fetchFn(base + method, {
				method: 'POST',
				headers,
				body: payload,
				redirect: 'manual',
				signal: controller.signal
			});
		} catch {
			// текст исходной ошибки не берём: в нём может оказаться адрес вебхука
			throw controller.signal.aborted
				? new BitrixError('timeout', `${where}: timed out`)
				: new BitrixError('network', `${where}: portal unreachable`);
		}

		// Следовать редиректу нельзя: это путь к внутренним сервисам, в том числе https → http
		if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
			res.body?.cancel().catch(() => {});
			throw new BitrixError('invalid_webhook', `${where}: redirect ${res.status}`, { status: res.status });
		}

		const text = await readLimitedBody(res, controller.signal, where);
		let data: unknown;
		try {
			data = JSON.parse(text);
		} catch {
			throw new BitrixError('shape', `${where}: non-JSON response`, { status: res.status });
		}
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			throw new BitrixError('shape', `${where}: response is not an object`, { status: res.status });
		}

		const body = data as Record<string, unknown>;
		if ('error' in body) throw classifyBitrixError(body, res.status, api, webhookSecret(webhook));
		if (!('result' in body)) throw new BitrixError('shape', `${where}: response has no result`, { status: res.status });

		const time = body.time;
		const dateFinish = time && typeof time === 'object' ? (time as { date_finish?: unknown }).date_finish : undefined;
		return { result: body.result, time: typeof dateFinish === 'string' ? { date_finish: dateFinish } : undefined };
	} finally {
		clearTimeout(timer);
	}
}

export async function callLegacy(webhook: Webhook, method: string, params: unknown, opts?: CallOptions): Promise<unknown> {
	return (await bitrixRequest(webhook, method, params, 'legacy', opts)).result;
}

export async function callV3(webhook: Webhook, method: string, params: unknown, opts?: CallOptions): Promise<unknown> {
	return (await bitrixRequest(webhook, method, params, 'v3', opts)).result;
}
```

Три решения в этом коде:
- Отмену отличаем от сетевого сбоя по `controller.signal.aborted`, а не по `err.name`. Так же ловится обрыв тела после таймаута.
- `Idempotency-Key` уходит только на v3-адрес, как требует портал.
- `readLimitedBody` читает поток сам: `res.json()` не даёт поставить потолок в 1 МБ.

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run src/lib/server/bitrix.test.ts`
Expected: PASS — `Tests  125 passed (125)`.

- [ ] **Step 13: Полная проверка**

Run: `npm test`
Expected: все файлы зелёные. К числу тестов до задачи прибавляется 127: 125 в `bitrix.test.ts` и 2 в `crypto.test.ts`.

Run: `npm run check`
Expected: без новых ошибок (проверено на `4fa433b` с изменениями этой задачи: `svelte-check found 0 errors and 0 warnings`). `fakeFetch` приводится к `typeof fetch` через `as unknown as`, импорты типов — `type …` (в проекте `verbatimModuleSyntax`).

Перед коммитом проверить глазами: в `bitrix.ts` нет `console.*` и нигде не формируется строка с `webhook.url`, кроме адреса запроса (`base + method`).

- [ ] **Step 14: Commit**

```bash
git add src/lib/server/crypto.ts src/lib/server/crypto.test.ts src/lib/server/bitrix.ts src/lib/server/bitrix.test.ts && git commit -m "$(cat <<'MSG'
Клиент Битрикс24: разбор вебхука, защита от SSRF, транспорт и ошибки портала

parseWebhookUrl принимает только https://портал/rest/{id}/{код}/ и отсекает
приватные и служебные хосты в любой записи (числовой, hex, ::ffff:-mapped);
http://localhost — только с BITRIX_ALLOW_HTTP=1 для e2e. Старый REST и REST 3.0
ходят POST + JSON без следования редиректам, с таймаутом 15 с и потолком
тела 1 МБ; ошибка определяется по ключу error и раскладывается по видам.
Код вебхука не попадает в сообщения ошибок. crypto.ts получил флаг
encryptionEnabled: без ключа вебхук не сохраняем.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: Клиент Битрикс24: функции портала, дедлайн, ключ, файл

Задача дописывает в `src/lib/server/bitrix.ts` всё, что обращается к порталу поверх транспорта из задачи 3: проверку вебхука, пробу прав, название группы, срок со смещением зоны, ключ идемпотентности, создание задачи, тег, картинку и слот загрузки. Слот пропускает в портал одну загрузку за раз. Его 30 секунд отсчитываются с постановки в очередь: если слот не освободился за это время, вызов получает `BitrixError('timeout')` и работа не запускается. Если слот получен, загрузке файла достаётся остаток этих 30 секунд. Работа идёт четырьмя циклами TDD (A–D). Каждый цикл добавляет тесты в конец одного и того же `describe`, проверяет, что они падают, добавляет код и проверяет, что они проходят. БД, `$env` и сеть не нужны: всё идёт через `opts.fetchFn`.

**Files:**
- Modify: `src/lib/server/bitrix.ts`. В шапку добавить `import { createHash } from 'node:crypto';` (цикл B) и `import type { CardTask } from '$lib/types.js';` (цикл C). Новый блок `// ---- Функции портала ----` дописать в конец файла, после `callV3` из задачи 3.
- Modify: `src/lib/server/bitrix.test.ts`. Дополнить импорты в шапке и дописать в конец файла блок `describe('Битрикс24: функции портала', …)`.
- Test: `src/lib/server/bitrix.test.ts`

**Interfaces:**
- Consumes:
  - Задача 3 (`src/lib/server/bitrix.ts`):
    - `interface Webhook { url: string; portal: string; userId: number }` и `interface CallOptions { fetchFn?; timeoutMs?; idempotencyKey? }`. Транспорт обрывает запрос через `AbortController` по `opts.timeoutMs ?? 15000`, обрыв даёт вид `timeout`;
    - `class BitrixError { kind; code?; status?; field? }`. `code` — код портала (`BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION`, `OVERLOAD_LIMIT` и т. п.), `field` — имя поля из `error.validation[0].field`;
    - `callLegacy(webhook, method, params, opts?) → Promise<unknown>` (запрос на `${url}${method}`) и `callV3(...)` (запрос на `/rest/api/`). Оба возвращают `result` **как есть**: у `tasks.task.add` это `{ item: { id, link, … } }`, без разворота;
    - `bitrixRequest(webhook: Webhook, method: string, params: unknown, api: 'legacy' | 'v3', opts?: CallOptions): Promise<{ result: unknown; time?: unknown }>`;
    - классификация ошибок транспортом: `insufficient_scope` → `scope`; `ERROR_METHOD_NOT_FOUND` на v3 → `scope`; `INVALID_CREDENTIALS` → `invalid_webhook`; `BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION` и `OVERLOAD_LIMIT` → `access` (с `code`); `BITRIX_REST_V3_EXCEPTION_VALIDATION_*` → `rejected` с `field`; `AbortError` из `fetch` → `timeout`.
  - Задача 1: `CardTask { id: number; url: string }` из `src/lib/types.ts`.
- Produces (всё в `src/lib/server/bitrix.ts`):
  - `type GroupResolution = { status: 'ok'; name: string } | { status: 'notFound' } | { status: 'noScope' }`
  - `interface TaskFields { title: string; description: string; groupId: number | null; deadline: string | null; important: boolean }`
  - `verifyWebhook(webhook: Webhook, opts?: CallOptions): Promise<{ userId: number; userName: string; timeZone: string | null; portalOffset: string | null }>` — для задачи 5 (`bitrixConnect`)
  - `checkTasksScope(webhook: Webhook, opts?: CallOptions): Promise<void>` — для задачи 5
  - `resolveGroup(webhook: Webhook, groupId: number, opts?: CallOptions): Promise<GroupResolution>` — для задачи 5 (`bitrixConnect`, `bitrixSetGroup`) и задачи 8 (`GET /[slug]/bitrix/group`)
  - `deadlineIso(date: string, timeZone: string | null, portalOffset: string | null): string` → `'YYYY-MM-DDT19:00:00+HH:MM'`
  - `idempotencyKey(cardId: string, fields: TaskFields): string` (sha256 hex) — для задачи 8
  - `createTask(webhook: Webhook, fields: TaskFields, tz: { timeZone: string | null; portalOffset: string | null }, key: string, opts?: CallOptions): Promise<CardTask>` — для задачи 8
  - `tagTask(webhook: Webhook, taskId: number, opts?: CallOptions): Promise<void>` — для задачи 8
  - `const IMAGE_MAX_BYTES: number` — для задачи 8
  - `withUploadSlot<T>(fn: () => Promise<T>): Promise<T>` (**дополнение контракта**) — для задачи 8. Это модульный семафор на одну загрузку. Срок 30 000 мс отсчитывается с момента вызова. Если слот не освободился за это время, промис отклоняется с `BitrixError('timeout')`, а `fn` не вызывается. Упавшая `fn` освобождает слот и возвращает свою ошибку. Задача 8 вызывает `loadImage` и `attachImage` внутри одного слота и захватывает его до чтения байтов.
  - `attachImage(webhook: Webhook, userId: number, taskId: number, image: { cardId: string; mimeType: string; data: Buffer }, opts?: CallOptions): Promise<void>` — для задачи 8. Сам слот **не** берёт. Внутри слота `disk.storage.uploadFile` получает таймаут, равный остатку срока слота; если остаток меньше 1 с, функция бросает `BitrixError('timeout')` без загрузки. Вне слота таймаут загрузки — полные 30 с.

- [ ] **Step 1: Сверить транспорт задачи 3**

Run: `grep -nE "^export (async )?(function|class|interface|type|const) " src/lib/server/bitrix.ts`
Expected: в выводе есть `BitrixErrorKind`, `BitrixError`, `Webhook`, `CallOptions`, `parseWebhookUrl`, `bitrixRequest`, `callLegacy`, `callV3`, а `verifyWebhook` и `withUploadSlot` нет. Если задача 3 уже объявила `TaskFields` или `GroupResolution` ровно как в контракте, не дублируй эти объявления в шагах 4 и 8.

Run: `grep -n "export async function bitrixRequest" -A 8 src/lib/server/bitrix.ts`
Expected: четвёртый параметр `api: 'legacy' | 'v3'`, результат `Promise<{ result: unknown; time?: … }>`. Если литерал другой, подставь в шаге 4 литерал задачи 3 вместо `'legacy'`: это единственный вызов `bitrixRequest` в задаче. Если `callV3` разворачивает `result.item`, это расходится с контрактом («возвращает result»). Тогда остановись и сообщи о расхождении: `createTask` и тесты опираются на `{ item }`.

Run: `grep -nE "setTimeout|AbortController|AbortSignal|signal" src/lib/server/bitrix.ts`
Expected: транспорт создаёт `new AbortController()` и таймер `setTimeout(() => controller.abort(), opts?.timeoutMs ?? …)` до вызова `fetchFn`, а в `fetchFn` передаёт `signal: controller.signal`, как в `deepseek.ts`. `AbortSignal.timeout` нет. На этом держится тест цикла D «на загрузку идёт остаток 30 с от постановки в очередь»: фейковые часы vitest управляют только глобальным `setTimeout`. Если транспорт устроен иначе, остановись и сообщи.

Run: `head -30 src/lib/server/bitrix.test.ts` — посмотри текущие импорты для шага 2.

- [ ] **Step 2: Написать падающие тесты цикла A (помощники, verifyWebhook, checkTasksScope, resolveGroup)**

В шапке `src/lib/server/bitrix.test.ts`:
- импорт из `'vitest'` должен содержать `describe, it, expect, vi, afterEach`. Допиши недостающие имена в существующую строку, второй импорт из `'vitest'` не заводи;
- в существующий импорт из `'./bitrix.js'` добавь имена, которых там ещё нет (уже импортированные задачей 3 не дублируй): `BitrixError, verifyWebhook, checkTasksScope, resolveGroup, deadlineIso, idempotencyKey, createTask, tagTask, IMAGE_MAX_BYTES, withUploadSlot, attachImage, type TaskFields, type Webhook`. Имена следующих циклов импортируются сразу: пока они не реализованы, vitest получает `undefined`, а тесты на них появятся позже.

После правки шапка выглядит так (состав имён задачи 3 может отличаться):

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	// …имена задачи 3 (parseWebhookUrl, isBlockedHost, callLegacy, callV3, …)
	BitrixError,
	verifyWebhook,
	checkTasksScope,
	resolveGroup,
	deadlineIso,
	idempotencyKey,
	createTask,
	tagTask,
	IMAGE_MAX_BYTES,
	withUploadSlot,
	attachImage,
	type TaskFields,
	type Webhook
} from './bitrix.js';
```

Допиши в самый конец файла через пустую строку. Все помощники объявлены внутри `describe`, поэтому с одноимёнными помощниками задачи 3 на уровне модуля они не конфликтуют:

```ts
describe('Битрикс24: функции портала', () => {
	const hook: Webhook = { url: 'https://bitrix24.team/rest/1/abc123secret/', portal: 'bitrix24.team', userId: 1 };
	const time = { start: 1, finish: 2, duration: 1, date_start: '2026-09-17T12:36:12+03:00', date_finish: '2026-09-17T12:36:12+03:00' };

	interface PortalCall {
		url: string;
		body: Record<string, any>;
		headers: Headers;
	}

	function reply(body: unknown, status = 200) {
		return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
	}

	// Подменный fetch: пишет вызовы и отвечает по имени метода (последний сегмент адреса).
	// init передаётся обработчику, чтобы тест мог дождаться обрыва по signal
	function portal(
		handler: (method: string, body: Record<string, any>, init?: RequestInit) => Response | Promise<Response>
	) {
		const calls: PortalCall[] = [];
		const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			const url = String(input);
			const body = JSON.parse(String(init?.body ?? '{}'));
			calls.push({ url, body, headers: new Headers(init?.headers) });
			return handler(url.slice(url.lastIndexOf('/') + 1), body, init);
		});
		return { calls, opts: { fetchFn: fetchFn as unknown as typeof fetch } };
	}

	const fields = (over: Partial<TaskFields> = {}): TaskFields => ({
		title: 'Починить деплой',
		description: 'Деплой падает по пятницам\n\nИз ретро «Спринт 42»',
		groupId: null,
		deadline: null,
		important: false,
		...over
	});

	describe('verifyWebhook', () => {
		it('берёт владельца, зону и смещение портала из profile старым REST', async () => {
			const { calls, opts } = portal(() =>
				reply({ result: { ID: '1', NAME: 'Анна', LAST_NAME: 'Петрова', TIME_ZONE: 'Europe/Kaliningrad' }, time })
			);
			await expect(verifyWebhook(hook, opts)).resolves.toEqual({
				userId: 1,
				userName: 'Анна Петрова',
				timeZone: 'Europe/Kaliningrad',
				portalOffset: '+03:00'
			});
			expect(calls).toHaveLength(1);
			expect(calls[0].url).toBe('https://bitrix24.team/rest/1/abc123secret/profile');
		});

		it('пустая зона → null, нет time → portalOffset null, имя без фамилии', async () => {
			const { opts } = portal(() => reply({ result: { ID: '7', NAME: 'Анна', LAST_NAME: '', TIME_ZONE: '' } }));
			await expect(verifyWebhook(hook, opts)).resolves.toEqual({
				userId: 7,
				userName: 'Анна',
				timeZone: null,
				portalOffset: null
			});
		});

		it('date_finish в UTC с Z → +00:00', async () => {
			const { opts } = portal(() =>
				reply({ result: { ID: '1', NAME: 'Анна', TIME_ZONE: '' }, time: { date_finish: '2026-09-17T09:36:12Z' } })
			);
			expect((await verifyWebhook(hook, opts)).portalOffset).toBe('+00:00');
		});

		it.each([[{}], [[]], [{ NAME: 'Анна' }]])('profile %j без ID → invalid_webhook, секрета в сообщении нет', async (result) => {
			const { opts } = portal(() => reply({ result, time }));
			const err = await verifyWebhook(hook, opts).catch((e) => e);
			expect(err).toBeInstanceOf(BitrixError);
			expect(err.kind).toBe('invalid_webhook');
			expect(err.message).not.toContain('abc123secret');
		});
	});

	describe('checkTasksScope', () => {
		it('пробует tasks.task.field.list через REST 3.0', async () => {
			const { calls, opts } = portal(() => reply({ result: { items: [{ name: 'title' }] }, time }));
			await expect(checkTasksScope(hook, opts)).resolves.toBeUndefined();
			expect(calls[0].url).toBe('https://bitrix24.team/rest/api/1/abc123secret/tasks.task.field.list');
			expect(calls[0].body).toEqual({ select: ['name'] });
		});

		it('без права «Задачи» → scope', async () => {
			const { opts } = portal(() =>
				reply({ error: 'insufficient_scope', error_description: 'The request requires higher privileges' }, 401)
			);
			await expect(checkTasksScope(hook, opts)).rejects.toMatchObject({ kind: 'scope' });
		});
	});

	describe('resolveGroup', () => {
		it('находит название группы старым REST', async () => {
			const { calls, opts } = portal(() => reply({ result: [{ ID: '2014', NAME: 'Платформа' }], time }));
			await expect(resolveGroup(hook, 2014, opts)).resolves.toEqual({ status: 'ok', name: 'Платформа' });
			expect(calls[0].url).toBe('https://bitrix24.team/rest/1/abc123secret/sonet_group.get');
			expect(calls[0].body).toEqual({ FILTER: { ID: 2014 } });
		});

		it('пустой массив → notFound', async () => {
			const { opts } = portal(() => reply({ result: [], time }));
			await expect(resolveGroup(hook, 99, opts)).resolves.toEqual({ status: 'notFound' });
		});

		it('нет права «Рабочие группы соцсети» → noScope, а не ошибка', async () => {
			const { opts } = portal(() =>
				reply({ error: 'insufficient_scope', error_description: 'The request requires higher privileges' }, 401)
			);
			await expect(resolveGroup(hook, 2014, opts)).resolves.toEqual({ status: 'noScope' });
		});

		it('прочие ошибки пробрасываются', async () => {
			const { opts } = portal(() => reply({ error: 'INVALID_CREDENTIALS', error_description: 'Invalid' }, 401));
			await expect(resolveGroup(hook, 2014, opts)).rejects.toMatchObject({ kind: 'invalid_webhook' });
		});

		it('не массив → shape', async () => {
			const { opts } = portal(() => reply({ result: { ID: '2014' }, time }));
			await expect(resolveGroup(hook, 2014, opts)).rejects.toMatchObject({ kind: 'shape' });
		});
	});
});
```

- [ ] **Step 3: Запустить тесты цикла A и убедиться, что они падают**

Run: `npx vitest run src/lib/server/bitrix.test.ts -t "функции портала"`
Expected: FAIL, `Tests  13 failed | N skipped`. Тесты задачи 3 отфильтрованы через `-t` и идут как skipped. Причины падения: `TypeError: (0 , verifyWebhook) is not a function`, `TypeError: (0 , checkTasksScope) is not a function`, `TypeError: (0 , resolveGroup) is not a function`.

- [ ] **Step 4: Реализовать verifyWebhook, checkTasksScope, resolveGroup**

Допиши в самый конец `src/lib/server/bitrix.ts`, после `callV3`:

```ts
// ---- Функции портала ----

export type GroupResolution = { status: 'ok'; name: string } | { status: 'notFound' } | { status: 'noScope' };

// '2026-09-17T12:36:12+03:00' → '+03:00'; смещение сервера портала, резерв для дедлайна
function offsetFromIso(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	if (value.endsWith('Z')) return '+00:00';
	const match = /([+-]\d{2}:\d{2})$/.exec(value);
	return match ? match[1] : null;
}

export async function verifyWebhook(
	webhook: Webhook,
	opts?: CallOptions
): Promise<{ userId: number; userName: string; timeZone: string | null; portalOffset: string | null }> {
	// profile работает без прав; нужен bitrixRequest, а не callLegacy, — смещение лежит в time, рядом с result
	const { result, time } = await bitrixRequest(webhook, 'profile', {}, 'legacy', opts);
	const profile = (result && typeof result === 'object' && !Array.isArray(result) ? result : {}) as Record<string, unknown>;
	const userId = Number(profile.ID);
	// Пустой объект — владелец вебхука неактивен
	if (!Number.isInteger(userId) || userId <= 0) {
		throw new BitrixError('invalid_webhook', 'Bitrix24 profile is empty');
	}
	const userName = [profile.NAME, profile.LAST_NAME]
		.map((part) => (typeof part === 'string' ? part.trim() : ''))
		.filter(Boolean)
		.join(' ');
	const timeZone = typeof profile.TIME_ZONE === 'string' && profile.TIME_ZONE ? profile.TIME_ZONE : null;
	const portalOffset = offsetFromIso((time as { date_finish?: unknown } | null | undefined)?.date_finish);
	return { userId, userName, timeZone, portalOffset };
}

export async function checkTasksScope(webhook: Webhook, opts?: CallOptions): Promise<void> {
	// Пробный вызов v3: без права «Задачи» или без REST 3.0 транспорт бросит BitrixError('scope')
	await callV3(webhook, 'tasks.task.field.list', { select: ['name'] }, opts);
}

export async function resolveGroup(webhook: Webhook, groupId: number, opts?: CallOptions): Promise<GroupResolution> {
	let result: unknown;
	try {
		result = await callLegacy(webhook, 'sonet_group.get', { FILTER: { ID: groupId } }, opts);
	} catch (err) {
		// Нет права «Рабочие группы соцсети» — не ошибка: id остаётся без названия
		if (err instanceof BitrixError && err.kind === 'scope') return { status: 'noScope' };
		throw err;
	}
	if (!Array.isArray(result)) throw new BitrixError('shape', 'Bitrix24 sonet_group.get returned no list');
	if (result.length === 0) return { status: 'notFound' };
	const name = (result[0] as { NAME?: unknown } | null)?.NAME;
	if (typeof name !== 'string' || !name) throw new BitrixError('shape', 'Bitrix24 group has no name');
	return { status: 'ok', name };
}
```

- [ ] **Step 5: Запустить тесты цикла A и убедиться, что они проходят**

Run: `npx vitest run src/lib/server/bitrix.test.ts -t "функции портала"`
Expected: PASS, `Tests  13 passed | N skipped`.

- [ ] **Step 6: Написать падающие тесты цикла B (deadlineIso, idempotencyKey)**

Вставь в `src/lib/server/bitrix.test.ts` перед последней строкой файла `});`, которая закрывает `describe('Битрикс24: функции портала'`:

```ts
	describe('deadlineIso', () => {
		it.each([
			['2026-10-01', 'Europe/Kaliningrad', '2026-10-01T19:00:00+02:00'],
			['2026-10-01', 'Europe/Moscow', '2026-10-01T19:00:00+03:00'],
			['2026-07-15', 'America/New_York', '2026-07-15T19:00:00-04:00'],
			['2026-01-15', 'America/New_York', '2026-01-15T19:00:00-05:00'],
			['2026-01-15', 'UTC', '2026-01-15T19:00:00+00:00'],
			['2026-01-15', 'Asia/Kolkata', '2026-01-15T19:00:00+05:30'],
			// накануне перехода на летнее время (4 октября) вечер ещё +10:00
			['2026-10-03', 'Australia/Sydney', '2026-10-03T19:00:00+10:00'],
			['2026-10-04', 'Australia/Sydney', '2026-10-04T19:00:00+11:00']
		])('%s в зоне %s → %s', (date, zone, expected) => {
			expect(deadlineIso(date, zone, '+09:00')).toBe(expected);
		});

		it('пустая или неизвестная зона → смещение портала', () => {
			expect(deadlineIso('2026-10-01', '', '+05:00')).toBe('2026-10-01T19:00:00+05:00');
			expect(deadlineIso('2026-10-01', null, '+05:00')).toBe('2026-10-01T19:00:00+05:00');
			expect(deadlineIso('2026-10-01', 'Mars/Olympus', '+05:00')).toBe('2026-10-01T19:00:00+05:00');
		});

		it('нет ни зоны, ни смещения портала → +03:00', () => {
			expect(deadlineIso('2026-10-01', '', null)).toBe('2026-10-01T19:00:00+03:00');
			expect(deadlineIso('2026-10-01', null, null)).toBe('2026-10-01T19:00:00+03:00');
		});
	});

	describe('idempotencyKey', () => {
		it('sha256 в hex, не зависит от порядка ключей объекта', () => {
			const a = fields({ groupId: 2014, deadline: '2026-10-01', important: true });
			const b: TaskFields = { important: true, deadline: '2026-10-01', groupId: 2014, description: a.description, title: a.title };
			const key = idempotencyKey('card-1', a);
			expect(key).toMatch(/^[0-9a-f]{64}$/);
			expect(idempotencyKey('card-1', b)).toBe(key);
		});

		it.each([
			['title', { title: 'Другое название' }],
			['description', { description: 'Другое описание' }],
			['groupId', { groupId: 2014 }],
			['deadline', { deadline: '2026-10-01' }],
			['important', { important: true }]
		] as [string, Partial<TaskFields>][])('меняется при правке %s', (_name, over) => {
			expect(idempotencyKey('card-1', fields(over))).not.toBe(idempotencyKey('card-1', fields()));
		});

		it('меняется при другой карточке', () => {
			expect(idempotencyKey('card-2', fields())).not.toBe(idempotencyKey('card-1', fields()));
		});
	});
```

- [ ] **Step 7: Запустить тесты цикла B и убедиться, что они падают**

Run: `npx vitest run src/lib/server/bitrix.test.ts -t "функции портала"`
Expected: FAIL, `Tests  17 failed | 13 passed | N skipped`. Причины падения: `TypeError: (0 , deadlineIso) is not a function`, `TypeError: (0 , idempotencyKey) is not a function`.

- [ ] **Step 8: Реализовать TaskFields, deadlineIso, idempotencyKey**

В шапку `src/lib/server/bitrix.ts`, к остальным импортам, добавь строку (если её там ещё нет):

```ts
import { createHash } from 'node:crypto';
```

Допиши в конец файла, после `resolveGroup`:

```ts
export interface TaskFields {
	title: string;
	description: string;
	groupId: number | null;
	deadline: string | null; // YYYY-MM-DD
	important: boolean;
}

const DEADLINE_TIME = '19:00:00';
const FALLBACK_OFFSET = '+03:00';

// Смещение зоны в момент epochMs: 'GMT+02:00' → '+02:00', голое 'GMT' (UTC) → '+00:00'.
// Пустая или неизвестная зона — RangeError из Intl
function zoneOffset(timeZone: string, epochMs: number): string {
	const label = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
		.formatToParts(new Date(epochMs))
		.find((part) => part.type === 'timeZoneName')?.value;
	const match = label ? /^GMT(?:([+-]\d{2}:\d{2}))?$/.exec(label) : null;
	if (!match) throw new RangeError('Unsupported time zone offset');
	return match[1] ?? '+00:00';
}

function offsetMinutes(offset: string): number {
	const sign = offset.startsWith('-') ? -1 : 1;
	return sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
}

export function deadlineIso(date: string, timeZone: string | null, portalOffset: string | null): string {
	const fallback = `${date}T${DEADLINE_TIME}${portalOffset ?? FALLBACK_OFFSET}`;
	if (!timeZone) return fallback;
	const [year, month, day] = date.split('-').map(Number);
	const utcEvening = Date.UTC(year, month - 1, day, 19);
	try {
		// Смещение на саму дату дедлайна (летнее время). Первая оценка — по 19:00 UTC,
		// вторая — по моменту, когда в зоне 19:00: иначе у зон далеко от UTC
		// (Сидней накануне перехода) смещение взялось бы уже со следующего дня
		const guess = zoneOffset(timeZone, utcEvening);
		const offset = zoneOffset(timeZone, utcEvening - offsetMinutes(guess) * 60_000);
		return `${date}T${DEADLINE_TIME}${offset}`;
	} catch {
		return fallback;
	}
}

export function idempotencyKey(cardId: string, fields: TaskFields): string {
	// Порядок ключей задан явно: ключ не зависит от того, как собран объект полей
	const canonical = JSON.stringify({
		title: fields.title,
		description: fields.description,
		groupId: fields.groupId,
		deadline: fields.deadline,
		important: fields.important
	});
	return createHash('sha256').update(`${cardId}\n${canonical}`).digest('hex');
}
```

- [ ] **Step 9: Запустить тесты цикла B и убедиться, что они проходят**

Run: `npx vitest run src/lib/server/bitrix.test.ts -t "функции портала"`
Expected: PASS, `Tests  30 passed | N skipped`.

- [ ] **Step 10: Написать падающие тесты цикла C (createTask, tagTask)**

Вставь перед последней строкой файла `});`:

```ts
	describe('createTask', () => {
		const item = (over: Record<string, unknown> = {}) => ({
			result: { item: { id: 745181, link: '/workgroups/group/2014/tasks/task/view/745181/', ...over } },
			time
		});

		it('шлёт поля v3 с ключом идемпотентности и склеивает ссылку с порталом', async () => {
			const { calls, opts } = portal(() => reply(item()));
			const f = fields({ groupId: 2014, deadline: '2026-10-01', important: true });
			const task = await createTask(hook, f, { timeZone: 'Europe/Kaliningrad', portalOffset: '+03:00' }, 'key-1', opts);
			expect(task).toEqual({ id: 745181, url: 'https://bitrix24.team/workgroups/group/2014/tasks/task/view/745181/' });
			expect(calls).toHaveLength(1);
			expect(calls[0].url).toBe('https://bitrix24.team/rest/api/1/abc123secret/tasks.task.add');
			expect(calls[0].headers.get('Idempotency-Key')).toBe('key-1');
			expect(calls[0].body).toEqual({
				fields: {
					title: 'Починить деплой',
					description: 'Деплой падает по пятницам\n\nИз ретро «Спринт 42»',
					creatorId: 1,
					responsibleId: 1,
					groupId: 2014,
					deadline: '2026-10-01T19:00:00+02:00',
					priority: 'high'
				}
			});
		});

		it('без группы, срока и важности эти поля не передаёт', async () => {
			const { calls, opts } = portal(() => reply(item({ link: '/company/personal/user/1/tasks/task/view/745181/' })));
			await createTask(hook, fields(), { timeZone: null, portalOffset: null }, 'key-2', opts);
			expect(Object.keys(calls[0].body.fields).sort()).toEqual(['creatorId', 'description', 'responsibleId', 'title']);
		});

		it('в тестовом http-режиме ссылка берёт протокол и порт вебхука', async () => {
			const local: Webhook = { url: 'http://localhost:4779/rest/1/testcode/', portal: 'localhost:4779', userId: 1 };
			const { opts } = portal(() => reply(item()));
			const task = await createTask(local, fields(), { timeZone: null, portalOffset: null }, 'k', opts);
			expect(task.url).toBe('http://localhost:4779/workgroups/group/2014/tasks/task/view/745181/');
		});

		it.each([
			['ссылка на чужой хост через @', { link: '@evil.com/tasks/1/' }],
			['protocol-relative ссылка', { link: '//evil.com/tasks/1/' }],
			['ссылки нет', { link: undefined }],
			['ссылка не строка', { link: 42 }],
			['id не число', { id: '745181' }],
			['id ноль', { id: 0 }]
		])('%s → shape, секрета в сообщении нет', async (_name, over) => {
			const { opts } = portal(() => reply(item(over)));
			const err = await createTask(hook, fields(), { timeZone: null, portalOffset: null }, 'k', opts).catch((e) => e);
			expect(err).toBeInstanceOf(BitrixError);
			expect(err.kind).toBe('shape');
			expect(err.message).not.toContain('abc123secret');
		});

		it('ответ без item → shape', async () => {
			const { opts } = portal(() => reply({ result: {}, time }));
			await expect(
				createTask(hook, fields(), { timeZone: null, portalOffset: null }, 'k', opts)
			).rejects.toMatchObject({ kind: 'shape' });
		});

		const accessDenied = { error: { code: 'BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION', message: 'Доступ запрещен' } };

		it('ACCESSDENIEDEXCEPTION при выставленной группе → group с полем groupId', async () => {
			const { opts } = portal(() => reply(accessDenied, 403));
			await expect(
				createTask(hook, fields({ groupId: 999 }), { timeZone: null, portalOffset: null }, 'k', opts)
			).rejects.toMatchObject({ kind: 'group', field: 'groupId' });
		});

		it('ACCESSDENIEDEXCEPTION без группы остаётся access', async () => {
			const { opts } = portal(() => reply(accessDenied, 403));
			await expect(
				createTask(hook, fields(), { timeZone: null, portalOffset: null }, 'k', opts)
			).rejects.toMatchObject({ kind: 'access' });
		});

		it('OVERLOAD_LIMIT при выставленной группе остаётся access', async () => {
			const { opts } = portal(() => reply({ error: 'OVERLOAD_LIMIT', error_description: 'Blocked' }, 401));
			await expect(
				createTask(hook, fields({ groupId: 2014 }), { timeZone: null, portalOffset: null }, 'k', opts)
			).rejects.toMatchObject({ kind: 'access' });
		});

		it('валидация поля groupId при выставленной группе → group', async () => {
			const { opts } = portal(() =>
				reply(
					{
						error: {
							code: 'BITRIX_REST_V3_EXCEPTION_VALIDATION_REQUESTVALIDATIONEXCEPTION',
							message: 'Неверное значение',
							validation: [{ field: 'groupId', message: 'Неверное значение' }]
						}
					},
					400
				)
			);
			await expect(
				createTask(hook, fields({ groupId: 2014 }), { timeZone: null, portalOffset: null }, 'k', opts)
			).rejects.toMatchObject({ kind: 'group', field: 'groupId' });
		});
	});

	describe('tagTask', () => {
		it('ставит тег retro старым REST', async () => {
			const { calls, opts } = portal(() => reply({ result: { task: { id: '745181' } }, time }));
			await tagTask(hook, 745181, opts);
			expect(calls[0].url).toBe('https://bitrix24.team/rest/1/abc123secret/tasks.task.update');
			expect(calls[0].body).toEqual({ taskId: 745181, fields: { TAGS: ['retro'] } });
		});
	});
```

- [ ] **Step 11: Запустить тесты цикла C и убедиться, что они падают**

Run: `npx vitest run src/lib/server/bitrix.test.ts -t "функции портала"`
Expected: FAIL, `Tests  15 failed | 30 passed | N skipped`. Причины падения: `TypeError: (0 , createTask) is not a function`, `TypeError: (0 , tagTask) is not a function`.

- [ ] **Step 12: Реализовать createTask и tagTask**

В шапку `src/lib/server/bitrix.ts` добавь строку (если её там ещё нет):

```ts
import type { CardTask } from '$lib/types.js';
```

Допиши в конец файла, после `idempotencyKey`:

```ts
// Живой портал на несуществующую или чужую groupId отвечает ACCESSDENIEDEXCEPTION.
// Прочие отказы доступа (тариф, OVERLOAD_LIMIT, PORTAL_DELETED) остаются access
function isGroupRefusal(err: unknown): err is BitrixError {
	if (!(err instanceof BitrixError)) return false;
	if (err.kind === 'access') return err.code === 'BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION';
	return err.kind === 'rejected' && /(^|\.)groupId$/.test(err.field ?? '');
}

export async function createTask(
	webhook: Webhook,
	fields: TaskFields,
	tz: { timeZone: string | null; portalOffset: string | null },
	key: string,
	opts?: CallOptions
): Promise<CardTask> {
	const taskFields: Record<string, unknown> = {
		title: fields.title,
		description: fields.description,
		creatorId: webhook.userId,
		responsibleId: webhook.userId
	};
	if (fields.groupId !== null) taskFields.groupId = fields.groupId;
	if (fields.deadline) taskFields.deadline = deadlineIso(fields.deadline, tz.timeZone, tz.portalOffset);
	if (fields.important) taskFields.priority = 'high';

	let result: unknown;
	try {
		result = await callV3(webhook, 'tasks.task.add', { fields: taskFields }, { ...opts, idempotencyKey: key });
	} catch (err) {
		if (fields.groupId !== null && isGroupRefusal(err)) {
			throw new BitrixError('group', 'Bitrix24 group not found or unavailable', {
				code: err.code,
				status: err.status,
				field: 'groupId'
			});
		}
		throw err;
	}

	const item = (result as { item?: { id?: unknown; link?: unknown } } | null)?.item;
	const id = item?.id;
	if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
		throw new BitrixError('shape', 'Bitrix24 task has no id');
	}
	// Только путь от корня портала: '@evil.com/…' или '//evil.com/…' увели бы ссылку на чужой хост
	const link = item?.link;
	if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//')) {
		throw new BitrixError('shape', 'Bitrix24 task link is not a portal path');
	}
	// origin = https://{portal}; в e2e (BITRIX_ALLOW_HTTP) — http://localhost:{port}
	return { id, url: `${new URL(webhook.url).origin}${link}` };
}

export async function tagTask(webhook: Webhook, taskId: number, opts?: CallOptions): Promise<void> {
	// v3 поле tags не принимает (проверено на живом портале) — тег ставит только старый REST
	await callLegacy(webhook, 'tasks.task.update', { taskId, fields: { TAGS: ['retro'] } }, opts);
}
```

- [ ] **Step 13: Запустить тесты цикла C и убедиться, что они проходят**

Run: `npx vitest run src/lib/server/bitrix.test.ts -t "функции портала"`
Expected: PASS, `Tests  45 passed | N skipped`.

- [ ] **Step 14: Написать падающие тесты цикла D (IMAGE_MAX_BYTES, attachImage, слот загрузки)**

Вставь перед последней строкой файла `});`.

Две оговорки к тестам:
- Тест «по умолчанию 4 МБ» рассчитан на то, что `BITRIX_IMAGE_MAX_BYTES` не экспортирована в оболочке, где идёт прогон. В CI её нет.
- Три последних теста идут на фейковых часах. Подменяются только `setTimeout`, `clearTimeout` и `Date`. `setImmediate` остаётся настоящим, и помощник `settle` крутит им цепочку промисов транспорта, не сдвигая часы. `vi.waitFor` на фейковых часах сам двигает время, поэтому здесь он не годится. Держатель слота отпускается в `finally`, так что даже упавший тест не оставляет слот модуля занятым.

```ts
	describe('IMAGE_MAX_BYTES', () => {
		afterEach(() => vi.unstubAllEnvs());

		// Модуль читает BITRIX_IMAGE_MAX_BYTES при импорте — грузим его заново под каждым окружением
		async function load(value: string) {
			vi.resetModules();
			vi.stubEnv('BITRIX_IMAGE_MAX_BYTES', value);
			return (await import('./bitrix.js')).IMAGE_MAX_BYTES;
		}

		it('по умолчанию 4 МБ', () => {
			expect(IMAGE_MAX_BYTES).toBe(4 * 1024 * 1024);
		});

		it('берёт целое > 0 из окружения', async () => {
			expect(await load('1048576')).toBe(1048576);
		});

		it.each(['', '0', '-5', '1.5', 'много'])('мусор %j → 4 МБ', async (value) => {
			expect(await load(value)).toBe(4 * 1024 * 1024);
		});
	});

	describe('attachImage и слот загрузки', () => {
		const image = { cardId: '3f2b8c1e-0000-4000-8000-000000000001', mimeType: 'image/webp', data: Buffer.from('webp-bytes') };

		function disk(uploadResult: unknown = { ID: 9011, FILE_ID: 32877, NAME: 'retro.webp' }) {
			return portal((method) => {
				if (method === 'disk.storage.getlist') return reply({ result: [{ ID: '11', ROOT_OBJECT_ID: '101', ENTITY_TYPE: 'user' }], time });
				if (method === 'disk.storage.uploadFile') return reply({ result: uploadResult, time });
				if (method === 'tasks.task.file.attach') return reply({ result: true, time });
				return reply({ error: 'ERROR_METHOD_NOT_FOUND', error_description: 'Method not found!' }, 404);
			});
		}

		// Часы, которыми управляет тест; setImmediate остаётся настоящим
		const fakeClock = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

		// Настоящие макрозадачи, пока не выполнится условие (не больше 100): промисы успевают пройти, часы стоят
		async function settle(done: () => boolean) {
			for (let i = 0; i < 100 && !done(); i++) await new Promise((resolve) => setImmediate(resolve));
		}

		it('хранилище → загрузка с уникальным именем → прикрепление ID объекта Диска', async () => {
			const { calls, opts } = disk();
			await attachImage(hook, 1, 745181, image, opts);
			expect(calls.map((c) => c.url)).toEqual([
				'https://bitrix24.team/rest/1/abc123secret/disk.storage.getlist',
				'https://bitrix24.team/rest/1/abc123secret/disk.storage.uploadFile',
				'https://bitrix24.team/rest/api/1/abc123secret/tasks.task.file.attach'
			]);
			expect(calls[0].body).toEqual({ filter: { ENTITY_TYPE: 'user', ENTITY_ID: 1 } });
			const name = 'retro-3f2b8c1e-0000-4000-8000-000000000001.webp';
			expect(calls[1].body).toEqual({
				id: '11',
				data: { NAME: name },
				fileContent: [name, Buffer.from('webp-bytes').toString('base64')],
				generateUniqueName: true
			});
			expect(calls[2].body).toEqual({ taskId: 745181, fileIds: [9011] });
		});

		it('ID строкой приводится к числу, FILE_ID не используется', async () => {
			const { calls, opts } = disk({ ID: '9011', FILE_ID: '32877' });
			await attachImage(hook, 1, 745181, image, opts);
			expect(calls[2].body.fileIds).toEqual([9011]);
		});

		it('без ID в ответе загрузки → shape, прикрепления нет', async () => {
			const { calls, opts } = disk({ FILE_ID: 32877 });
			await expect(attachImage(hook, 1, 745181, image, opts)).rejects.toMatchObject({ kind: 'shape' });
			expect(calls).toHaveLength(2);
		});

		it.each([
			['image/gif', 'gif'],
			['image/png', 'png'],
			['image/jpeg', 'jpg'],
			['application/octet-stream', 'bin'],
			['constructor', 'bin']
		])('%s → расширение .%s', async (mimeType, ext) => {
			const { calls, opts } = disk();
			await attachImage(hook, 1, 745181, { ...image, mimeType }, opts);
			expect(calls[1].body.data.NAME).toBe(`retro-${image.cardId}.${ext}`);
			expect(calls[1].body.fileContent[0]).toBe(`retro-${image.cardId}.${ext}`);
		});

		it('нет личного хранилища → shape, загрузки нет', async () => {
			const { calls, opts } = portal(() => reply({ result: [], time }));
			await expect(attachImage(hook, 1, 745181, image, opts)).rejects.toMatchObject({ kind: 'shape' });
			expect(calls).toHaveLength(1);
		});

		it('ошибка загрузки пробрасывается, прикрепления нет', async () => {
			const { calls, opts } = portal((method) =>
				method === 'disk.storage.getlist'
					? reply({ result: [{ ID: '11' }], time })
					: reply({ error: 'insufficient_scope', error_description: 'No disk scope' }, 401)
			);
			await expect(attachImage(hook, 1, 745181, image, opts)).rejects.toBeInstanceOf(BitrixError);
			expect(calls).toHaveLength(2);
		});

		it('слот пропускает загрузки по одной', async () => {
			let releaseFirstUpload!: () => void;
			const gate = new Promise<void>((resolve) => (releaseFirstUpload = resolve));
			let uploads = 0;
			const { calls, opts } = portal(async (method) => {
				if (method === 'disk.storage.getlist') return reply({ result: [{ ID: '11' }], time });
				if (method === 'disk.storage.uploadFile') {
					uploads += 1;
					if (uploads === 1) await gate;
					return reply({ result: { ID: 9000 + uploads }, time });
				}
				return reply({ result: true, time });
			});

			const first = withUploadSlot(() => attachImage(hook, 1, 1, image, opts));
			const second = withUploadSlot(() => attachImage(hook, 1, 2, image, opts));
			await vi.waitFor(() => expect(calls).toHaveLength(2));
			await new Promise((resolve) => setTimeout(resolve, 20));
			// первая загрузка висит — вторая даже не спросила хранилище
			expect(calls.map((c) => c.url.split('/').pop())).toEqual(['disk.storage.getlist', 'disk.storage.uploadFile']);

			releaseFirstUpload();
			await Promise.all([first, second]);
			expect(calls.map((c) => c.url.split('/').pop())).toEqual([
				'disk.storage.getlist',
				'disk.storage.uploadFile',
				'tasks.task.file.attach',
				'disk.storage.getlist',
				'disk.storage.uploadFile',
				'tasks.task.file.attach'
			]);
			expect(calls[2].body).toEqual({ taskId: 1, fileIds: [9001] });
			expect(calls[5].body).toEqual({ taskId: 2, fileIds: [9002] });
		});

		it('упавшая работа освобождает слот и отдаёт свою ошибку', async () => {
			await expect(withUploadSlot(async () => Promise.reject(new Error('упало')))).rejects.toThrow('упало');
			await expect(withUploadSlot(async () => 'дальше')).resolves.toBe('дальше');
		});

		it('ждать слот дольше 30 с → timeout, работа не запускается, очередь не рвётся', async () => {
			fakeClock();
			let releaseFirst!: () => void;
			const gate = new Promise<void>((resolve) => (releaseFirst = resolve));
			try {
				const first = withUploadSlot(async () => {
					await gate;
					return 'первая';
				});
				const secondWork = vi.fn(async () => 'вторая');
				const second = withUploadSlot(secondWork).catch((e) => e);

				await vi.advanceTimersByTimeAsync(29_999);
				expect(secondWork).not.toHaveBeenCalled();
				await vi.advanceTimersByTimeAsync(1);
				const err = await second;
				expect(err).toBeInstanceOf(BitrixError);
				expect(err.kind).toBe('timeout');

				// первая всё ещё держит слот: третья ждёт её, а не проскакивает на место отвалившейся второй
				const thirdWork = vi.fn(async () => 'третья');
				const third = withUploadSlot(thirdWork);
				await settle(() => thirdWork.mock.calls.length > 0);
				expect(thirdWork).not.toHaveBeenCalled();

				releaseFirst();
				await expect(first).resolves.toBe('первая');
				await expect(third).resolves.toBe('третья');
				expect(secondWork).not.toHaveBeenCalled();
			} finally {
				releaseFirst();
				vi.useRealTimers();
			}
		});

		it('на загрузку идёт остаток 30 с от постановки в очередь', async () => {
			fakeClock();
			let releaseFirst!: () => void;
			const gate = new Promise<void>((resolve) => (releaseFirst = resolve));
			try {
				const enqueuedAt = Date.now();
				let abortedAt: number | null = null;
				const { calls, opts } = portal((method, _body, init) => {
					if (method === 'disk.storage.getlist') return reply({ result: [{ ID: '11' }], time });
					// загрузка висит, пока транспорт не оборвёт её по своему таймауту
					return new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener('abort', () => {
							abortedAt = Date.now();
							reject(new DOMException('aborted', 'AbortError'));
						});
					});
				});
				const first = withUploadSlot(() => gate);
				const second = withUploadSlot(() => attachImage(hook, 1, 745181, image, opts)).catch((e) => e);

				// слот освобождается через 20 с после постановки второй в очередь
				await vi.advanceTimersByTimeAsync(20_000);
				releaseFirst();
				await first;
				await settle(() => calls.length === 2);
				expect(calls.map((c) => c.url.split('/').pop())).toEqual(['disk.storage.getlist', 'disk.storage.uploadFile']);

				await vi.advanceTimersByTimeAsync(9_999);
				expect(abortedAt).toBeNull();
				await vi.advanceTimersByTimeAsync(1);
				expect(abortedAt).toBe(enqueuedAt + 30_000);
				expect(await second).toMatchObject({ kind: 'timeout' });
			} finally {
				releaseFirst();
				vi.useRealTimers();
			}
		});

		it('слот освободился за полсекунды до срока → timeout без загрузки файла', async () => {
			fakeClock();
			let releaseFirst!: () => void;
			const gate = new Promise<void>((resolve) => (releaseFirst = resolve));
			try {
				const { calls, opts } = disk();
				const first = withUploadSlot(() => gate);
				const second = withUploadSlot(() => attachImage(hook, 1, 745181, image, opts)).catch((e) => e);

				await vi.advanceTimersByTimeAsync(29_500);
				releaseFirst();
				await first;
				const err = await second;
				expect(err).toBeInstanceOf(BitrixError);
				expect(err.kind).toBe('timeout');
				// base64 не строился, файл на Диск не ушёл
				expect(calls.map((c) => c.url.split('/').pop())).toEqual(['disk.storage.getlist']);
			} finally {
				releaseFirst();
				vi.useRealTimers();
			}
		});
	});
```

- [ ] **Step 15: Запустить тесты цикла D и убедиться, что они падают**

Run: `npx vitest run src/lib/server/bitrix.test.ts -t "функции портала"`
Expected: FAIL быстро, без зависаний: `Tests  22 failed | 45 passed | N skipped`. Причины падения: `AssertionError: expected undefined to be 4194304`, `AssertionError: expected undefined to be 1048576`, `TypeError: (0 , attachImage) is not a function`, `TypeError: (0 , withUploadSlot) is not a function` (включая три теста на фейковых часах: вызов падает синхронно, `finally` возвращает настоящие часы).

- [ ] **Step 16: Реализовать IMAGE_MAX_BYTES, withUploadSlot, attachImage**

Допиши в конец `src/lib/server/bitrix.ts`, после `tagTask`:

```ts
const DEFAULT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

function readImageMaxBytes(raw: string | undefined): number {
	const value = Number(raw);
	return Number.isInteger(value) && value > 0 ? value : DEFAULT_IMAGE_MAX_BYTES;
}

// Анимированный GIF после Sharp бывает до 20 МБ, а процесс живёт в 256 МБ кучи
export const IMAGE_MAX_BYTES = readImageMaxBytes(process.env.BITRIX_IMAGE_MAX_BYTES);

const UPLOAD_TIMEOUT_MS = 30_000;
// Меньше секунды на загрузку — заведомый обрыв: не строим base64 и не шлём файл
const UPLOAD_MIN_BUDGET_MS = 1_000;

// Семафор на одну загрузку: один attach стоит около трёх размеров файла в куче.
// Вызывающий захватывает слот ДО чтения байтов картинки из БД.
// 30 с считаются с постановки в очередь: кто не дождался слота — получает timeout,
// а загрузке внутри слота достаётся остаток этих 30 с
let uploadTail: Promise<void> = Promise.resolve();
// Срок текущего держателя слота. Держатель всегда один, поэтому хватает одной переменной;
// attachImage читает её и потому вызывается только внутри withUploadSlot (или вовсе без слота)
let slotDeadline: number | null = null;

export function withUploadSlot<T>(fn: () => Promise<T>): Promise<T> {
	const deadline = Date.now() + UPLOAD_TIMEOUT_MS;
	const previous = uploadTail;
	let release!: () => void;
	const released = new Promise<void>((resolve) => (release = resolve));
	// Следующий в очереди ждёт и предыдущего держателя, и этот вызов:
	// отвалившийся по таймауту вызов не открывает дорогу параллельной загрузке
	uploadTail = previous.then(() => released);

	return new Promise<T>((resolve, reject) => {
		let expired = false;
		const timer = setTimeout(() => {
			expired = true;
			release();
			reject(new BitrixError('timeout', 'Bitrix24 upload queue timed out'));
		}, UPLOAD_TIMEOUT_MS);

		void previous.then(async () => {
			if (expired) return;
			clearTimeout(timer);
			slotDeadline = deadline;
			try {
				resolve(await fn());
			} catch (err) {
				reject(err);
			} finally {
				slotDeadline = null;
				release();
			}
		});
	});
}

// Остаток 30 с держателя слота; прямой вызов без слота получает полные 30 с
function uploadBudgetMs(): number {
	return slotDeadline === null ? UPLOAD_TIMEOUT_MS : slotDeadline - Date.now();
}

const IMAGE_EXTENSIONS = new Map([
	['image/webp', 'webp'],
	['image/gif', 'gif'],
	['image/png', 'png'],
	['image/jpeg', 'jpg']
]);

export async function attachImage(
	webhook: Webhook,
	userId: number,
	taskId: number,
	image: { cardId: string; mimeType: string; data: Buffer },
	opts?: CallOptions
): Promise<void> {
	// Методы Диска в v3 не переведены — хранилище и загрузка идут старым REST
	const storages = await callLegacy(
		webhook,
		'disk.storage.getlist',
		{ filter: { ENTITY_TYPE: 'user', ENTITY_ID: userId } },
		opts
	);
	const storageId = Array.isArray(storages) ? (storages[0] as { ID?: unknown } | undefined)?.ID : undefined;
	if (storageId === undefined || storageId === null || storageId === '') {
		throw new BitrixError('shape', 'Bitrix24 user storage not found');
	}

	const budget = uploadBudgetMs();
	if (budget < UPLOAD_MIN_BUDGET_MS) {
		throw new BitrixError('timeout', 'Bitrix24 upload slot deadline passed');
	}

	const name = `retro-${image.cardId}.${IMAGE_EXTENSIONS.get(image.mimeType) ?? 'bin'}`;
	const uploaded = await callLegacy(
		webhook,
		'disk.storage.uploadFile',
		{
			id: storageId,
			data: { NAME: name },
			fileContent: [name, image.data.toString('base64')],
			generateUniqueName: true
		},
		{ ...opts, timeoutMs: budget }
	);
	// ID — объект Диска; FILE_ID — внутренний id, его tasks.task.file.attach не находит
	const fileId = Number((uploaded as { ID?: unknown } | null)?.ID);
	if (!Number.isInteger(fileId) || fileId <= 0) {
		throw new BitrixError('shape', 'Bitrix24 upload returned no object id');
	}

	await callV3(webhook, 'tasks.task.file.attach', { taskId, fileIds: [fileId] }, opts);
}
```

- [ ] **Step 17: Запустить тесты цикла D и убедиться, что они проходят**

Run: `npx vitest run src/lib/server/bitrix.test.ts -t "функции портала"`
Expected: PASS, `Tests  67 passed | N skipped`. Тесты на фейковых часах идут миллисекунды, а не 30 секунд.

Run: `npx vitest run src/lib/server/bitrix.test.ts`
Expected: PASS, файл целиком зелёный (тесты задачи 3 и 67 тестов этой задачи).

- [ ] **Step 18: Полный прогон и проверка типов**

Run: `npm test`
Expected: все тестовые файлы PASS, слова `failed` в выводе нет.

Run: `npm run check`
Expected: `svelte-check found 0 errors and 0 warnings`. До задачи ошибок в базе не было, и в `src/lib/server/bitrix.ts` и `bitrix.test.ts` новых не появилось. `timeZoneName: 'longOffset'` типизирован в lib `esnext`, `toFake: ['setTimeout', 'clearTimeout', 'Date']` — в `FakeMethod` vitest 3.

- [ ] **Step 19: Commit**

```bash
git add src/lib/server/bitrix.ts src/lib/server/bitrix.test.ts
git commit -m "$(cat <<'EOF'
Битрикс24: проверка вебхука, группа, задача со сроком, тег и картинка

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Серверная обвязка и экшены пространства

Задача даёт серверу всё, что нужно для панели Битрикс24 в пространстве:
- лимитеры;
- чистые разборщики форм и таблицу статусов по видам ошибок;
- чтение и запись строки `space_bitrix` с зашифрованным вебхуком;
- три экшена `bitrixConnect` / `bitrixDisconnect` / `bitrixSetGroup` и поля `bitrix` / `encryptionEnabled` в load пространства.

Ключей i18n здесь нет: `bitrix.panel.*` и `bitrix.error.*` добавляет задача 6. `createTaskFlow` здесь не пишем, это задача 8: она допишет его в тот же `bitrix-flows.ts`.

**Files:**
- Create: `src/lib/server/bitrix-limits.ts`
- Create: `src/lib/server/bitrix-flows.ts`: первая часть: `ActionErrorKind`, `statusForKind`, `persistsLastError`, `parseGroupId`, `TaskSource`, `ParsedTaskForm`, `parseTaskForm`
- Create: `src/lib/server/bitrix-connection.ts`
- Modify: `src/routes/spaces/[slug]/+page.server.ts`:
  - импорты (строки 1, 12 и строка `import type { PageServerLoad, Actions } from './$types.js';`);
  - модульные помощники перед `export const load`;
  - в `load`: заглушка для закрытого пространства (`return` с `authenticated: false`), загрузка подключения перед `const adminLink`, основной `return`;
  - три новых экшена в конце объекта `actions` после `analyze`.
- Test: `src/lib/server/bitrix-limits.test.ts`
- Test: `src/lib/server/bitrix-flows.test.ts`
- Test: `src/lib/server/bitrix-connection.test.ts`

**Interfaces:**
- Consumes:
  - Задача 1, `src/lib/server/db/schema.ts`: таблица `spaceBitrix` со свойствами `spaceId`, `webhookEnc`, `portal`, `userId`, `userName`, `timeZone`, `portalOffset`, `groupId`, `groupName`, `connectedAt`, `lastError` (колонки `space_id` … `last_error` из спеки, Секция 1).
  - Задача 2: в `src/routes/spaces/[slug]/+page.server.ts` уже сделаны проверяемая cookie доступа (`verify`, `?admin=`, `enablePassword`, `createBoard` через `canViewSpace`). Эти места не трогаем.
  - Задача 3, `src/lib/server/crypto.ts`: `encryptionEnabled: boolean`, `encrypt(plaintext: string | null): string | null`, `decrypt(data: string | null): string | null`.
  - Задача 3, `src/lib/server/bitrix.ts`: `BitrixErrorKind`, `class BitrixError { kind; code?; status?; field? }`, `interface Webhook { url; portal; userId }`, `parseWebhookUrl(raw: string, opts?: { allowHttp?: boolean }): Webhook | null`.
  - Задача 4, `src/lib/server/bitrix.ts`:
    - `verifyWebhook(webhook): Promise<{ userId; userName; timeZone; portalOffset }>`;
    - `checkTasksScope(webhook): Promise<void>`;
    - `resolveGroup(webhook, groupId): Promise<GroupResolution>`;
    - `interface TaskFields { title; description; groupId; deadline; important }`.
  - Существующий `src/lib/server/ratelimit.ts`: `createRateLimiter({ max, windowMs }): RateLimiter`, `RateLimiter { check(ip: string): boolean; size(): number }`.
  - Существующий `src/lib/server/statsd.ts`: `metric(name, value, type = 'c')`.
- Produces:
  - `src/lib/server/bitrix-limits.ts`:
    - `connectLimiter` (5/60 000);
    - `groupLimiter` (30/60 000);
    - `createIpLimiter` (10/60 000);
    - `createSpaceLimiter` (30/3 600 000, ключ `space:${spaceId}`);
    - `runningCards: Set<string>`.
    
    Все пороги `max` умножаются на `BITRIX_LIMIT_MULTIPLIER` (целое ≥ 1, по умолчанию 1, только для e2e).
  - `src/lib/server/bitrix-flows.ts`:
    - `type ActionErrorKind`;
    - `statusForKind(kind: ActionErrorKind): number`;
    - `persistsLastError(kind): kind is 'invalid_webhook' | 'scope' | 'access'`;
    - `parseGroupId(raw: FormDataEntryValue | string | null | undefined): number | null | 'invalid'`;
    - `type TaskSource = 'card' | 'summary' | 'other'`;
    - `type ParsedTaskForm`;
    - `parseTaskForm(form: FormData): ParsedTaskForm`.
    
    Задача 8 дописывает сюда `CreateTaskDeps`, `CreateTaskOutcome`, `createTaskFlow` и нужные им импорты.
  - `src/lib/server/bitrix-connection.ts`:
    - `interface BitrixConnection`;
    - `loadConnection(spaceId)`;
    - `saveConnection(input)`;
    - `updateGroup(spaceId, groupId, groupName)`;
    - `deleteConnection(spaceId)`;
    - `setLastError(spaceId, kind | null)`;
    - `publicInfo(c)`;
    - новое имя `toConnection(row, decryptFn, allowHttpUrls?)`.
  - Page data пространства: `bitrix: { portal, userName, groupId, groupName, lastError } | null` (не null только у создателя) и `encryptionEnabled: boolean` (`false` у не-создателя).
  - Экшены `?/bitrixConnect` (поля `webhook`, `groupId`), `?/bitrixDisconnect` (без полей), `?/bitrixSetGroup` (поле `groupId`):
    - успех: `{ bitrixAction, bitrixSuccess: true, groupNameUnavailable?: true }`;
    - отказ: `fail(statusForKind(kind), { bitrixAction, bitrixError: kind, field?: 'webhook' | 'groupId' })`;
    - не-создатель получает `throw error(403)`.
  - Метрики: `retro.bitrix.connected`, `retro.bitrix.connect_failed.{kind}`, `retro.bitrix.disconnected`.

Решения, принятые в этой задаче (исполнитель их не пересматривает):
- `statusForKind('invalid_url')` = 422. В таблице статусов спеки этого вида нет; это ошибка ввода, как `invalid`.
- `parseTaskForm`:
  - `cardId` должен быть UUID и приводится к нижнему регистру: иначе Postgres упадёт на `uuid`, а ключи `runningCards` и идемпотентности разъедутся;
  - в `description` CRLF заменяется на LF: multipart у `use:enhance` превращает переносы textarea в `\r\n`, а e2e сравнивает описание в моке. Лимит 20 000 считается после замены.
- `parseGroupId` принимает только `1..2147483647`: колонки `group_id` имеют тип `integer`.
- `publicInfo` отдаёт `lastError: 'invalid_webhook'`, если вебхук не расшифровался (`webhook: null`), даже когда `last_error` в строке пуст: панель сразу просит переподключить.
- `bitrixConnect`:
  - если `resolveGroup` вернул `noScope`, id сохраняется без названия и в ответ добавляется `groupNameUnavailable: true`;
  - если `resolveGroup` бросил `BitrixError` (сеть, лимит), подключение падает с этим видом и ничего не сохраняется («Любой шаг падает — ничего не сохраняется»).
- Отказ `bitrixConnect` видом из `persistsLastError` делает `UPDATE … SET last_error`. Если строки нет, запрос ничего не меняет и строка не создаётся. Если строка есть (переподключают сломанный вебхук), предупреждение обновляется.
- `bitrixSetGroup` стирает `last_error` только при успехе, когда портал действительно ответил. Пустое поле группы портал не спрашивает и `last_error` не трогает.

---

- [ ] **Step 1: Сверить предпосылки из задач 1–4**

Run:
```bash
grep -n "export const spaceBitrix" -A 18 src/lib/server/db/schema.ts
grep -n "export const encryptionEnabled" src/lib/server/crypto.ts
grep -nE "export (async )?function (parseWebhookUrl|verifyWebhook|checkTasksScope|resolveGroup)|export class BitrixError|export type (BitrixErrorKind|GroupResolution)|export interface (Webhook|TaskFields)" src/lib/server/bitrix.ts
grep -n "accessToken" "src/routes/spaces/[slug]/+page.server.ts"
```
Expected: каждая команда что-то находит.
- В `spaceBitrix` есть свойства `spaceId, webhookEnc, portal, userId, userName, timeZone, portalOffset, groupId, groupName, connectedAt, lastError`. Если задача 1 назвала их иначе, используй фактические имена в `toConnection`, `saveConnection` и в объекте `row` теста.
- В `bitrix.ts` найдены все восемь экспортов.
- В маршруте пространства есть `accessToken` (сделала задача 2).

- [ ] **Step 2: Write the failing test: лимиты**

Create `src/lib/server/bitrix-limits.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RateLimiter } from './ratelimit.js';

// Лимиты читают BITRIX_LIMIT_MULTIPLIER при импорте — грузим модуль заново под каждым окружением
async function load(multiplier = '') {
	vi.resetModules();
	vi.stubEnv('BITRIX_LIMIT_MULTIPLIER', multiplier);
	return await import('./bitrix-limits.js');
}

function allowedOf(limiter: RateLimiter, key: string, attempts: number): number {
	let allowed = 0;
	for (let i = 0; i < attempts; i++) if (limiter.check(key)) allowed++;
	return allowed;
}

describe('лимиты Битрикс24', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllEnvs();
	});

	it('подключение — 5 попыток в минуту с IP, другой IP считается отдельно, через минуту снова можно', async () => {
		const { connectLimiter } = await load();
		expect(allowedOf(connectLimiter, '10.0.0.1', 7)).toBe(5);
		expect(connectLimiter.check('10.0.0.2')).toBe(true);
		vi.advanceTimersByTime(60_001);
		expect(connectLimiter.check('10.0.0.1')).toBe(true);
	});

	it('проверка группы — 30 в минуту с IP', async () => {
		const { groupLimiter } = await load();
		expect(allowedOf(groupLimiter, '10.0.0.1', 35)).toBe(30);
	});

	it('создание задач — 10 в минуту с IP и 30 в час на пространство', async () => {
		const { createIpLimiter, createSpaceLimiter } = await load();
		expect(allowedOf(createIpLimiter, '10.0.0.1', 12)).toBe(10);
		expect(allowedOf(createSpaceLimiter, 'space:s1', 31)).toBe(30);
		vi.advanceTimersByTime(60_001);
		expect(createSpaceLimiter.check('space:s1')).toBe(false);
		vi.advanceTimersByTime(3_600_000);
		expect(createSpaceLimiter.check('space:s1')).toBe(true);
	});

	it('BITRIX_LIMIT_MULTIPLIER (только e2e) умножает пороги, мусор в нём игнорируется', async () => {
		const scaled = await load('3');
		expect(allowedOf(scaled.connectLimiter, '10.0.0.1', 20)).toBe(15);
		expect(allowedOf(scaled.createIpLimiter, '10.0.0.1', 40)).toBe(30);
		const junk = await load('abc');
		expect(allowedOf(junk.connectLimiter, '10.0.0.1', 20)).toBe(5);
		const zero = await load('0');
		expect(allowedOf(zero.connectLimiter, '10.0.0.1', 20)).toBe(5);
	});

	it('runningCards — пустой Set на процесс', async () => {
		const { runningCards } = await load();
		expect(runningCards).toBeInstanceOf(Set);
		expect(runningCards.size).toBe(0);
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/server/bitrix-limits.test.ts`
Expected: FAIL: `Failed to load url ./bitrix-limits.js … Does the file exist?`, все 5 тестов красные.

- [ ] **Step 4: Write minimal implementation: лимиты**

Create `src/lib/server/bitrix-limits.ts`:
```ts
// Лимиты интеграции с Битрикс24 — in-memory, один процесс (как ratelimit.ts).
// Подключение ограничено до любого исходящего вызова: сервер не должен стать
// прокси для перебора чужих вебхуков. Проверка группы — общий лимитер экшена
// bitrixSetGroup и GET /[slug]/bitrix/group.
import { createRateLimiter, type RateLimiter } from './ratelimit.js';

// Только e2e (playwright.config.ts): весь прогон идёт с одного IP и упирается
// в 5 подключений в минуту. В проде переменная не задаётся — множитель 1.
function limitMultiplier(): number {
	const n = Number(process.env.BITRIX_LIMIT_MULTIPLIER);
	return Number.isInteger(n) && n >= 1 ? n : 1;
}

const m = limitMultiplier();

/** Подключение вебхука: 5 попыток в минуту с IP */
export const connectLimiter: RateLimiter = createRateLimiter({ max: 5 * m, windowMs: 60_000 });
/** Проверка группы (панель и преформа): 30 в минуту с IP */
export const groupLimiter: RateLimiter = createRateLimiter({ max: 30 * m, windowMs: 60_000 });
/** Создание задачи: 10 в минуту с IP */
export const createIpLimiter: RateLimiter = createRateLimiter({ max: 10 * m, windowMs: 60_000 });
/** Создание задачи: 30 в час на пространство, ключ `space:${spaceId}` */
export const createSpaceLimiter: RateLimiter = createRateLimiter({ max: 30 * m, windowMs: 3_600_000 });

/** Карточки, для которых прямо сейчас идёт создание задачи (409 running) */
export const runningCards = new Set<string>();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/server/bitrix-limits.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Write the failing test: статусы, last_error, id группы**

Create `src/lib/server/bitrix-flows.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseGroupId, persistsLastError, statusForKind, type ActionErrorKind } from './bitrix-flows.js';

// Таблица статусов из спеки (Секция 2, «Ошибки экшенов»); invalid_url — ошибка ввода, как invalid
const STATUSES: Record<ActionErrorKind, number> = {
	invalid_url: 422,
	invalid_webhook: 401,
	forbidden: 403,
	scope: 403,
	access: 403,
	not_found: 404,
	not_connected: 409,
	exists: 409,
	running: 409,
	group: 409,
	invalid: 422,
	rejected: 422,
	rate_limited: 429,
	network: 502,
	timeout: 502,
	shape: 502,
	limit: 502,
	encryption: 503
};
const KINDS = Object.keys(STATUSES) as ActionErrorKind[];

describe('statusForKind', () => {
	it('каждому виду ошибки — статус из таблицы', () => {
		const actual = Object.fromEntries(KINDS.map((kind) => [kind, statusForKind(kind)]));
		expect(actual).toEqual(STATUSES);
	});
});

describe('persistsLastError', () => {
	it('в last_error попадают только invalid_webhook, scope и access', () => {
		expect(KINDS.filter((kind) => persistsLastError(kind))).toEqual(['invalid_webhook', 'scope', 'access']);
	});
});

describe('parseGroupId', () => {
	it('пусто, пробелы, null и undefined — без группы', () => {
		expect([parseGroupId(''), parseGroupId('   '), parseGroupId(null), parseGroupId(undefined)]).toEqual([
			null,
			null,
			null,
			null
		]);
	});

	it('целое больше нуля — число, пробелы по краям срезаются', () => {
		expect(parseGroupId('2014')).toBe(2014);
		expect(parseGroupId(' 42 ')).toBe(42);
		expect(parseGroupId('2147483647')).toBe(2147483647);
	});

	it('ноль, минус, дробь, экспонента, буквы и больше integer в БД — invalid', () => {
		const bad = ['0', '-5', '1.5', '1e3', 'abc', '12a', '0x10', '2147483648'];
		expect(bad.map((raw) => parseGroupId(raw))).toEqual(bad.map(() => 'invalid'));
	});

	it('файл вместо строки — invalid', () => {
		expect(parseGroupId(new File(['1'], 'group.txt'))).toBe('invalid');
	});
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/lib/server/bitrix-flows.test.ts`
Expected: FAIL: `Failed to load url ./bitrix-flows.js … Does the file exist?`.

- [ ] **Step 8: Write minimal implementation: статусы, last_error, id группы**

Create `src/lib/server/bitrix-flows.ts`:
```ts
// Чистая часть интеграции с Битрикс24: статусы видов ошибок, разбор форм и
// (задача 8) оркестрация создания задачи с внедрёнными зависимостями.
// Без БД и $env — тестируется напрямую.
import type { BitrixErrorKind } from './bitrix.js';

export type ActionErrorKind =
	| BitrixErrorKind
	| 'forbidden'
	| 'not_found'
	| 'not_connected'
	| 'exists'
	| 'running'
	| 'invalid'
	| 'rate_limited'
	| 'encryption';

// Record заставляет TypeScript требовать статус для каждого нового вида.
// Клиент ветвится по bitrixError, статус — только для HTTP-семантики.
const STATUS: Record<ActionErrorKind, number> = {
	invalid_url: 422,
	invalid_webhook: 401,
	forbidden: 403,
	scope: 403,
	access: 403,
	not_found: 404,
	not_connected: 409,
	exists: 409,
	running: 409,
	group: 409,
	invalid: 422,
	rejected: 422,
	rate_limited: 429,
	network: 502,
	timeout: 502,
	shape: 502,
	limit: 502,
	encryption: 503
};

export function statusForKind(kind: ActionErrorKind): number {
	return STATUS[kind];
}

/** Виды, которые экшены на пути fail пишут в space_bitrix.last_error */
export function persistsLastError(kind: ActionErrorKind): kind is 'invalid_webhook' | 'scope' | 'access' {
	return kind === 'invalid_webhook' || kind === 'scope' || kind === 'access';
}

// group_id — integer в Postgres: больше не влезет
const INT4_MAX = 2_147_483_647;

/** '' / пробелы / null → без группы; целое 1..INT4_MAX → число; остальное → 'invalid' */
export function parseGroupId(raw: FormDataEntryValue | string | null | undefined): number | null | 'invalid' {
	if (raw === null || raw === undefined) return null;
	if (typeof raw !== 'string') return 'invalid';
	const value = raw.trim();
	if (!value) return null;
	if (!/^\d+$/.test(value)) return 'invalid';
	const id = Number(value);
	return id > 0 && id <= INT4_MAX ? id : 'invalid';
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/lib/server/bitrix-flows.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 10: Write the failing test: разбор формы задачи**

In `src/lib/server/bitrix-flows.test.ts` replace the import line

было:
```ts
import { parseGroupId, persistsLastError, statusForKind, type ActionErrorKind } from './bitrix-flows.js';
```
стало:
```ts
import { parseGroupId, parseTaskForm, persistsLastError, statusForKind, type ActionErrorKind } from './bitrix-flows.js';
```

Append to the end of the file:
```ts
const CARD_ID = '3f0c9a52-7a1e-4d8b-9c55-1b2e3d4f5a6b';

// null в overrides — поле не отправляется вовсе
function taskForm(overrides: Record<string, string | null> = {}): FormData {
	const values: Record<string, string | null> = {
		cardId: CARD_ID,
		title: 'Починить CI',
		description: 'Падает на main',
		groupId: '',
		deadline: '',
		source: 'card',
		...overrides
	};
	const fd = new FormData();
	for (const [name, value] of Object.entries(values)) if (value !== null) fd.append(name, value);
	return fd;
}

describe('parseTaskForm', () => {
	it('валидная форма: название обрезано, группа числом, срок, важная, источник', () => {
		const parsed = parseTaskForm(
			taskForm({ title: '  Починить CI  ', groupId: '2014', deadline: '2026-10-01', important: 'on', source: 'summary' })
		);
		expect(parsed).toEqual({
			ok: true,
			cardId: CARD_ID,
			fields: { title: 'Починить CI', description: 'Падает на main', groupId: 2014, deadline: '2026-10-01', important: true },
			source: 'summary'
		});
	});

	it('пустые группа и срок — null, без important — false', () => {
		expect(parseTaskForm(taskForm())).toEqual({
			ok: true,
			cardId: CARD_ID,
			fields: { title: 'Починить CI', description: 'Падает на main', groupId: null, deadline: null, important: false },
			source: 'card'
		});
	});

	it('неизвестный или пропущенный source — other: клиентская строка в имя метрики не попадает', () => {
		const odd = parseTaskForm(taskForm({ source: 'x.y.z' }));
		const missing = parseTaskForm(taskForm({ source: null }));
		expect(odd.ok && odd.source).toBe('other');
		expect(missing.ok && missing.source).toBe('other');
	});

	it('cardId приводится к нижнему регистру; пропущенный или не uuid — ошибка cardId', () => {
		const upper = parseTaskForm(taskForm({ cardId: CARD_ID.toUpperCase() }));
		expect(upper.ok && upper.cardId).toBe(CARD_ID);
		const bad = [null, '', 'c1', `${CARD_ID}' OR 1=1`];
		expect(bad.map((cardId) => parseTaskForm(taskForm({ cardId })))).toEqual(bad.map(() => ({ ok: false, field: 'cardId' })));
	});

	it('название: пустое после trim, пропущенное или длиннее 250 — ошибка title, ровно 250 — ок', () => {
		const bad = ['   ', null, 'я'.repeat(251)];
		expect(bad.map((title) => parseTaskForm(taskForm({ title })))).toEqual(bad.map(() => ({ ok: false, field: 'title' })));
		expect(parseTaskForm(taskForm({ title: 'я'.repeat(250) })).ok).toBe(true);
	});

	it('описание: CRLF из multipart становится LF, отступы и ссылки не трогаем', () => {
		const parsed = parseTaskForm(taskForm({ description: '  Текст\r\n\r\nИз ретро «Sprint 42»\r\nhttps://retro.test/abc' }));
		expect(parsed.ok && parsed.fields.description).toBe('  Текст\n\nИз ретро «Sprint 42»\nhttps://retro.test/abc');
	});

	it('описание: лимит 20 000 считается после нормализации, больше — ошибка description, пропущенное — пустая строка', () => {
		expect(parseTaskForm(taskForm({ description: 'x\r\n'.repeat(10_000) })).ok).toBe(true);
		expect(parseTaskForm(taskForm({ description: 'x'.repeat(20_001) }))).toEqual({ ok: false, field: 'description' });
		const missing = parseTaskForm(taskForm({ description: null }));
		expect(missing.ok && missing.fields.description).toBe('');
	});

	it('группа не число — ошибка groupId', () => {
		expect(parseTaskForm(taskForm({ groupId: 'Платформа' }))).toEqual({ ok: false, field: 'groupId' });
	});

	it('срок: только настоящая дата YYYY-MM-DD', () => {
		const bad = ['2026-02-30', '2026-13-01', '01.10.2026', '2026-1-5', 'tomorrow'];
		expect(bad.map((deadline) => parseTaskForm(taskForm({ deadline })))).toEqual(
			bad.map(() => ({ ok: false, field: 'deadline' }))
		);
		const leap = parseTaskForm(taskForm({ deadline: '2028-02-29' }));
		expect(leap.ok && leap.fields.deadline).toBe('2028-02-29');
	});

	it('поля проверяются по порядку: cardId раньше title', () => {
		expect(parseTaskForm(taskForm({ cardId: 'bad', title: '' }))).toEqual({ ok: false, field: 'cardId' });
	});
});
```

- [ ] **Step 11: Run test to verify it fails**

Run: `npx vitest run src/lib/server/bitrix-flows.test.ts`
Expected: FAIL. 10 тестов `parseTaskForm` красные с `TypeError: … parseTaskForm is not a function`, 7 тестов шагов 6–9 зелёные.

- [ ] **Step 12: Write minimal implementation: разбор формы задачи**

In `src/lib/server/bitrix-flows.ts` replace the import line

было:
```ts
import type { BitrixErrorKind } from './bitrix.js';
```
стало:
```ts
import type { BitrixErrorKind, TaskFields } from './bitrix.js';
```

Append to the end of `src/lib/server/bitrix-flows.ts`:
```ts
export type TaskSource = 'card' | 'summary' | 'other';

export type ParsedTaskForm =
	| { ok: true; cardId: string; fields: TaskFields; source: TaskSource }
	| { ok: false; field: 'cardId' | 'title' | 'description' | 'groupId' | 'deadline' };

const TITLE_MAX = 250;
const DESCRIPTION_MAX = 20_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Файл вместо строки считаем пустым полем
function text(value: FormDataEntryValue | null): string {
	return typeof value === 'string' ? value : '';
}

// '' → без срока; YYYY-MM-DD настоящей даты → как есть; иначе 'invalid'
function parseDeadline(raw: string): string | null | 'invalid' {
	const value = raw.trim();
	if (!value) return null;
	const match = ISO_DATE.exec(value);
	if (!match) return 'invalid';
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const date = new Date(Date.UTC(year, month - 1, day));
	const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
	return real ? value : 'invalid';
}

/** Форма преформы → поля задачи. Первая ошибка по порядку cardId → title → description → groupId → deadline */
export function parseTaskForm(form: FormData): ParsedTaskForm {
	// Ключ runningCards и идемпотентности — всегда в одном регистре; не-uuid уронил бы запрос к cards.id
	const cardId = text(form.get('cardId')).trim().toLowerCase();
	if (!UUID.test(cardId)) return { ok: false, field: 'cardId' };

	const title = text(form.get('title')).trim();
	if (!title || title.length > TITLE_MAX) return { ok: false, field: 'title' };

	// multipart приносит переносы textarea как CRLF — в портал и в ключ идемпотентности уходит LF
	const description = text(form.get('description')).replace(/\r\n?/g, '\n');
	if (description.length > DESCRIPTION_MAX) return { ok: false, field: 'description' };

	const groupId = parseGroupId(form.get('groupId'));
	if (groupId === 'invalid') return { ok: false, field: 'groupId' };

	const deadline = parseDeadline(text(form.get('deadline')));
	if (deadline === 'invalid') return { ok: false, field: 'deadline' };

	// В имя метрики попадает только серверное перечисление
	const rawSource = form.get('source');
	const source: TaskSource = rawSource === 'card' || rawSource === 'summary' ? rawSource : 'other';

	return {
		ok: true,
		cardId,
		fields: { title, description, groupId, deadline, important: form.get('important') === 'on' },
		source
	};
}
```

- [ ] **Step 13: Run test to verify it passes**

Run: `npx vitest run src/lib/server/bitrix-flows.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 14: Write the failing test: подключение из строки и publicInfo**

Create `src/lib/server/bitrix-connection.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { publicInfo, toConnection, type BitrixConnection } from './bitrix-connection.js';

type Row = Parameters<typeof toConnection>[0];

const WEBHOOK = 'https://bitrix24.team/rest/1/abc123secret/';

const row: Row = {
	spaceId: '5b0f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e',
	webhookEnc: 'iv.ciphertext',
	portal: 'bitrix24.team',
	userId: 1,
	userName: 'Никита Щербо',
	timeZone: 'Europe/Kaliningrad',
	portalOffset: '+03:00',
	groupId: 2014,
	groupName: 'Платформа',
	connectedAt: new Date('2026-09-17T10:00:00Z'),
	lastError: null
};

// Подмена decrypt: знает только свой шифротекст, остальное возвращает как есть —
// так ведёт себя crypto.decrypt при сменённом ключе
const decryptTo = (plain: string) => (data: string) => (data === 'iv.ciphertext' ? plain : data);

describe('toConnection', () => {
	it('расшифрованный адрес становится webhook, поля строки переносятся как есть', () => {
		expect(toConnection(row, decryptTo(WEBHOOK))).toEqual({
			spaceId: row.spaceId,
			portal: 'bitrix24.team',
			userId: 1,
			userName: 'Никита Щербо',
			timeZone: 'Europe/Kaliningrad',
			portalOffset: '+03:00',
			groupId: 2014,
			groupName: 'Платформа',
			lastError: null,
			webhook: { url: WEBHOOK, portal: 'bitrix24.team', userId: 1 }
		});
	});

	it('ключ сменили — decrypt вернул шифротекст, webhook: null', () => {
		expect(toConnection(row, (data) => data).webhook).toBeNull();
	});

	it('decrypt вернул null — webhook: null', () => {
		expect(toConnection(row, () => null).webhook).toBeNull();
	});

	it('http://localhost принимается только с allowHttpUrls (e2e)', () => {
		const local = decryptTo('http://localhost:4779/rest/1/testcode/');
		expect(toConnection(row, local).webhook).toBeNull();
		expect(toConnection(row, local, true).webhook?.url).toBe('http://localhost:4779/rest/1/testcode/');
	});
});

const connection = (over: Partial<BitrixConnection> = {}): BitrixConnection => ({
	...toConnection(row, decryptTo(WEBHOOK)),
	...over
});

describe('publicInfo', () => {
	it('наружу уходят портал, владелец, группа и last_error — без адреса, кода и userId', () => {
		const info = publicInfo(connection());
		expect(info).toEqual({
			portal: 'bitrix24.team',
			userName: 'Никита Щербо',
			groupId: 2014,
			groupName: 'Платформа',
			lastError: null
		});
		expect(JSON.stringify(info)).not.toContain('abc123secret');
	});

	it('сохранённый last_error отдаётся как есть', () => {
		expect(publicInfo(connection({ lastError: 'scope' })).lastError).toBe('scope');
	});

	it('вебхук не расшифровался — панель видит invalid_webhook, даже если last_error ещё пуст', () => {
		expect(publicInfo(connection({ webhook: null })).lastError).toBe('invalid_webhook');
	});
});
```

- [ ] **Step 15: Run test to verify it fails**

Run: `npx vitest run src/lib/server/bitrix-connection.test.ts`
Expected: FAIL: `Failed to load url ./bitrix-connection.js … Does the file exist?`.

- [ ] **Step 16: Write minimal implementation: bitrix-connection.ts**

Create `src/lib/server/bitrix-connection.ts`:
```ts
// Подключение пространства к Битрикс24 — строка space_bitrix. Вебхук хранится
// только шифротекстом и расшифровывается на время одного запроса; в page data,
// логи и метрики уходит publicInfo — без адреса и кода.
import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { spaceBitrix } from './db/schema.js';
import { decrypt, encrypt, encryptionEnabled } from './crypto.js';
import { parseWebhookUrl, type Webhook } from './bitrix.js';

export interface BitrixConnection {
	spaceId: string;
	portal: string;
	userId: number;
	userName: string;
	timeZone: string | null;
	portalOffset: string | null;
	groupId: number | null;
	groupName: string | null;
	lastError: string | null;
	/** null — расшифровка или разбор адреса не прошли (ключ сменили) */
	webhook: Webhook | null;
}

// http://localhost разрешён только в e2e (BITRIX_ALLOW_HTTP=1 в playwright.config.ts)
function allowHttp(): boolean {
	return process.env.BITRIX_ALLOW_HTTP === '1';
}

/** Строка таблицы → подключение. Чистая: decrypt подменяется в тесте */
export function toConnection(
	row: typeof spaceBitrix.$inferSelect,
	decryptFn: (data: string) => string | null,
	allowHttpUrls = false
): BitrixConnection {
	// decrypt при чужом ключе возвращает вход как есть — шифротекст не пройдёт parseWebhookUrl
	const plain = decryptFn(row.webhookEnc);
	return {
		spaceId: row.spaceId,
		portal: row.portal,
		userId: row.userId,
		userName: row.userName,
		timeZone: row.timeZone,
		portalOffset: row.portalOffset,
		groupId: row.groupId,
		groupName: row.groupName,
		lastError: row.lastError,
		webhook: plain ? parseWebhookUrl(plain, { allowHttp: allowHttpUrls }) : null
	};
}

export async function loadConnection(spaceId: string): Promise<BitrixConnection | null> {
	const [row] = await db.select().from(spaceBitrix).where(eq(spaceBitrix.spaceId, spaceId)).limit(1);
	return row ? toConnection(row, decrypt, allowHttp()) : null;
}

/** Upsert строки пространства; last_error сбрасывается. Без ключа шифрования — отказ, открытым текстом не храним */
export async function saveConnection(input: {
	spaceId: string;
	webhookUrl: string;
	portal: string;
	userId: number;
	userName: string;
	timeZone: string | null;
	portalOffset: string | null;
	groupId: number | null;
	groupName: string | null;
}): Promise<void> {
	if (!encryptionEnabled) throw new Error('bitrix: encryption is not configured');
	const webhookEnc = encrypt(input.webhookUrl);
	if (!webhookEnc) throw new Error('bitrix: empty webhook');

	const values = {
		webhookEnc,
		portal: input.portal,
		userId: input.userId,
		userName: input.userName,
		timeZone: input.timeZone,
		portalOffset: input.portalOffset,
		groupId: input.groupId,
		groupName: input.groupName,
		connectedAt: new Date(),
		lastError: null
	};
	await db
		.insert(spaceBitrix)
		.values({ spaceId: input.spaceId, ...values })
		.onConflictDoUpdate({ target: spaceBitrix.spaceId, set: values });
}

export async function updateGroup(spaceId: string, groupId: number | null, groupName: string | null): Promise<void> {
	await db.update(spaceBitrix).set({ groupId, groupName }).where(eq(spaceBitrix.spaceId, spaceId));
}

export async function deleteConnection(spaceId: string): Promise<void> {
	await db.delete(spaceBitrix).where(eq(spaceBitrix.spaceId, spaceId));
}

/** UPDATE, не upsert: без строки ничего не создаётся */
export async function setLastError(spaceId: string, kind: 'invalid_webhook' | 'scope' | 'access' | null): Promise<void> {
	await db.update(spaceBitrix).set({ lastError: kind }).where(eq(spaceBitrix.spaceId, spaceId));
}

export function publicInfo(c: BitrixConnection): {
	portal: string;
	userName: string;
	groupId: number | null;
	groupName: string | null;
	lastError: string | null;
} {
	return {
		portal: c.portal,
		userName: c.userName,
		groupId: c.groupId,
		groupName: c.groupName,
		// Вебхук не расшифровался — панель просит подключить заново, даже если экшены ещё не записали last_error
		lastError: c.lastError ?? (c.webhook ? null : 'invalid_webhook')
	};
}
```

- [ ] **Step 17: Run test to verify it passes**

Run: `npx vitest run src/lib/server/bitrix-connection.test.ts`
Expected: PASS, 7 tests. Импорт `./db/index.js` только создаёт пул `pg` и к БД не подключается, как в `space-export.test.ts`.

- [ ] **Step 18: Маршрут пространства: импорты и помощники**

In `src/routes/spaces/[slug]/+page.server.ts`:

было (строка 1):
```ts
import { error, fail, redirect } from '@sveltejs/kit';
```
стало:
```ts
import { error, fail, redirect, type Cookies } from '@sveltejs/kit';
```

было (строка 12):
```ts
import { decrypt } from '$lib/server/crypto.js';
```
стало:
```ts
import { decrypt, encryptionEnabled } from '$lib/server/crypto.js';
```

было:
```ts
import type { PageServerLoad, Actions } from './$types.js';
```
стало:
```ts
import { BitrixError, checkTasksScope, parseWebhookUrl, resolveGroup, verifyWebhook } from '$lib/server/bitrix.js';
import {
	deleteConnection,
	loadConnection,
	publicInfo,
	saveConnection,
	setLastError,
	updateGroup
} from '$lib/server/bitrix-connection.js';
import { connectLimiter, groupLimiter } from '$lib/server/bitrix-limits.js';
import { parseGroupId, persistsLastError, statusForKind, type ActionErrorKind } from '$lib/server/bitrix-flows.js';
import type { PageServerLoad, Actions } from './$types.js';

type BitrixAction = 'connect' | 'disconnect' | 'setGroup';
type BitrixField = 'webhook' | 'groupId';

// Панель Битрикс24 — только создателю пространства; чужому 403, как у rename
async function spaceForCreator(slug: string, cookies: Cookies) {
	const token = cookies.get(`retro_space_creator_${slug}`) ?? '';
	const space = await db.query.spaces.findFirst({ where: eq(spaces.slug, slug) });
	if (!space) throw error(404);
	if (!space.creatorToken || token !== space.creatorToken) throw error(403, 'Forbidden');
	return space;
}

// Один контракт отказа на три экшена панели: клиент ветвится по bitrixError, не по статусу
function bitrixFail(bitrixAction: BitrixAction, kind: ActionErrorKind, field?: BitrixField) {
	return fail(statusForKind(kind), { bitrixAction, bitrixError: kind, ...(field ? { field } : {}) });
}

// В лог — только вид, код и HTTP-статус портала: ни адреса, ни кода вебхука
function logBitrixFailure(event: string, spaceSlug: string, err: BitrixError) {
	console.warn(
		JSON.stringify({ event, space: spaceSlug, kind: err.kind, code: err.code ?? null, status: err.status ?? null })
	);
}
```

Экспортировать эти помощники нельзя: SvelteKit запрещает в `+page.server.ts` экспорты, кроме `load`, `actions` и опций страницы.

- [ ] **Step 19: Маршрут пространства: load отдаёт bitrix и encryptionEnabled**

Ветку доступа (задача 2) не трогаем, правим только три места.

1) Заглушка для закрытого пространства, конец объекта:

было:
```ts
			analysisEnabled: false,
			analysis: null,
			animateTiles: false
		};
```
стало:
```ts
			analysisEnabled: false,
			analysis: null,
			animateTiles: false,
			bitrix: null,
			encryptionEnabled: false
		};
```

2) Перед вычислением `adminLink`:

было:
```ts
	const adminLink = isCreator
```
стало:
```ts
	// Панель Битрикс24 видит только создатель; вебхук в page data не попадает — только publicInfo
	const bitrixConnection = isCreator ? await loadConnection(space.id) : null;

	const adminLink = isCreator
```

3) Основной `return`:

было:
```ts
		analysis: statePayload(analysisRows, new Date()),
		animateTiles,
		boards: spaceBoards.map((b) => {
```
стало:
```ts
		analysis: statePayload(analysisRows, new Date()),
		animateTiles,
		bitrix: bitrixConnection ? publicInfo(bitrixConnection) : null,
		encryptionEnabled: isCreator && encryptionEnabled,
		boards: spaceBoards.map((b) => {
```

- [ ] **Step 20: Маршрут пространства: экшены bitrixConnect, bitrixDisconnect, bitrixSetGroup**

Конец объекта `actions`:

было:
```ts
		return { analysis: 'started' as const };
	}
};
```
стало:
```ts
		return { analysis: 'started' as const };
	},

	// Подключение вебхука. Порядок из спеки (Секция 3): создатель → лимитер (до любого
	// исходящего вызова — сервер не должен стать прокси для перебора чужих вебхуков) →
	// шифрование → адрес → profile → право «Задачи» → группа → upsert.
	// Любой шаг упал — ничего не сохраняем.
	bitrixConnect: async ({ request, params, cookies, getClientAddress }) => {
		const space = await spaceForCreator(params.slug, cookies);
		const failWith = (kind: ActionErrorKind, field?: BitrixField) => {
			metric(`retro.bitrix.connect_failed.${kind}`, 1);
			return bitrixFail('connect', kind, field);
		};

		if (!connectLimiter.check(getClientAddress())) return failWith('rate_limited');
		if (!encryptionEnabled) return failWith('encryption');

		const formData = await request.formData();
		const raw = formData.get('webhook');
		const webhook =
			typeof raw === 'string' ? parseWebhookUrl(raw.trim(), { allowHttp: env.BITRIX_ALLOW_HTTP === '1' }) : null;
		if (!webhook) return failWith('invalid_url', 'webhook');
		const groupId = parseGroupId(formData.get('groupId'));
		if (groupId === 'invalid') return failWith('invalid', 'groupId');

		try {
			const profile = await verifyWebhook(webhook);
			await checkTasksScope(webhook);

			let groupName: string | null = null;
			let groupNameUnavailable = false;
			if (groupId !== null) {
				const group = await resolveGroup(webhook, groupId);
				if (group.status === 'notFound') return failWith('group', 'groupId');
				if (group.status === 'ok') groupName = group.name;
				// noScope: нет права «Рабочие группы соцсети» — сохраняем id без названия
				else groupNameUnavailable = true;
			}

			await saveConnection({
				spaceId: space.id,
				webhookUrl: webhook.url,
				portal: webhook.portal,
				userId: profile.userId,
				userName: profile.userName,
				timeZone: profile.timeZone,
				portalOffset: profile.portalOffset,
				groupId,
				groupName
			});
			metric('retro.bitrix.connected', 1);
			console.info(JSON.stringify({ event: 'bitrix:connected', space: params.slug, portal: webhook.portal }));
			return {
				bitrixAction: 'connect' as const,
				bitrixSuccess: true as const,
				...(groupNameUnavailable ? { groupNameUnavailable: true as const } : {})
			};
		} catch (err) {
			if (!(err instanceof BitrixError)) throw err;
			logBitrixFailure('bitrix:connect_failed', params.slug, err);
			const kind = err.kind;
			// Подключения ещё нет — UPDATE ничего не создаст; есть (переподключают сломанный) — панель покажет предупреждение
			if (persistsLastError(kind)) await setLastError(space.id, kind);
			return failWith(kind, kind === 'group' ? 'groupId' : 'webhook');
		}
	},

	// Отключение: строка уходит, задачи на карточках остаются ссылками
	bitrixDisconnect: async ({ params, cookies }) => {
		const space = await spaceForCreator(params.slug, cookies);
		await deleteConnection(space.id);
		metric('retro.bitrix.disconnected', 1);
		return { bitrixAction: 'disconnect' as const, bitrixSuccess: true as const };
	},

	// Смена группы по умолчанию без повторного ввода вебхука (мы его не показываем).
	// Лимитер общий с GET /[slug]/bitrix/group.
	bitrixSetGroup: async ({ request, params, cookies, getClientAddress }) => {
		const space = await spaceForCreator(params.slug, cookies);
		if (!groupLimiter.check(getClientAddress())) return bitrixFail('setGroup', 'rate_limited');

		const formData = await request.formData();
		const groupId = parseGroupId(formData.get('groupId'));
		if (groupId === 'invalid') return bitrixFail('setGroup', 'invalid', 'groupId');

		const connection = await loadConnection(space.id);
		if (!connection) return bitrixFail('setGroup', 'not_connected');

		// Пустое поле — «без группы»: портал не спрашиваем, last_error не трогаем
		if (groupId === null) {
			await updateGroup(space.id, null, null);
			return { bitrixAction: 'setGroup' as const, bitrixSuccess: true as const };
		}

		// Не расшифровался (ключ сменили) — просим подключить заново
		if (!connection.webhook) {
			await setLastError(space.id, 'invalid_webhook');
			return bitrixFail('setGroup', 'invalid_webhook');
		}

		try {
			const group = await resolveGroup(connection.webhook, groupId);
			if (group.status === 'notFound') return bitrixFail('setGroup', 'group', 'groupId');
			await updateGroup(space.id, groupId, group.status === 'ok' ? group.name : null);
			// Портал ответил — вебхук жив, старое предупреждение снимаем
			if (connection.lastError) await setLastError(space.id, null);
			return {
				bitrixAction: 'setGroup' as const,
				bitrixSuccess: true as const,
				...(group.status === 'noScope' ? { groupNameUnavailable: true as const } : {})
			};
		} catch (err) {
			if (!(err instanceof BitrixError)) throw err;
			logBitrixFailure('bitrix:set_group_failed', params.slug, err);
			const kind = err.kind;
			if (persistsLastError(kind)) await setLastError(space.id, kind);
			return bitrixFail('setGroup', kind, kind === 'group' ? 'groupId' : undefined);
		}
	}
};
```

- [ ] **Step 21: Типы и сборка**

Run: `npm run check`
Expected: в `src/routes/spaces/[slug]/+page.server.ts`, `src/lib/server/bitrix-*.ts` и их тестах 0 ошибок, новых ошибок по сравнению с состоянием до задачи нет. `ActionData` страницы пространства теперь включает `bitrixAction` / `bitrixSuccess` / `groupNameUnavailable` / `bitrixError` / `field`. Если check ругается на `row.*` в `toConnection`, значит имена свойств `spaceBitrix` расходятся со Step 1: поправь их по схеме.

Run: `npm run build`
Expected: сборка завершается `✔ done` (adapter-node), без ошибок.

Юнит-тестов у обёрток экшенов нет, их покрывает e2e задачи 11:
- тест 1: подключение с группой, данные панели после перезагрузки, второй контекст панели не видит;
- тест 2: неверный вебхук → ошибка, после перезагрузки «не подключено»;
- тест 6: предупреждение `lastError` после перезагрузки;
- тест 10: отключение;
- тест 12: переход `?bitrix=1` и подключение.

Для e2e задача 11 должна добавить `BITRIX_LIMIT_MULTIPLIER: '100'` в `env` вебсервера приложения в `playwright.config.ts`: прогон идёт с одного IP, и больше пяти подключений в минуту иначе получат `rate_limited`.

- [ ] **Step 22: Полный прогон юнит-тестов**

Run: `npm test`
Expected: PASS, все файлы зелёные, включая `bitrix-limits.test.ts` (5), `bitrix-flows.test.ts` (17), `bitrix-connection.test.ts` (7).

- [ ] **Step 23: Commit**

```bash
git add src/lib/server/bitrix-limits.ts src/lib/server/bitrix-limits.test.ts \
  src/lib/server/bitrix-flows.ts src/lib/server/bitrix-flows.test.ts \
  src/lib/server/bitrix-connection.ts src/lib/server/bitrix-connection.test.ts \
  "src/routes/spaces/[slug]/+page.server.ts"
git commit -m "$(cat <<'EOF'
Битрикс24: подключение пространства — экшены панели, хранилище вебхука, лимиты

bitrixConnect / bitrixDisconnect / bitrixSetGroup на странице пространства,
вебхук в space_bitrix только шифротекстом, в page data — портал, владелец,
группа и последняя ошибка. Разбор форм и статусы видов ошибок — чистый модуль.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Панель Битрикс24 на странице пространства

**Files:**
- Create: `src/lib/bitrix-panel.ts`: чистый выбор ключей текста для панели (ошибка по виду, бейдж успеха)
- Create: `src/lib/bitrix-panel.test.ts`
- Create: `src/lib/components/BitrixPanel.svelte`
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/ru.json`: блок ключей `bitrix.panel.*`, `bitrix.menu.connect`, `bitrix.error.*` сразу после строки `"space.analysis.tile.dismiss"` (строка 236 в обоих файлах)
- Modify: `src/routes/spaces/[slug]/+page.svelte`: импорты (строки 2, 7, 18), состояние (строки 80–82), новый `$effect` и `onMount` перед `async function deleteSpace()` (строка 153), бейдж у H1 (строки 240–244), ряд создателя (строки 253 и 265–272), монтирование панели после collapsible пароля (строки 345–348)
- Test: `src/lib/bitrix-panel.test.ts`, `src/lib/i18n/dictionaries.test.ts` (уже есть)

**Interfaces:**
- Consumes:
  - Задача 5, page data пространства (только создателю): `bitrix: { portal: string; userName: string; groupId: number | null; groupName: string | null; lastError: string | null } | null`, `encryptionEnabled: boolean`.
  - Задача 5, экшены: `?/bitrixConnect` (поля `webhook`, `groupId`), `?/bitrixDisconnect` (без полей), `?/bitrixSetGroup` (`groupId`). Успех: `{ bitrixAction: 'connect' | 'disconnect' | 'setGroup', bitrixSuccess: true, groupNameUnavailable?: true }`. Отказ: `fail(status, { bitrixAction, bitrixError: kind, field?: 'webhook' | 'groupId' })`. Проверка создателя: `throw error(403)`.
  - Контракт: `ActionErrorKind` (значения `bitrixError`), тексты ключей i18n из «Ключи i18n».
- Produces:
  - `BitrixPanel.svelte`, props `{ bitrix, encryptionEnabled, form, open, onclose }`, корень `data-testid="bitrix-panel"` и `id="bitrix-panel"`.
  - Триггер `data-testid="bitrix-panel-toggle"` с `aria-expanded` и `aria-controls="bitrix-panel"`.
  - `/spaces/{slug}?bitrix=1`: у создателя панель раскрыта, фокус в `#bitrix-webhook`. Туда ведёт пункт меню из задачи 10, это проверяет e2e 12 из задачи 11.
  - Ключи i18n `bitrix.panel.*`, `bitrix.menu.connect`, все `bitrix.error.*` в обоих словарях. Задача 10 берёт отсюда `bitrix.error.*` и `bitrix.menu.connect`.
  - `panelErrorKey(kind: string): string` и `panelSuccessKey(action: string | null | undefined): string | null` из `src/lib/bitrix-panel.ts`.
  - Доступные имена для e2e (EN): поля «Inbound webhook» и «Default group (id, optional)»; кнопки «Connect», «Cancel», «Disconnect» (после первого клика «Click again to disconnect»), «Save»; заголовок `h2` «Bitrix24 · {portal}»; строка «Tasks are created by: {userName}»; группа «{id} · {name}».

- [ ] **Step 1: Write the failing test**

Создать `src/lib/bitrix-panel.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

import en from './i18n/en.json';
import ru from './i18n/ru.json';
import { translate } from './i18n/index.js';
import { panelErrorKey, panelSuccessKey } from './bitrix-panel.js';

// Всё, что может прийти в bitrixError: виды портала (BitrixErrorKind) и ошибки экшенов
const KINDS = [
	'invalid_url',
	'invalid_webhook',
	'scope',
	'access',
	'limit',
	'group',
	'rejected',
	'network',
	'timeout',
	'shape',
	'forbidden',
	'not_found',
	'not_connected',
	'running',
	'invalid',
	'rate_limited',
	'encryption'
];

const PANEL_KEYS = [
	'bitrix.panel.toggle',
	'bitrix.panel.intro',
	'bitrix.panel.webhook',
	'bitrix.panel.webhookPlaceholder',
	'bitrix.panel.group',
	'bitrix.panel.connect',
	'bitrix.panel.connecting',
	'bitrix.panel.cancel',
	'bitrix.panel.hint',
	'bitrix.panel.connected',
	'bitrix.panel.disconnected',
	'bitrix.panel.saved',
	'bitrix.panel.createdBy',
	'bitrix.panel.createdByHint',
	'bitrix.panel.defaultGroup',
	'bitrix.panel.noGroup',
	'bitrix.panel.groupEmptyHint',
	'bitrix.panel.save',
	'bitrix.panel.disconnect',
	'bitrix.panel.disconnectConfirm',
	'bitrix.panel.lastError',
	'bitrix.panel.encryptionOff',
	'bitrix.panel.groupNameUnavailable',
	'bitrix.menu.connect'
];

const LOCALES = ['ru', 'en'] as const;

describe('panelErrorKey', () => {
	it('берёт _panel-вариант, если он есть', () => {
		expect(panelErrorKey('invalid_webhook')).toBe('bitrix.error.invalid_webhook_panel');
		expect(panelErrorKey('network')).toBe('bitrix.error.network_panel');
		expect(panelErrorKey('rate_limited')).toBe('bitrix.error.rate_limited_panel');
	});

	it('без _panel-варианта берёт общий ключ вида', () => {
		expect(panelErrorKey('invalid_url')).toBe('bitrix.error.invalid_url');
		expect(panelErrorKey('scope')).toBe('bitrix.error.scope');
		expect(panelErrorKey('access')).toBe('bitrix.error.access');
		expect(panelErrorKey('group')).toBe('bitrix.error.group');
		expect(panelErrorKey('encryption')).toBe('bitrix.error.encryption');
	});

	it('timeout, shape и limit в панели говорят «портал не отвечает», а не текстом модалки', () => {
		for (const kind of ['timeout', 'shape', 'limit']) {
			expect(panelErrorKey(kind)).toBe('bitrix.error.network_panel');
		}
		expect(translate('ru', panelErrorKey('timeout'))).toBe('Портал не отвечает. Попробуйте через минуту.');
		expect(translate('en', panelErrorKey('limit'))).toBe("The portal isn't responding. Try again in a minute.");
	});

	it('неизвестный вид не показывает сырой ключ', () => {
		expect(panelErrorKey('something_new')).toBe('bitrix.error.network_panel');
		expect(panelErrorKey('toString')).toBe('bitrix.error.network_panel');
	});

	it('у каждого вида есть текст в обеих локалях — и в панели, и общий', () => {
		for (const locale of LOCALES) {
			for (const kind of KINDS) {
				const panelKey = panelErrorKey(kind);
				expect(translate(locale, panelKey), `${locale}: ${panelKey}`).not.toBe(panelKey);
				const key = `bitrix.error.${kind}`;
				expect(translate(locale, key), `${locale}: ${key}`).not.toBe(key);
			}
		}
	});

	it('тексты ошибок совпадают с контрактом и макетом', () => {
		expect(translate('ru', 'bitrix.error.invalid_url')).toBe(
			'Это не похоже на входящий вебхук. Нужна ссылка вида https://портал.bitrix24.ru/rest/1/…/'
		);
		expect(translate('en', 'bitrix.error.invalid_url')).toBe(
			"That doesn't look like an inbound webhook. Expected https://portal.bitrix24.com/rest/1/…/"
		);
		expect(translate('ru', 'bitrix.error.invalid_webhook_panel')).toBe(
			'Портал отклонил вебхук. Проверьте, что он не удалён и не истёк.'
		);
		expect(translate('ru', 'bitrix.error.scope')).toBe(
			'У вебхука нет права «Задачи». Добавьте права Задачи, Диск и Рабочие группы соцсети и попробуйте снова.'
		);
		expect(translate('en', 'bitrix.error.rate_limited_panel')).toBe('Too many attempts. Try again in a minute.');
	});

	it('timeout в модалке — тот же текст, что network', () => {
		for (const locale of LOCALES) {
			expect(translate(locale, 'bitrix.error.timeout')).toBe(translate(locale, 'bitrix.error.network'));
		}
	});
});

describe('panelSuccessKey', () => {
	it('бейдж после успешного экшена по его виду', () => {
		expect(panelSuccessKey('connect')).toBe('bitrix.panel.connected');
		expect(panelSuccessKey('disconnect')).toBe('bitrix.panel.disconnected');
		expect(panelSuccessKey('setGroup')).toBe('bitrix.panel.saved');
	});

	it('чужой экшен бейджа не даёт', () => {
		expect(panelSuccessKey('enable')).toBeNull();
		expect(panelSuccessKey('toString')).toBeNull();
		expect(panelSuccessKey(undefined)).toBeNull();
		expect(panelSuccessKey(null)).toBeNull();
	});
});

describe('словари Битрикс24', () => {
	it('ключи панели, меню и ошибок есть и в ru, и в en', () => {
		const errorKeys = [
			...KINDS.map((kind) => `bitrix.error.${kind}`),
			'bitrix.error.invalid_webhook_panel',
			'bitrix.error.network_panel',
			'bitrix.error.rate_limited_panel'
		];
		const dicts: Record<string, Record<string, string>> = { ru, en };
		for (const [locale, dict] of Object.entries(dicts)) {
			for (const key of [...PANEL_KEYS, ...errorKeys]) {
				expect(dict[key], `${locale}: ${key}`).toBeTruthy();
			}
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bitrix-panel.test.ts`
Expected: FAIL, файл не загружается: `Error: Failed to load url ./bitrix-panel.js (resolved id: ./bitrix-panel.js) in …/src/lib/bitrix-panel.test.ts. Does the file exist?`

- [ ] **Step 3: Write minimal implementation**

Создать `src/lib/bitrix-panel.ts`:

```ts
import en from './i18n/en.json';

// Тексты панели Битрикс24 на странице пространства. Чистый модуль: тест гоняет
// его без стора локали, компонент берёт ключ и сам зовёт t().

const DICT: Record<string, string> = en;

// Все сбои связи панель называет одной фразой «Портал не отвечает. Попробуйте
// через минуту» (заметка 9 макета). Общий текст timeout говорит «задача не
// создана» — в панели он не к месту, поэтому вид сводим к network до поиска ключа.
const PANEL_ALIAS = new Map<string, string>([
	['timeout', 'network'],
	['shape', 'network'],
	['limit', 'network']
]);

const SUCCESS_KEYS = new Map<string, string>([
	['connect', 'bitrix.panel.connected'],
	['disconnect', 'bitrix.panel.disconnected'],
	['setGroup', 'bitrix.panel.saved']
]);

/** Ключ текста ошибки в панели: bitrix.error.{kind}_panel, если такой есть, иначе bitrix.error.{kind} */
export function panelErrorKey(kind: string): string {
	const base = PANEL_ALIAS.get(kind) ?? kind;
	const panelKey = `bitrix.error.${base}_panel`;
	if (Object.hasOwn(DICT, panelKey)) return panelKey;
	const key = `bitrix.error.${base}`;
	return Object.hasOwn(DICT, key) ? key : 'bitrix.error.network_panel';
}

/** Бейдж на 2,5 с после успешного экшена панели; null — экшен не из панели */
export function panelSuccessKey(action: string | null | undefined): string | null {
	return (action && SUCCESS_KEYS.get(action)) || null;
}
```

- [ ] **Step 4: Run test to verify it still fails on the dictionaries**

Run: `npx vitest run src/lib/bitrix-panel.test.ts`
Expected: FAIL, `Tests 7 failed | 3 passed (10)`. Проходят только два теста `panelSuccessKey` и «неизвестный вид не показывает сырой ключ». Остальные падают, потому что ключей в словарях ещё нет. Пример: `expected 'bitrix.error.network_panel' to be 'bitrix.error.invalid_webhook_panel'`, `ru: bitrix.panel.toggle: expected undefined to be truthy`.

- [ ] **Step 5: Добавить ключи в `src/lib/i18n/en.json`**

Найти строку `	"space.analysis.tile.dismiss": "Hide",` и сразу после неё вставить:

```json
	"bitrix.panel.toggle": "Bitrix24",
	"bitrix.panel.intro": "Cards on this space's boards can be turned into portal tasks. The webhook key is stored encrypted and is not shown after saving.",
	"bitrix.panel.webhook": "Inbound webhook",
	"bitrix.panel.webhookPlaceholder": "https://portal.bitrix24.com/rest/1/…/",
	"bitrix.panel.group": "Default group (id, optional)",
	"bitrix.panel.connect": "Connect",
	"bitrix.panel.connecting": "Checking…",
	"bitrix.panel.cancel": "Cancel",
	"bitrix.panel.hint": "Where to get it: Bitrix24 → Developer resources → Other → Inbound webhook. Permissions: Tasks, Drive, Social network workgroups.",
	"bitrix.panel.connected": "Connected",
	"bitrix.panel.disconnected": "Disconnected",
	"bitrix.panel.saved": "Saved",
	"bitrix.panel.createdBy": "Tasks are created by:",
	"bitrix.panel.createdByHint": "responsible and creator of every task from this space",
	"bitrix.panel.defaultGroup": "Default group:",
	"bitrix.panel.noGroup": "not set",
	"bitrix.panel.groupEmptyHint": "empty = no group",
	"bitrix.panel.save": "Save",
	"bitrix.panel.disconnect": "Disconnect",
	"bitrix.panel.disconnectConfirm": "Click again to disconnect",
	"bitrix.panel.lastError": "The webhook stopped working — reconnect it.",
	"bitrix.panel.encryptionOff": "Encryption is not configured on this server; connecting is unavailable.",
	"bitrix.panel.groupNameUnavailable": "Group name unavailable: the webhook lacks the Social network workgroups permission.",
	"bitrix.menu.connect": "Connect Bitrix24",
	"bitrix.error.invalid_url": "That doesn't look like an inbound webhook. Expected https://portal.bitrix24.com/rest/1/…/",
	"bitrix.error.invalid_webhook": "The webhook no longer works — the portal rejected the request.",
	"bitrix.error.invalid_webhook_panel": "The portal rejected the webhook. Check it hasn't been deleted or expired.",
	"bitrix.error.scope": "The webhook lacks the Tasks permission. Add Tasks, Drive and Social network workgroups, then try again.",
	"bitrix.error.access": "The portal refused: check your plan and permissions or contact Bitrix24 support.",
	"bitrix.error.limit": "The portal is overloaded, try again in a minute.",
	"bitrix.error.group": "Group not found or unavailable.",
	"bitrix.error.rejected": "The portal rejected the task: {message}",
	"bitrix.error.network": "The portal isn't responding. The task was not created — check the connection and try again.",
	"bitrix.error.network_panel": "The portal isn't responding. Try again in a minute.",
	"bitrix.error.timeout": "The portal isn't responding. The task was not created — check the connection and try again.",
	"bitrix.error.shape": "Unexpected reply from the portal. Try again.",
	"bitrix.error.forbidden": "You can't create tasks from this board.",
	"bitrix.error.not_found": "The card was deleted — no task was created.",
	"bitrix.error.not_connected": "Bitrix24 is not connected to this space.",
	"bitrix.error.running": "Another facilitator is already creating this task — please wait.",
	"bitrix.error.invalid": "Check the form fields.",
	"bitrix.error.rate_limited": "Limit: 30 tasks per hour per space and 10 per minute. Try again later.",
	"bitrix.error.rate_limited_panel": "Too many attempts. Try again in a minute.",
	"bitrix.error.encryption": "Encryption is not configured on this server; connecting is unavailable.",
```

- [ ] **Step 6: Добавить ключи в `src/lib/i18n/ru.json`**

Найти строку `	"space.analysis.tile.dismiss": "Скрыть",` и сразу после неё вставить:

```json
	"bitrix.panel.toggle": "Битрикс24",
	"bitrix.panel.intro": "Карточки досок этого пространства можно превращать в задачи портала. Ключ вебхука хранится зашифрованно и после сохранения не показывается.",
	"bitrix.panel.webhook": "Входящий вебхук",
	"bitrix.panel.webhookPlaceholder": "https://портал.bitrix24.ru/rest/1/…/",
	"bitrix.panel.group": "Группа по умолчанию (id, необязательно)",
	"bitrix.panel.connect": "Подключить",
	"bitrix.panel.connecting": "Проверяем…",
	"bitrix.panel.cancel": "Отмена",
	"bitrix.panel.hint": "Где взять: Битрикс24 → Разработчикам → Другое → Входящий вебхук. Права: Задачи, Диск, Рабочие группы соцсети.",
	"bitrix.panel.connected": "Подключено",
	"bitrix.panel.disconnected": "Отключено",
	"bitrix.panel.saved": "Сохранено",
	"bitrix.panel.createdBy": "Задачи создаёт:",
	"bitrix.panel.createdByHint": "ответственный и постановщик всех задач из этого пространства",
	"bitrix.panel.defaultGroup": "Группа по умолчанию:",
	"bitrix.panel.noGroup": "не задана",
	"bitrix.panel.groupEmptyHint": "пусто = без группы",
	"bitrix.panel.save": "Сохранить",
	"bitrix.panel.disconnect": "Отключить",
	"bitrix.panel.disconnectConfirm": "Нажмите ещё раз — отключить",
	"bitrix.panel.lastError": "Вебхук перестал работать — подключите заново.",
	"bitrix.panel.encryptionOff": "На сервере не настроено шифрование, подключение недоступно.",
	"bitrix.panel.groupNameUnavailable": "Название группы недоступно: у вебхука нет права «Рабочие группы соцсети».",
	"bitrix.menu.connect": "Подключить Битрикс24",
	"bitrix.error.invalid_url": "Это не похоже на входящий вебхук. Нужна ссылка вида https://портал.bitrix24.ru/rest/1/…/",
	"bitrix.error.invalid_webhook": "Вебхук больше не работает — портал отклонил запрос.",
	"bitrix.error.invalid_webhook_panel": "Портал отклонил вебхук. Проверьте, что он не удалён и не истёк.",
	"bitrix.error.scope": "У вебхука нет права «Задачи». Добавьте права Задачи, Диск и Рабочие группы соцсети и попробуйте снова.",
	"bitrix.error.access": "Портал отказал: проверьте тариф и права или обратитесь в поддержку Битрикс24.",
	"bitrix.error.limit": "Портал перегружен, попробуйте через минуту.",
	"bitrix.error.group": "Группа не найдена или недоступна.",
	"bitrix.error.rejected": "Портал отклонил задачу: {message}",
	"bitrix.error.network": "Портал не отвечает. Задача не создана — проверьте связь и попробуйте ещё раз.",
	"bitrix.error.network_panel": "Портал не отвечает. Попробуйте через минуту.",
	"bitrix.error.timeout": "Портал не отвечает. Задача не создана — проверьте связь и попробуйте ещё раз.",
	"bitrix.error.shape": "Непонятный ответ портала. Попробуйте ещё раз.",
	"bitrix.error.forbidden": "Нет прав создавать задачи с этой доски.",
	"bitrix.error.not_found": "Карточка удалена — задача не создана.",
	"bitrix.error.not_connected": "Битрикс24 не подключён к этому пространству.",
	"bitrix.error.running": "Задачу уже создаёт другой ведущий — подождите.",
	"bitrix.error.invalid": "Проверьте поля формы.",
	"bitrix.error.rate_limited": "Лимит: 30 задач в час на пространство и 10 в минуту. Попробуйте позже.",
	"bitrix.error.rate_limited_panel": "Слишком много попыток. Попробуйте через минуту.",
	"bitrix.error.encryption": "На сервере не настроено шифрование, подключение недоступно.",
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/lib/bitrix-panel.test.ts src/lib/i18n/dictionaries.test.ts`
Expected: PASS, `Test Files 2 passed`, `Tests 13 passed (13)` (10 тестов панели и 3 теста целостности словарей).

- [ ] **Step 8: Создать компонент `src/lib/components/BitrixPanel.svelte`**

Полный файл:

```svelte
<script lang="ts">
	import { onDestroy, tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { t } from '$lib/i18n/index.js';
	import { panelErrorKey } from '$lib/bitrix-panel.js';

	// Панель Битрикс24 на странице пространства, только для создателя (заметки
	// макета 1–9, спека Секция 4). Состояния: не подключено / проверка / подключено /
	// ошибка / вебхук перестал работать (lastError) / шифрование не настроено.
	// Данные — только из data.bitrix: после успешного экшена use:enhance делает
	// invalidateAll, и load перечитывает space_bitrix. Бейдж «Подключено /
	// Отключено / Сохранено» у заголовка страницы рисует сама страница, как у пароля.
	interface PanelInfo {
		portal: string;
		userName: string;
		groupId: number | null;
		groupName: string | null;
		lastError: string | null;
	}
	// Поля ответа экшенов bitrixConnect / bitrixDisconnect / bitrixSetGroup.
	// У остальных экшенов страницы (rename, пароль, анализ) их нет
	interface PanelForm {
		bitrixAction?: string;
		bitrixSuccess?: boolean;
		bitrixError?: string;
		field?: string;
		groupNameUnavailable?: boolean;
	}
	type Field = 'webhook' | 'groupId';

	let {
		bitrix,
		encryptionEnabled,
		form,
		open,
		onclose
	}: {
		bitrix: PanelInfo | null;
		encryptionEnabled: boolean;
		form: PanelForm | null | undefined;
		open: boolean;
		onclose: () => void;
	} = $props();

	let connecting = $state(false);
	let error = $state<{ kind: string; field: Field | null } | null>(null);
	let shaking = $state<Field | null>(null);
	let groupNameUnavailable = $state(false);

	let editingGroup = $state(false);
	let groupValue = $state('');
	let savingGroup = $state(false);
	// Значение, на котором setGroup уже упал: blur с ним не шлёт запрос повторно
	let failedGroupValue: string | null = null;

	let confirmDisconnect = $state(false);
	let disconnecting = $state(false);

	let webhookInput: HTMLInputElement | undefined = $state();
	let connectGroupInput: HTMLInputElement | undefined = $state();
	let editGroupInput: HTMLInputElement | undefined = $state();
	let groupForm: HTMLFormElement | undefined = $state();
	let disconnectForm: HTMLFormElement | undefined = $state();

	let shakeTimer: ReturnType<typeof setTimeout> | undefined;
	let confirmTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => {
		clearTimeout(shakeTimer);
		clearTimeout(confirmTimer);
	});

	let errorText = $derived(error ? t(panelErrorKey(error.kind)) : '');
	let initial = $derived(bitrix ? bitrix.userName.trim().charAt(0).toUpperCase() : '');
	let savedGroup = $derived(bitrix && bitrix.groupId !== null ? String(bitrix.groupId) : '');

	// Группа — только цифры: буквы не долетают до сервера и не тратят лимит
	function digitsOnly(input: HTMLInputElement): string {
		const digits = input.value.replace(/\D/g, '');
		if (digits !== input.value) input.value = digits;
		return digits;
	}

	// Ошибка: текст 13 text-bad под рядом, рамка border-bad и shake на 600 мс,
	// фокус возвращается в поле, введённое не стираем (заметка 9)
	function showError(kind: string, field: Field | null) {
		error = { kind, field };
		if (!field) return;
		clearTimeout(shakeTimer);
		shaking = field;
		shakeTimer = setTimeout(() => (shaking = null), 600);
		// preventScroll: панель могла только что раскрыться, а фокус внутри
		// overflow:hidden прокрутил бы её содержимое
		tick().then(() => {
			const input = field === 'webhook' ? webhookInput : editingGroup ? editGroupInput : connectGroupInput;
			input?.focus({ preventScroll: true });
		});
	}

	// Ответ экшена. untrack: showError читает editingGroup и инпуты — эффект
	// должен зависеть только от form
	$effect(() => {
		const f = form;
		if (!f?.bitrixAction) return;
		const action = f.bitrixAction;
		const kind = f.bitrixError;
		const field = f.field;
		const success = f.bitrixSuccess === true;
		const unavailable = f.groupNameUnavailable === true;
		untrack(() => {
			if (success) {
				error = null;
				editingGroup = false;
				groupNameUnavailable = unavailable;
			} else if (kind) {
				const target: Field | null =
					action === 'setGroup' || field === 'groupId' ? 'groupId' : action === 'connect' ? 'webhook' : null;
				showError(kind, target);
			}
		});
	});

	// Свернули панель — сбрасываем локальное: ошибку, правку группы, подтверждение
	$effect(() => {
		if (open) return;
		untrack(() => {
			error = null;
			shaking = null;
			groupNameUnavailable = false;
			editingGroup = false;
			confirmDisconnect = false;
			clearTimeout(confirmTimer);
		});
	});

	const submitConnect: SubmitFunction = ({ formData, cancel }) => {
		if (connecting) return cancel();
		// Пустое поле не отправляем: попытка съела бы лимит подключений впустую
		if (!String(formData.get('webhook') ?? '').trim()) {
			cancel();
			showError('invalid_url', 'webhook');
			return;
		}
		connecting = true;
		error = null;
		groupNameUnavailable = false;
		return async ({ update }) => {
			try {
				await update();
			} finally {
				connecting = false;
			}
		};
	};

	function startGroupEdit() {
		groupValue = savedGroup;
		failedGroupValue = null;
		error = null;
		confirmDisconnect = false;
		editingGroup = true;
	}

	function cancelGroupEdit() {
		editingGroup = false;
		error = null;
	}

	// Не изменили — просто закрываем, запрос к порталу не нужен
	function submitGroup() {
		if (!editingGroup || savingGroup) return;
		if (groupValue === savedGroup) {
			cancelGroupEdit();
			return;
		}
		groupForm?.requestSubmit();
	}

	function onGroupKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			submitGroup();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelGroupEdit();
		}
	}

	// Blur сохраняет, как у переименования. Исключения: после Esc инпута уже нет;
	// фокус ушёл на «Сохранить»/«Отмена» этой же формы; значение уже отклонено порталом
	function onGroupBlur(e: FocusEvent) {
		if (!editingGroup || savingGroup) return;
		if (e.relatedTarget instanceof Node && groupForm?.contains(e.relatedTarget)) return;
		if (groupValue === failedGroupValue) {
			cancelGroupEdit();
			return;
		}
		submitGroup();
	}

	const submitGroupForm: SubmitFunction = ({ cancel }) => {
		if (savingGroup) return cancel();
		savingGroup = true;
		error = null;
		const sent = groupValue;
		return async ({ result, update }) => {
			try {
				if (result.type === 'success') editingGroup = false;
				else failedGroupValue = sent;
				await update();
				// Отказ сам load не перечитывает, а setGroup мог записать lastError
				// (вебхук отозван) — панель сразу покажет форму переподключения
				if (result.type === 'failure') await invalidateAll();
			} finally {
				savingGroup = false;
			}
		};
	};

	// Первый клик — красная «Нажмите ещё раз — отключить» на 3 с, второй — отключаем.
	// Без браузерных диалогов (заметка 8)
	function onDisconnectClick() {
		if (disconnecting) return;
		clearTimeout(confirmTimer);
		if (!confirmDisconnect) {
			confirmDisconnect = true;
			confirmTimer = setTimeout(() => (confirmDisconnect = false), 3000);
			return;
		}
		disconnectForm?.requestSubmit();
	}

	const submitDisconnect: SubmitFunction = ({ cancel }) => {
		if (disconnecting) return cancel();
		disconnecting = true;
		error = null;
		return async ({ update }) => {
			try {
				await update();
			} finally {
				disconnecting = false;
				confirmDisconnect = false;
			}
		};
	};

	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
</script>

{#snippet disconnectButton()}
	<button
		type="button"
		onclick={onDisconnectClick}
		disabled={disconnecting}
		class="btn btn-md {confirmDisconnect ? 'btn-danger' : 'btn-secondary hover:bg-bad-bg hover:text-bad'}"
	>
		{t(confirmDisconnect ? 'bitrix.panel.disconnectConfirm' : 'bitrix.panel.disconnect')}
	</button>
{/snippet}

<!-- Тот же collapsible, что у панели пароля. inert: в свёрнутую панель не попасть
     Tab-ом, и фокус по ?bitrix=1 ставится только после раскрытия -->
<div id="bitrix-panel" class="collapsible {open ? 'open' : ''}" inert={!open} data-testid="bitrix-panel">
<!-- Рамка и отступ на внуке: у ребёнка с overflow:hidden они бы остались видны и при 0fr -->
<div>
<div class="mt-7 rounded-2xl border border-border bg-surface-card p-4">
	<!-- Отключение — пустая форма: её отправляет вторым кликом кнопка через requestSubmit -->
	<form method="POST" action="?/bitrixDisconnect" bind:this={disconnectForm} use:enhance={submitDisconnect} class="hidden"></form>

	{#if bitrix && !bitrix.lastError}
		<!-- A3: подключено -->
		<div class="flex flex-col gap-4">
			<div class="flex flex-wrap items-center gap-2">
				<h2 class="min-w-0 max-w-full truncate text-sm font-semibold text-text-primary">
					{t('bitrix.panel.toggle')} · {bitrix.portal}
				</h2>
				<span class="badge badge-outline shrink-0">
					<svg class="h-3 w-3 text-well" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
					{t('bitrix.panel.connected')}
				</span>
			</div>

			<div class="flex items-center gap-3">
				<!-- Аватар владельца вебхука — чернильный инициал, как в шапке доски -->
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {initial ? 'bg-text-primary text-surface' : 'bg-surface-hover text-text-muted'}">
					{#if initial}
						<span class="text-[13px] font-bold leading-none">{initial}</span>
					{:else}
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
					{/if}
				</div>
				<div class="flex min-w-0 flex-col gap-[3px]">
					<p class="text-sm leading-[1.3] text-text-secondary">
						{t('bitrix.panel.createdBy')} <span class="font-semibold text-text-primary">{bitrix.userName}</span>
					</p>
					<p class="text-[13px] leading-[1.4] text-text-secondary">{t('bitrix.panel.createdByHint')}</p>
				</div>
			</div>

			{#if editingGroup}
				<form
					method="POST"
					action="?/bitrixSetGroup"
					bind:this={groupForm}
					use:enhance={submitGroupForm}
					aria-busy={savingGroup}
					class="flex flex-wrap items-center gap-2"
				>
					<label for="bitrix-group-edit" class="text-sm text-text-secondary">{t('bitrix.panel.defaultGroup')}</label>
					<input
						bind:this={editGroupInput}
						id="bitrix-group-edit"
						type="text"
						name="groupId"
						inputmode="numeric"
						autocomplete="off"
						maxlength="10"
						value={groupValue}
						readonly={savingGroup}
						oninput={(e) => (groupValue = digitsOnly(e.currentTarget))}
						onkeydown={onGroupKey}
						onblur={onGroupBlur}
						use:focusAndSelect
						class="input input-md w-32 {error?.field === 'groupId' ? 'border-bad' : ''} {shaking === 'groupId' ? 'animate-[shake_0.5s_ease]' : ''}"
					/>
					<!-- mousedown не забирает фокус у поля: иначе blur сохранил бы раньше, чем сработает «Отмена» -->
					<button type="button" onmousedown={(e) => e.preventDefault()} onclick={submitGroup} disabled={savingGroup} class="btn btn-dark btn-md">
						{t('bitrix.panel.save')}
					</button>
					<button type="button" onmousedown={(e) => e.preventDefault()} onclick={cancelGroupEdit} disabled={savingGroup} class="btn btn-secondary btn-md">
						{t('bitrix.panel.cancel')}
					</button>
					<span class="text-[13px] text-text-muted">{t('bitrix.panel.groupEmptyHint')}</span>
				</form>
			{:else}
				<div class="flex flex-wrap items-center gap-2 text-sm">
					<span class="text-text-secondary">{t('bitrix.panel.defaultGroup')}</span>
					{#if bitrix.groupId !== null}
						<span class="font-semibold text-text-primary">{bitrix.groupName ? `${bitrix.groupId} · ${bitrix.groupName}` : bitrix.groupId}</span>
					{:else}
						<span class="text-text-muted">{t('bitrix.panel.noGroup')}</span>
					{/if}
					<button
						type="button"
						onclick={startGroupEdit}
						class="btn-icon btn-icon-sm shrink-0"
						title={t('bitrix.panel.group')}
						aria-label={t('bitrix.panel.group')}
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
					</button>
				</div>
			{/if}

			{#if groupNameUnavailable && bitrix.groupId !== null && !bitrix.groupName}
				<p class="text-[13px] text-text-muted">{t('bitrix.panel.groupNameUnavailable')}</p>
			{/if}
			{#if errorText}
				<p class="text-[13px] text-bad" role="alert">{errorText}</p>
			{/if}

			<div class="flex">{@render disconnectButton()}</div>
		</div>
	{:else}
		<!-- A1: не подключено; при lastError — та же форма для повторного подключения -->
		{#if bitrix?.lastError}
			<div class="error-box mb-3" role="alert">
				<svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
				{t('bitrix.panel.lastError')}
			</div>
		{/if}

		{#if !encryptionEnabled}
			<p class="text-sm text-text-secondary">{t('bitrix.panel.encryptionOff')}</p>
		{:else}
			<p class="mb-3 text-sm text-text-secondary">{t('bitrix.panel.intro')}</p>
			<!-- novalidate: у type=url своя браузерная подсказка перебила бы тексты ошибок панели.
			     Enter в любом поле — «Подключить» (неявная отправка формы) -->
			<form
				method="POST"
				action="?/bitrixConnect"
				novalidate
				use:enhance={submitConnect}
				aria-busy={connecting}
				class="flex flex-col gap-3"
			>
				<!-- Проверка: поля полупрозрачные и не кликаются, но остаются в форме (readonly, не disabled) -->
				<div class="flex flex-col gap-3 sm:flex-row sm:items-end {connecting ? 'pointer-events-none opacity-50' : ''}">
					<div class="flex min-w-0 flex-1 flex-col gap-1.5">
						<label for="bitrix-webhook" class="text-sm font-semibold text-text-primary">{t('bitrix.panel.webhook')}</label>
						<input
							bind:this={webhookInput}
							id="bitrix-webhook"
							type="url"
							name="webhook"
							autocomplete="off"
							spellcheck="false"
							maxlength="500"
							readonly={connecting}
							placeholder={t('bitrix.panel.webhookPlaceholder')}
							class="input input-md {error?.field === 'webhook' ? 'border-bad' : ''} {shaking === 'webhook' ? 'animate-[shake_0.5s_ease]' : ''}"
						/>
					</div>
					<div class="flex flex-col gap-1.5 sm:w-[290px] sm:shrink-0">
						<label for="bitrix-group" class="text-sm font-semibold text-text-primary">{t('bitrix.panel.group')}</label>
						<input
							bind:this={connectGroupInput}
							id="bitrix-group"
							type="text"
							name="groupId"
							inputmode="numeric"
							autocomplete="off"
							maxlength="10"
							value={bitrix?.groupId ?? ''}
							readonly={connecting}
							oninput={(e) => digitsOnly(e.currentTarget)}
							class="input input-md {error?.field === 'groupId' ? 'border-bad' : ''} {shaking === 'groupId' ? 'animate-[shake_0.5s_ease]' : ''}"
						/>
					</div>
				</div>

				{#if errorText}
					<p class="text-[13px] text-bad" role="alert">{errorText}</p>
				{/if}
				<p class="text-[13px] text-text-muted">{t('bitrix.panel.hint')}</p>

				<div class="flex flex-wrap items-center gap-2">
					<button type="submit" disabled={connecting} class="btn btn-primary btn-md">
						{#if connecting}
							<svg class="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
							{t('bitrix.panel.connecting')}
						{:else}
							{t('bitrix.panel.connect')}
						{/if}
					</button>
					<button type="button" onclick={onclose} class="btn btn-secondary btn-md">
						{t('bitrix.panel.cancel')}
					</button>
				</div>
			</form>
		{/if}

		{#if bitrix}
			<!-- Сломанное подключение можно убрать и без переподключения -->
			<div class="mt-4 flex">{@render disconnectButton()}</div>
		{/if}
	{/if}
</div>
</div>
</div>
```

Проверка: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -i "BitrixPanel\|bitrix-panel"`. Expected: пустой вывод, в новых файлах ошибок нет.

- [ ] **Step 9: Страница пространства — импорты и состояние**

В `src/routes/spaces/[slug]/+page.svelte`:

Было (строка 2):
```ts
	import { onMount, onDestroy, untrack } from 'svelte';
```
Стало:
```ts
	import { onMount, onDestroy, untrack, tick } from 'svelte';
	import { page } from '$app/state';
```

Было (строка 7):
```ts
	import SpacePasswordForm from '$lib/components/SpacePasswordForm.svelte';
```
Стало:
```ts
	import SpacePasswordForm from '$lib/components/SpacePasswordForm.svelte';
	import BitrixPanel from '$lib/components/BitrixPanel.svelte';
```

Было (строка 18):
```ts
	import { truncatedTitle } from '$lib/actions/truncated-title.js';
```
Стало:
```ts
	import { truncatedTitle } from '$lib/actions/truncated-title.js';
	import { panelSuccessKey } from '$lib/bitrix-panel.js';
```

Было (строки 80–82):
```ts
	let passwordOpen = $state(false);
	let passwordShaking = $state(false);
	let passwordSuccess = $state('');
```
Стало:
```ts
	let passwordOpen = $state(false);
	let passwordShaking = $state(false);
	let passwordSuccess = $state('');
	let bitrixOpen = $state(false);
	let bitrixSuccessKey = $state<string | null>(null);
	let bitrixSuccessTimer: ReturnType<typeof setTimeout> | undefined;

	// Подключено и работает — на триггере галочка вместо глифа-ссылки (заметка 1 макета)
	let bitrixConnected = $derived(!!data.bitrix && !data.bitrix.lastError);

	// Открыта одна панель за раз: Битрикс24 сворачивает пароль и наоборот
	function openBitrix() {
		bitrixOpen = true;
		passwordOpen = false;
	}

	function toggleBitrix() {
		if (bitrixOpen) bitrixOpen = false;
		else openBitrix();
	}

	function togglePassword() {
		passwordOpen = !passwordOpen;
		if (passwordOpen) bitrixOpen = false;
	}
```

- [ ] **Step 10: Страница пространства — эффект ответа экшенов и `?bitrix=1`**

Было (строка 153):
```ts
	async function deleteSpace() {
```
Стало:
```ts
	// Ответ экшенов Битрикс24, как у пароля: успех — бейдж у заголовка на 2,5 с;
	// ошибка — панель должна быть видна (её могли свернуть, пока шёл запрос).
	// Текст ошибки, рамку и shake рисует сама панель
	$effect(() => {
		if (!form?.bitrixAction) return;
		if (form.bitrixSuccess) {
			clearTimeout(bitrixSuccessTimer);
			bitrixSuccessKey = panelSuccessKey(form.bitrixAction);
			bitrixSuccessTimer = setTimeout(() => (bitrixSuccessKey = null), 2500);
		} else if (form.bitrixError) {
			openBitrix();
		}
	});

	// Пункт «Подключить Битрикс24» в меню доски ведёт сюда с ?bitrix=1: панель
	// раскрыта, фокус в поле вебхука. tick — дождаться снятия inert;
	// preventScroll — поле внутри раскрывающегося collapsible с overflow:hidden
	onMount(async () => {
		if (!data.isCreator || page.url.searchParams.get('bitrix') !== '1') return;
		openBitrix();
		await tick();
		document.getElementById('bitrix-webhook')?.focus({ preventScroll: true });
	});

	async function deleteSpace() {
```

- [ ] **Step 11: Страница пространства — бейдж, триггер, монтирование панели**

Бейдж у H1. Было (строки 240–244):
```svelte
							{#if passwordSuccess}
								<span class="badge badge-success badge-pop shrink-0">
									{t(passwordSuccess === 'enabled' ? 'space.password.enabled' : 'space.password.disabled')}
								</span>
							{/if}
```
Стало:
```svelte
							{#if passwordSuccess}
								<span class="badge badge-success badge-pop shrink-0">
									{t(passwordSuccess === 'enabled' ? 'space.password.enabled' : 'space.password.disabled')}
								</span>
							{/if}
							{#if bitrixSuccessKey}
								<span class="badge badge-success badge-pop shrink-0">{t(bitrixSuccessKey)}</span>
							{/if}
```

Ряд создателя: теперь в нём три контрола, на узком телефоне ряд переносится. Было (строки 252–254):
```svelte
					{#if data.isCreator}
						<div class="flex items-center gap-3">
							{#if deleteConfirming}
```
Стало:
```svelte
					{#if data.isCreator}
						<div class="flex flex-wrap items-center gap-3">
							{#if deleteConfirming}
```

Триггер перед тумблером «Пароль». Режим удаления сворачивает обе панели. Было (строки 265–272):
```svelte
								<ToggleSwitch
									checked={passwordOpen ? !data.hasPassword : data.hasPassword}
									label={t('space.password.toggle')}
									onchange={() => (passwordOpen = !passwordOpen)}
								/>
								<!-- Delete button -->
								<button
									onclick={() => { deleteConfirming = true; passwordOpen = false; }}
```
Стало:
```svelte
								<!-- Битрикс24 — кнопка, а не тумблер: у подключения нет «вкл/выкл» без данных.
								     Ряд 38px: [Битрикс24 ⌄] [Пароль ◯] [🗑] -->
								<button
									type="button"
									onclick={toggleBitrix}
									class="btn btn-secondary btn-md pr-3.5"
									aria-expanded={bitrixOpen}
									aria-controls="bitrix-panel"
									data-testid="bitrix-panel-toggle"
								>
									{#if bitrixConnected}
										<svg class="h-4 w-4 shrink-0 text-well" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
									{:else}
										<svg class="h-4 w-4 shrink-0 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
									{/if}
									{t('bitrix.panel.toggle')}
									<svg class="h-3.5 w-3.5 shrink-0 text-text-muted transition-transform duration-200 {bitrixOpen ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
								</button>
								<ToggleSwitch
									checked={passwordOpen ? !data.hasPassword : data.hasPassword}
									label={t('space.password.toggle')}
									onchange={togglePassword}
								/>
								<!-- Delete button -->
								<button
									onclick={() => { deleteConfirming = true; passwordOpen = false; bitrixOpen = false; }}
```

Монтирование панели сразу после collapsible пароля, внутри того же `{#if data.isCreator}`. Было (строки 345–351):
```svelte
					</div>
					</div>
					</div>
				{/if}
				</div>

				<SpaceBoardGrid
```
Стало:
```svelte
					</div>
					</div>
					</div>
					<BitrixPanel
						bitrix={data.bitrix ?? null}
						encryptionEnabled={data.encryptionEnabled ?? false}
						{form}
						open={bitrixOpen}
						onclose={() => (bitrixOpen = false)}
					/>
				{/if}
				</div>

				<SpaceBoardGrid
```

- [ ] **Step 12: Проверка типов**

Run: `npm run check`
Expected: новых ошибок и предупреждений нет. В выводе нет строк с `BitrixPanel.svelte`, `bitrix-panel.ts`, `bitrix-panel.test.ts` и `spaces/[slug]/+page.svelte`, итог `svelte-check found 0 errors` (или столько же, сколько было до задачи). Если ругается на `data.bitrix` или `form.bitrixAction`, значит, в задаче 5 не добавлены load или экшены пространства: сначала закрыть задачу 5.

- [ ] **Step 13: Сборка**

Run: `npm run build`
Expected: сборка завершается без ошибок (`✓ built in …`, adapter-node `done`), в выводе нет предупреждений Svelte (`a11y_*`, `state_referenced_locally`, `non_reactive_update`) по `BitrixPanel.svelte` и `spaces/[slug]/+page.svelte`.

- [ ] **Step 14: Все юнит-тесты**

Run: `npm test`
Expected: PASS, все файлы зелёные, включая `src/lib/bitrix-panel.test.ts` и `src/lib/i18n/dictionaries.test.ts`.

- [ ] **Step 15: Ручной сценарий в dev**

Задача 5 должна быть уже сделана.

```bash
docker compose up -d db
DATABASE_URL=postgresql://retro:retro@localhost:5433/retro node migrate.js
DATABASE_URL=postgresql://retro:retro@localhost:5433/retro ENCRYPTION_KEY=$(openssl rand -hex 32) npm run dev
```

1. Создать пространство на `/new`. На странице пространства справа ряд [Битрикс24 ⌄] [Пароль ◯] [🗑], все высотой 38px.
2. Клик «Битрикс24»: панель раскрывается, шеврон повёрнут на 180°, у кнопки `aria-expanded="true"`. Клик по «Пароль»: панель Битрикс24 сворачивается, раскрывается пароль. Снова «Битрикс24»: пароль сворачивается. Корзина сворачивает обе.
3. В свёрнутом виде Tab не заходит в поля панели (`inert`).
4. Пустое поле → «Подключить»: текст «Это не похоже на входящий вебхук…», рамка `border-bad`, тряска, фокус в поле. Во вкладке Network запроса нет.
5. Ввести `https://example.com/foo` и нажать Enter в поле: на полсекунды «Проверяем…» со спиннером, поля полупрозрачные. Затем тот же текст `invalid_url`, введённое не стёрлось.
6. Сделать шесть быстрых попыток подряд: «Слишком много попыток. Попробуйте через минуту.»
7. В поле группы буквы не набираются, только цифры.
8. Открыть `/spaces/{slug}?bitrix=1`: панель раскрыта, курсор в поле вебхука.
9. Необязательно, если есть живой вебхук портала с правом «Задачи»:
   - Подключить с группой. Панель переходит в A3: «Битрикс24 · портал», «Подключено» ✓, аватар, «Задачи создаёт: …», «42 · Название». У H1 на 2,5 с бейдж «Подключено», на триггере ✓.
   - Карандаш → изменить id → Enter: бейдж «Сохранено». Esc и blur без изменений закрывают правку без запроса.
   - «Отключить»: кнопка становится красной «Нажмите ещё раз — отключить» и через 3 с возвращается. Два клика подряд: панель в состоянии A1, у H1 «Отключено».
10. Переключить EN: все подписи английские. Переключить тёмную тему: только токены, без белых пятен.
11. Перезапустить dev без `ENCRYPTION_KEY`: панель показывает «На сервере не настроено шифрование, подключение недоступно.» вместо формы.
12. Открыть пространство в приватном окне (без cookie создателя): кнопки «Битрикс24» и панели нет.

Автоматически это закрепят e2e задачи 11: тест 1 (подключение с группой, перезагрузка, второй контекст панели не видит), тест 2 (неверный вебхук: ошибка в панели, после перезагрузки «не подключено»), тест 12 (`?bitrix=1` открывает панель с фокусом в поле вебхука).

- [ ] **Step 16: Commit**

```bash
git add src/lib/bitrix-panel.ts src/lib/bitrix-panel.test.ts src/lib/components/BitrixPanel.svelte 'src/routes/spaces/[slug]/+page.svelte' src/lib/i18n/en.json src/lib/i18n/ru.json
git commit -m "$(cat <<'EOF'
Панель Битрикс24 на странице пространства: подключение, группа, отключение

Кнопка «Битрикс24» в ряду создателя перед «Паролем», открыта одна панель
за раз, ?bitrix=1 раскрывает панель с фокусом в поле вебхука. Тексты
панели и ошибок интеграции — в обоих словарях.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Реальное время и клиентские сторы

Задача замыкает контур «сервер → все участники доски» и готовит сторы для модалки (задача 10) и экшена (задача 8). Что делаем:
- новый канал шины `board` и ретранслятор в комнату доски в `server.js`;
- счётчик `bitrix:opened`;
- поля и методы Битрикс24 в `boardStore` и `socketStore`;
- новый `bitrixTaskStore`;
- флаг `external` у действия тоста.

Сторы на рунах в этом репозитории тестируются в Vitest: `vite.config.ts` подключает `sveltekit()`, и он компилирует `.svelte.ts`. Так уже работает `src/lib/stores/board.test.ts`. Поэтому `setTask`, `setBitrix`, `trackTaskOpened`, `card:task` и `bitrixTaskStore` покрываем юнит-тестами. Юнит-тестов нет только у `server.js` и `Toasts.svelte`. Для них — `node --check`, `npm run check`, `npm run build` и e2e задачи 11.

**Files:**
- Modify: `src/lib/server/bus.ts` — файл переписывается целиком: общий `currentBus()` и новая `emitBoard`
- Modify: `src/lib/server/bus.test.ts` — импорт и новый блок `describe('emitBoard')` в конце файла
- Modify: `server.js`:
  - ретранслятор `bus.on('board', …)` сразу после `bus.on('space', …)` (по текущему коду строки 369–372);
  - обработчик `socket.on('bitrix:opened', …)` сразу после `socket.on('focus:stop', …)` (строки 735–739), перед `socket.on('disconnect', …)`.
  - После задач 1–2 номера строк могут сдвинуться — ищите по коду.
- Modify: `src/lib/stores/board.svelte.ts`:
  - импорт типов (строка 1);
  - поля `bitrix` и `bitrixOffer` после `isCreator` (строка 9);
  - методы `setBitrix` и `setTask` после `updateCard` (строки 26–28).
- Modify: `src/lib/stores/board.test.ts` — импорт типов (строка 6) и новый блок `describe` в конце файла
- Modify: `src/lib/stores/socket.svelte.ts`:
  - импорт `CardTask` после строки 5;
  - обработчик `card:task` после `comment:created` (строки 76–78);
  - метод `trackTaskOpened` после `createComment` (строки 241–243).
- Create: `src/lib/stores/socket.test.ts`
- Create: `src/lib/stores/bitrix-task.svelte.ts`
- Create: `src/lib/stores/bitrix-task.test.ts`
- Modify: `src/lib/stores/toast.svelte.ts` — тип `ToastAction` (строки 5–9)
- Modify: `src/lib/stores/toast.test.ts` — новый тест в конце `describe('toastStore')`
- Modify: `src/lib/components/Toasts.svelte` — ссылка действия (строки 43–50)

**Interfaces:**
- Consumes (задача 1, `src/lib/types.ts`):
  - `export interface CardTask { id: number; url: string }`
  - `export interface BitrixInfo { spaceSlug: string; portal: string; userName: string; groupId: number | null; groupName: string | null }`
  - у `Card` — поля `bitrixTaskId: number | null; bitrixTaskUrl: string | null`
- Produces:
  - `src/lib/server/bus.ts`: `export function emitBoard(boardSlug: string, event: string, payload: unknown): boolean` — канал `'board'`, сообщение `{ boardSlug, event, payload }`. Задача 8 зовёт её так: `emitBoard(slug, 'card:task', { cardId, task })`.
  - `server.js`:
    - `bus.on('board', ({ boardSlug, event, payload }) => io.to(boardSlug).emit(event, payload))`;
    - `socket.on('bitrix:opened', { source: 'card' | 'summary', creatorToken: string })` → `metric('retro.bitrix.task.opened.' + source, 1)`.
  - `boardStore`:
    - `bitrix = $state<BitrixInfo | null>(null)`;
    - `bitrixOffer = $state(false)`;
    - `setBitrix(info: BitrixInfo | null, offer: boolean): void` — зовёт задача 8 в `src/routes/[slug]/+page.svelte`;
    - `setTask(cardId: string, task: CardTask): void`.
  - `socketStore`:
    - обработчик `card:task { cardId: string, task: CardTask }` → `boardStore.setTask`;
    - `trackTaskOpened(source: 'card' | 'summary'): void`.
  - `bitrixTaskStore` (`src/lib/stores/bitrix-task.svelte.ts`):
    - `current = $state<{ cardId: string; source: 'card' | 'summary' } | null>(null)`;
    - `submitting = $state(false)`;
    - `open(cardId, source)`;
    - `close()`.
  - `ToastAction`: необязательное поле `external?: boolean` в обоих вариантах union. `Toasts.svelte` рисует такую ссылку с `target="_blank" rel="noopener"`.

- [ ] **Step 1: Проверить, что задача 1 на месте**

Run: `grep -n "CardTask\|BitrixInfo\|bitrixTask" src/lib/types.ts src/lib/stores/board.test.ts`

Expected:
- в `src/lib/types.ts` есть `export interface CardTask`, `export interface BitrixInfo`, `bitrixTaskId: number | null;` и `bitrixTaskUrl: string | null;`;
- в `src/lib/stores/board.test.ts` внутри `makeCard` есть `bitrixTaskId: null,` и `bitrixTaskUrl: null,`.

Если типов нет — остановитесь: задача 1 не выполнена. Если нет только полей в `makeCard`, допишите их в базовый объект перед `...overrides`:

```ts
		createdAt: '2025-01-01T00:00:00Z',
		bitrixTaskId: null,
		bitrixTaskUrl: null,
		...overrides
```

- [ ] **Step 2: Write the failing test — `emitBoard`**

В `src/lib/server/bus.test.ts` строку 2 заменить.

Было:

```ts
import { emitSpace } from './bus.js';
```

Стало:

```ts
import { emitSpace, emitBoard } from './bus.js';
```

В конец файла, после закрывающей `});` блока `describe('emitSpace')`, добавить:

```ts

describe('emitBoard', () => {
	afterEach(() => {
		delete g.__retroBus;
	});

	const payload = { cardId: 'c1', task: { id: 7, url: 'https://portal.bitrix24.ru/company/personal/user/1/tasks/task/view/7/' } };

	it('без шины (npm run dev) возвращает false и не падает', () => {
		expect(emitBoard('brd', 'card:task', payload)).toBe(false);
	});

	it('с шиной шлёт событие в канал board со slug доски, именем и payload', () => {
		const seen: unknown[] = [];
		g.__retroBus = { emit: (name: string, msg: unknown) => seen.push([name, msg]) };
		expect(emitBoard('brd', 'card:task', payload)).toBe(true);
		expect(seen).toEqual([['board', { boardSlug: 'brd', event: 'card:task', payload }]]);
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/server/bus.test.ts`

Expected: FAIL — `Tests 2 failed | 2 passed (4)`. Оба теста `emitBoard` падают с `TypeError: (0 , emitBoard) is not a function`.

- [ ] **Step 4: Write minimal implementation — `bus.ts`**

Заменить содержимое `src/lib/server/bus.ts` целиком. `BoardBusMessage` не экспортируется: снаружи нужна только функция.

```ts
// Мост SvelteKit → Socket.IO. Сокет-сервер живёт в server.js в том же процессе
// и кладёт EventEmitter в globalThis; здесь мы только кидаем в него события.
// В npm run dev шины нет — события молча теряются.
export interface SpaceBusMessage {
	spaceSlug: string;
	event: string;
	payload: unknown;
}

// Комната доски в server.js называется её slug (socket.join(slug) в board:join)
interface BoardBusMessage {
	boardSlug: string;
	event: string;
	payload: unknown;
}

interface Bus {
	emit(name: 'space', msg: SpaceBusMessage): unknown;
	emit(name: 'board', msg: BoardBusMessage): unknown;
}

function currentBus(): Bus | undefined {
	return (globalThis as { __retroBus?: Bus }).__retroBus;
}

export function emitSpace(spaceSlug: string, event: string, payload: unknown): boolean {
	const bus = currentBus();
	if (!bus) return false;
	bus.emit('space', { spaceSlug, event, payload });
	return true;
}

/** Событие всем, кто сейчас на доске: server.js ретранслирует канал board в комнату boardSlug */
export function emitBoard(boardSlug: string, event: string, payload: unknown): boolean {
	const bus = currentBus();
	if (!bus) return false;
	bus.emit('board', { boardSlug, event, payload });
	return true;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/server/bus.test.ts`

Expected: PASS — `Tests 4 passed (4)`. Старые тесты `emitSpace` тоже зелёные: рефакторинг на `currentBus()` их не сломал.

- [ ] **Step 6: Ретранслятор канала `board` в `server.js`**

Найти блок ретранслятора пространства (по текущему коду строки 369–372).

Было:

```js
bus.on('space', ({ spaceSlug, event, payload }) => {
	if (typeof spaceSlug !== 'string' || typeof event !== 'string') return;
	io.to(`space:${spaceSlug}`).emit(event, payload);
});
```

Стало:

```js
bus.on('space', ({ spaceSlug, event, payload }) => {
	if (typeof spaceSlug !== 'string' || typeof event !== 'string') return;
	io.to(`space:${spaceSlug}`).emit(event, payload);
});

// Канал доски: экшен createTask сообщает всем на доске о созданной задаче (card:task).
// Комната доски — её slug без префикса, как в board:join.
bus.on('board', ({ boardSlug, event, payload }) => {
	if (typeof boardSlug !== 'string' || !boardSlug || typeof event !== 'string') return;
	io.to(boardSlug).emit(event, payload);
});
```

- [ ] **Step 7: Счётчик `bitrix:opened` в `server.js`**

Внутри `io.on('connection', …)` найти обработчик `focus:stop` (по текущему коду строки 735–739). `isRoomCreator` объявлена выше, в строке 699, и сравнивает токен с `roomCreatorTokens.get(currentRoom)`. Создатель пространства получает в `data.creatorToken` токен доски (см. `src/routes/[slug]/+page.server.ts`, строки 83 и 117), так что проверка пропускает и его.

Было:

```js
	socket.on('focus:stop', (payload) => {
		if (!currentRoom || !isRoomCreator(payload?.creatorToken)) return;
		roomFocus.delete(currentRoom);
		io.to(currentRoom).emit('focus:state', { cardId: null, endTime: null, duration: null, discussed: [] });
	});
```

Стало:

```js
	socket.on('focus:stop', (payload) => {
		if (!currentRoom || !isRoomCreator(payload?.creatorToken)) return;
		roomFocus.delete(currentRoom);
		io.to(currentRoom).emit('focus:state', { cardId: null, endTime: null, duration: null, discussed: [] });
	});

	// --- Битрикс24: открыли преформу задачи — только счётчик ---
	// В имя метрики попадает лишь значение из белого списка, клиентская строка — никогда
	socket.on('bitrix:opened', (payload) => {
		const source = payload?.source;
		if (!currentRoom || !isRoomCreator(payload?.creatorToken)) return;
		if (source !== 'card' && source !== 'summary') return;
		metric('retro.bitrix.task.opened.' + source, 1);
	});
```

- [ ] **Step 8: Проверить синтаксис `server.js`**

Run: `node --check server.js && echo SYNTAX_OK`

Expected: `SYNTAX_OK`. Юнит-тестов у `server.js` нет. Ретранслятор end-to-end проверит e2e задачи 11, сценарий 3: гость видит бейдж без перезагрузки. Для этого нужна вся цепочка: `emitBoard` → `bus.on('board')` → `card:task` → `boardStore.setTask`.

- [ ] **Step 9: Write the failing test — `setBitrix` и `setTask`**

В `src/lib/stores/board.test.ts` строку 6 заменить.

Было:

```ts
import type { Board, Card, Vote, Comment } from '$lib/types.js';
```

Стало:

```ts
import type { Board, Card, Vote, Comment, CardTask, BitrixInfo } from '$lib/types.js';
```

В конец файла, после закрывающей `});` блока `describe('BoardStore')`, добавить. Верхний `beforeEach` файла уже сбрасывает `cards` в `[]` перед каждым тестом.

```ts

describe('BoardStore — Битрикс24', () => {
	const task: CardTask = { id: 745181, url: 'https://portal.bitrix24.ru/workgroups/group/2014/tasks/task/view/745181/' };
	const info: BitrixInfo = {
		spaceSlug: 'space-1',
		portal: 'portal.bitrix24.ru',
		userName: 'Никита Щербо',
		groupId: 2014,
		groupName: 'Платформа'
	};

	it('setBitrix выставляет подключение и предложение подключить, null сбрасывает', () => {
		boardStore.setBitrix(info, false);
		expect(boardStore.bitrix).toEqual(info);
		expect(boardStore.bitrixOffer).toBe(false);

		boardStore.setBitrix(null, true);
		expect(boardStore.bitrix).toBeNull();
		expect(boardStore.bitrixOffer).toBe(true);
	});

	it('setTask проставляет id и ссылку только своей карточке', () => {
		boardStore.addCard(makeCard({ id: 'c1' }));
		boardStore.addCard(makeCard({ id: 'c2' }));

		boardStore.setTask('c1', task);

		expect(boardStore.cards.find((c) => c.id === 'c1')).toMatchObject({ bitrixTaskId: 745181, bitrixTaskUrl: task.url });
		expect(boardStore.cards.find((c) => c.id === 'c2')).toMatchObject({ bitrixTaskId: null, bitrixTaskUrl: null });
	});

	it('setTask не мутирует прежний объект карточки и не трогает остальные поля', () => {
		boardStore.addCard(makeCard({ id: 'c1', content: 'Созвоны по часу' }));
		const before = boardStore.cards[0];

		boardStore.setTask('c1', task);

		expect(before.bitrixTaskId).toBeNull();
		expect(boardStore.cards[0]).not.toBe(before);
		expect(boardStore.cards[0].content).toBe('Созвоны по часу');
	});

	it('setTask для неизвестной карточки и повтор той же задачи не пересоздают массив', () => {
		boardStore.addCard(makeCard({ id: 'c1' }));

		const initial = boardStore.cards;
		boardStore.setTask('gone', task);
		expect(boardStore.cards).toBe(initial);

		boardStore.setTask('c1', task);
		const patched = boardStore.cards;
		expect(patched).not.toBe(initial);

		// Создатель получает задачу дважды: из ответа экшена и по сокету card:task
		boardStore.setTask('c1', task);
		expect(boardStore.cards).toBe(patched);
	});
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run src/lib/stores/board.test.ts`

Expected: FAIL — 4 новых теста падают:
- тест `setBitrix` — с `TypeError: boardStore.setBitrix is not a function`;
- три теста `setTask` — с `TypeError: boardStore.setTask is not a function`.

Остальные тесты файла зелёные.

- [ ] **Step 11: Write minimal implementation — `board.svelte.ts`**

Строка 1.

Было:

```ts
import type { Board, Card, Vote, Comment, BoardState } from '$lib/types.js';
```

Стало:

```ts
import type { Board, Card, Vote, Comment, BoardState, BitrixInfo, CardTask } from '$lib/types.js';
```

Поля после `isCreator = $state(false);` (строка 9).

Было:

```ts
	isCreator = $state(false);

	setState(data: BoardState) {
```

Стало:

```ts
	isCreator = $state(false);
	/** Подключение Битрикс24 для преформы задачи; null — доска вне пространства, нет прав или не подключено */
	bitrix = $state<BitrixInfo | null>(null);
	/** Пункт меню «Подключить Битрикс24»: только создателю пространства, пока не подключено */
	bitrixOffer = $state(false);

	setState(data: BoardState) {
```

Методы сразу после `updateCard` (строки 26–28), перед `removeCard`.

Было:

```ts
	updateCard(updated: Card) {
		this.cards = this.cards.map((c) => (c.id === updated.id ? updated : c));
	}

	removeCard(cardId: string) {
```

Стало:

```ts
	updateCard(updated: Card) {
		this.cards = this.cards.map((c) => (c.id === updated.id ? updated : c));
	}

	setBitrix(info: BitrixInfo | null, offer: boolean) {
		this.bitrix = info;
		this.bitrixOffer = offer;
	}

	/** Задача Битрикс24 у карточки. Создатель получает её дважды — из ответа экшена
	 *  и по сокету card:task, — второй раз массив не пересоздаём */
	setTask(cardId: string, task: CardTask) {
		const card = this.cards.find((c) => c.id === cardId);
		if (!card || (card.bitrixTaskId === task.id && card.bitrixTaskUrl === task.url)) return;
		this.cards = this.cards.map((c) =>
			c.id === cardId ? { ...c, bitrixTaskId: task.id, bitrixTaskUrl: task.url } : c
		);
	}

	removeCard(cardId: string) {
```

`removeCard` не меняется. В спеке, Секция 4, упомянут вызов `cardGone`, но контракт его отменил: исчезнувшую карточку отслеживает `$effect` в `BitrixTaskModal` (задача 10).

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run src/lib/stores/board.test.ts`

Expected: PASS — все тесты файла зелёные, включая 4 новых из блока «BoardStore — Битрикс24».

- [ ] **Step 13: Write the failing test — `external` у действия тоста**

В `src/lib/stores/toast.test.ts` добавить тест последним внутри `describe('toastStore')`, перед его закрывающей `});`.

Было (конец файла):

```ts
		vi.advanceTimersByTime(1_000);
		expect(toastStore.toasts.map((t) => t.text)).toEqual(['b']);
	});
});
```

Стало:

```ts
		vi.advanceTimersByTime(1_000);
		expect(toastStore.toasts.map((t) => t.text)).toEqual(['b']);
	});

	it('ссылка действия может вести наружу: external доезжает до уведомления', () => {
		const href = 'https://portal.bitrix24.ru/workgroups/group/2014/tasks/task/view/745181/';
		toastStore.push({ kind: 'success', text: 'Задача #745181 создана', action: { label: 'Открыть', href, external: true } });
		expect(toastStore.toasts[0].action).toEqual({ label: 'Открыть', href, external: true });
	});
});
```

- [ ] **Step 14: Run check to verify it fails**

Vitest этот тест пропустит и до правки: `push` копирует `input` целиком. Красный сигнал здесь — проверка типов.

Run: `npx vitest run src/lib/stores/toast.test.ts && npm run check`

Expected: vitest — `Tests 4 passed (4)`. `npm run check` — FAIL с новой ошибкой в `src/lib/stores/toast.test.ts`: `Object literal may only specify known properties, and 'external' does not exist in type 'ToastAction'.`

- [ ] **Step 15: Write minimal implementation — `ToastAction.external` и `Toasts.svelte`**

`src/lib/stores/toast.svelte.ts`, строки 5–9.

Было:

```ts
// Действие — ссылка (href) или кнопка (onClick), хотя бы одно из двух.
// После onClick подпись на 2 секунды сменяется на «Скопировано!» (см. Toasts.svelte).
export type ToastAction =
	| { label: string; href: string; onClick?: () => void | Promise<void> }
	| { label: string; href?: string; onClick: () => void | Promise<void> };
```

Стало:

```ts
// Действие — ссылка (href) или кнопка (onClick), хотя бы одно из двух.
// После onClick подпись на 2 секунды сменяется на «Скопировано!» (см. Toasts.svelte).
// external — ссылка уводит с сайта (задача в Битрикс24): новая вкладка, rel="noopener".
export type ToastAction =
	| { label: string; href: string; onClick?: () => void | Promise<void>; external?: boolean }
	| { label: string; href?: string; onClick: () => void | Promise<void>; external?: boolean };
```

`src/lib/components/Toasts.svelte`, ссылка действия (строки 43–50). Атрибут со значением `undefined` Svelte 5 не рендерит, поэтому обычные ссылки остаются как были.

Было:

```svelte
				{#if toast.action?.href}
					<a
						href={toast.action.href}
						onclick={() => toastStore.dismiss(toast.id)}
						class="self-start text-[13px] font-bold text-accent hover:underline"
					>
```

Стало:

```svelte
				{#if toast.action?.href}
					<a
						href={toast.action.href}
						target={toast.action.external ? '_blank' : undefined}
						rel={toast.action.external ? 'noopener' : undefined}
						onclick={() => toastStore.dismiss(toast.id)}
						class="self-start text-[13px] font-bold text-accent hover:underline"
					>
```

- [ ] **Step 16: Run check to verify it passes**

Run: `npx vitest run src/lib/stores/toast.test.ts && npm run check`

Expected: vitest — `Tests 4 passed (4)`. В выводе `npm run check` нет ошибок в `toast.test.ts`, `toast.svelte.ts` и `Toasts.svelte`, а число ошибок не больше, чем до задачи (ожидаемо `svelte-check found 0 errors`).

Тост с `external` рендерит задача 10 (успех в `BitrixTaskModal`). Его покрывают e2e задачи 11: успешное создание в сценарии 3 и тост про неприкреплённую картинку в сценарии 5.

- [ ] **Step 17: Write the failing test — `socketStore`: `card:task` и `trackTaskOpened`**

Создать `src/lib/stores/socket.test.ts`. Настоящий `socket.io-client` подменяется фейковым сокетом через `vi.hoisted`. `$app/environment` мокается, как в `board.test.ts`: цепочка `socket.svelte.ts` → `$lib/i18n/index.js` → `locale.svelte.ts` импортирует его.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

// Настоящий socket.io-client полез бы в сеть: подменяем io() сокетом,
// который запоминает обработчики и отправленные события
const fake = vi.hoisted(() => {
	const handlers = new Map<string, (payload: unknown) => void>();
	return {
		handlers,
		socket: {
			on: (event: string, handler: (payload: unknown) => void) => {
				handlers.set(event, handler);
			},
			emit: vi.fn(),
			disconnect: vi.fn()
		}
	};
});
vi.mock('socket.io-client', () => ({ io: () => fake.socket }));

import { socketStore } from './socket.svelte.js';
import { boardStore } from './board.svelte.js';
import type { Card } from '$lib/types.js';

const card: Card = {
	id: 'c1',
	boardId: 'b1',
	columnType: 'went_well',
	content: 'Созвоны по часу',
	authorName: null,
	imageId: null,
	imageWidth: null,
	imageHeight: null,
	createdAt: '2025-01-01T00:00:00Z',
	bitrixTaskId: null,
	bitrixTaskUrl: null
};

beforeEach(() => {
	fake.handlers.clear();
	fake.socket.emit.mockClear();
	boardStore.setState({
		board: { id: 'b1', slug: 'brd', title: 'Ретро', format: 'classic', createdAt: '2025-01-01T00:00:00Z' },
		cards: [card],
		votes: [],
		comments: []
	});
	socketStore.connect();
});

afterEach(() => {
	socketStore.disconnect();
});

describe('socketStore — Битрикс24', () => {
	it('card:task от сервера проставляет задачу карточке', () => {
		const task = { id: 745181, url: 'https://portal.bitrix24.ru/workgroups/group/2014/tasks/task/view/745181/' };
		const onTask = fake.handlers.get('card:task');
		expect(onTask).toBeDefined();
		onTask!({ cardId: 'c1', task });
		expect(boardStore.cards[0]).toMatchObject({ bitrixTaskId: 745181, bitrixTaskUrl: task.url });
	});

	it('trackTaskOpened шлёт bitrix:opened с источником и токеном создателя из board:join', () => {
		socketStore.joinBoard('brd', 'creator-token');
		fake.socket.emit.mockClear();

		socketStore.trackTaskOpened('summary');

		expect(fake.socket.emit).toHaveBeenCalledWith('bitrix:opened', { source: 'summary', creatorToken: 'creator-token' });
	});

	it('trackTaskOpened без токена создателя шлёт пустую строку — сервер сам отбросит', () => {
		socketStore.joinBoard('brd', null);
		fake.socket.emit.mockClear();

		socketStore.trackTaskOpened('card');

		expect(fake.socket.emit).toHaveBeenCalledWith('bitrix:opened', { source: 'card', creatorToken: '' });
	});
});
```

- [ ] **Step 18: Run test to verify it fails**

Run: `npx vitest run src/lib/stores/socket.test.ts`

Expected: FAIL — `Tests 3 failed (3)`:
- `card:task от сервера…` — `AssertionError: expected undefined to be defined` (обработчик не зарегистрирован);
- оба теста `trackTaskOpened` — `TypeError: socketStore.trackTaskOpened is not a function`.

- [ ] **Step 19: Write minimal implementation — `socket.svelte.ts`**

Импорт после строки 5.

Было:

```ts
import { analysisTransition, PENDING_STALE_MS, type AnalysisState } from '$lib/analysis-state.js';
```

Стало:

```ts
import { analysisTransition, PENDING_STALE_MS, type AnalysisState } from '$lib/analysis-state.js';
import type { CardTask } from '$lib/types.js';
```

Обработчик в `connect()`, сразу после `comment:created` (строки 76–78).

Было:

```ts
		this.socket.on('comment:created', ({ comment }) => {
			boardStore.addComment(comment);
		});
```

Стало:

```ts
		this.socket.on('comment:created', ({ comment }) => {
			boardStore.addComment(comment);
		});

		// Задачу Битрикс24 создал ведущий: бейдж появляется у всех без перезагрузки
		this.socket.on('card:task', ({ cardId, task }: { cardId: string; task: CardTask }) => {
			boardStore.setTask(cardId, task);
		});
```

Метод сразу после `createComment` (строки 241–243), перед `disconnect()`.

Было:

```ts
	createComment(cardId: string, content: string, authorName?: string, imageId?: string) {
		this.socket?.emit('comment:create', { cardId, content, authorName, imageId });
	}
```

Стало:

```ts
	createComment(cardId: string, content: string, authorName?: string, imageId?: string) {
		this.socket?.emit('comment:create', { cardId, content, authorName, imageId });
	}

	/** Счётчик открытий преформы задачи. Токен тот же, что ушёл в board:join, —
	 *  сервер считает только создателя комнаты и только известный source */
	trackTaskOpened(source: 'card' | 'summary') {
		this.socket?.emit('bitrix:opened', { source, creatorToken: this.currentCreatorToken });
	}
```

`socket.svelte.ts` не импортирует `bitrix-task.svelte.ts` — так требует контракт.

- [ ] **Step 20: Run test to verify it passes**

Run: `npx vitest run src/lib/stores/socket.test.ts`

Expected: PASS — `Tests 3 passed (3)`.

- [ ] **Step 21: Write the failing test — `bitrixTaskStore`**

Создать `src/lib/stores/bitrix-task.test.ts`. Настоящий `socketStore` мокается: стору нужен только `trackTaskOpened`. Последний тест сторожит контракт «без циклов импортов».

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

// Стор модалки зовёт только trackTaskOpened: настоящий socketStore не нужен
const trackTaskOpened = vi.hoisted(() => vi.fn());
vi.mock('./socket.svelte.js', () => ({ socketStore: { trackTaskOpened } }));

import { bitrixTaskStore } from './bitrix-task.svelte.js';

beforeEach(() => {
	bitrixTaskStore.close();
	trackTaskOpened.mockClear();
});

describe('bitrixTaskStore', () => {
	it('open запоминает карточку и источник и считает открытие', () => {
		bitrixTaskStore.open('c1', 'card');

		expect(bitrixTaskStore.current).toEqual({ cardId: 'c1', source: 'card' });
		expect(trackTaskOpened).toHaveBeenCalledTimes(1);
		expect(trackTaskOpened).toHaveBeenCalledWith('card');
	});

	it('open сбрасывает submitting, оставшийся от прошлой преформы', () => {
		bitrixTaskStore.open('c1', 'card');
		bitrixTaskStore.submitting = true;

		bitrixTaskStore.open('c2', 'summary');

		expect(bitrixTaskStore.current).toEqual({ cardId: 'c2', source: 'summary' });
		expect(bitrixTaskStore.submitting).toBe(false);
		expect(trackTaskOpened).toHaveBeenLastCalledWith('summary');
	});

	it('close закрывает преформу и сбрасывает submitting, метрику не шлёт', () => {
		bitrixTaskStore.open('c1', 'summary');
		bitrixTaskStore.submitting = true;
		trackTaskOpened.mockClear();

		bitrixTaskStore.close();

		expect(bitrixTaskStore.current).toBeNull();
		expect(bitrixTaskStore.submitting).toBe(false);
		expect(trackTaskOpened).not.toHaveBeenCalled();
	});

	it('сторы доски и сокета не импортируют bitrix-task — иначе цикл импортов', () => {
		for (const file of ['src/lib/stores/board.svelte.ts', 'src/lib/stores/socket.svelte.ts']) {
			expect(readFileSync(file, 'utf-8')).not.toMatch(/from\s+['"][^'"]*bitrix-task/);
		}
	});
});
```

- [ ] **Step 22: Run test to verify it fails**

Run: `npx vitest run src/lib/stores/bitrix-task.test.ts`

Expected: FAIL — `Test Files 1 failed`, `Tests no tests`, ошибка `Error: Cannot find module './bitrix-task.svelte.js' imported from '…/src/lib/stores/bitrix-task.test.ts'`.

- [ ] **Step 23: Write minimal implementation — `bitrix-task.svelte.ts`**

Создать `src/lib/stores/bitrix-task.svelte.ts`:

```ts
import { socketStore } from './socket.svelte.js';

// Преформа «В задачу Битрикс24»: одна на доску, открыта для одной карточки.
// Удалённую карточку и чужой card:task отслеживает сама BitrixTaskModal ($effect):
// board.svelte.ts и socket.svelte.ts этот стор не импортируют, иначе цикл
// board.svelte.ts → bitrix-task.svelte.ts → socket.svelte.ts → board.svelte.ts.
class BitrixTaskStore {
	current = $state<{ cardId: string; source: 'card' | 'summary' } | null>(null);
	/** Запрос createTask в пути: модалка не закрывается ни Escape, ни кликом по фону */
	submitting = $state(false);

	open(cardId: string, source: 'card' | 'summary') {
		this.current = { cardId, source };
		this.submitting = false;
		socketStore.trackTaskOpened(source);
	}

	close() {
		this.current = null;
		this.submitting = false;
	}
}

export const bitrixTaskStore = new BitrixTaskStore();
```

- [ ] **Step 24: Run test to verify it passes**

Run: `npx vitest run src/lib/stores/bitrix-task.test.ts`

Expected: PASS — `Tests 4 passed (4)`.

- [ ] **Step 25: Полная проверка**

Run: `npm test`

Expected: все тестовые файлы зелёные, `0 failed`. Добавились 2 файла (`socket.test.ts`, `bitrix-task.test.ts`) и 13 тестов: 2 в `bus`, 4 в `board`, 1 в `toast`, 3 в `socket`, 3+1 в `bitrix-task`.

Run: `npm run check`

Expected: ошибок не больше, чем до задачи (ожидаемо `svelte-check found 0 errors and 0 warnings`). Среди ошибок нет ни одной в изменённых файлах.

Run: `node --check server.js && npm run build`

Expected: синтаксис `server.js` в порядке, сборка завершается `✔ done` (adapter-node).

- [ ] **Step 26: Commit**

```bash
git add src/lib/server/bus.ts src/lib/server/bus.test.ts server.js \
  src/lib/stores/board.svelte.ts src/lib/stores/board.test.ts \
  src/lib/stores/socket.svelte.ts src/lib/stores/socket.test.ts \
  src/lib/stores/bitrix-task.svelte.ts src/lib/stores/bitrix-task.test.ts \
  src/lib/stores/toast.svelte.ts src/lib/stores/toast.test.ts \
  src/lib/components/Toasts.svelte && git commit -F - <<'EOF'
Битрикс24: задача карточки доезжает до всех на доске

Канал шины board и ретранслятор в комнату доски в server.js; счётчик
открытий преформы bitrix:opened — только от создателя комнаты и только
для card/summary. Сторы: подключение и задача карточки в boardStore,
card:task и trackTaskOpened в socketStore, состояние преформы в новом
bitrixTaskStore. Ссылка в уведомлении может открываться в новой вкладке.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 8: Маршрут доски: загрузка, экшен createTask, проверка группы

**Files:**
- Modify: `src/lib/server/bitrix-flows.ts` (файл из задачи 5. В шапке: добавить импорты `Cookies`, `canViewSpace`, `CardTask` и значений из `./bitrix.js`, строку `import type { BitrixErrorKind, TaskFields } from './bitrix.js';` заменить расширенной. В конец файла дописать `canCreateTask`, `CreateTaskDeps`, `CreateTaskOutcome`, `createTaskFlow`)
- Modify: `src/lib/server/bitrix-flows.test.ts` (файл из задачи 5: объединить импорты в шапке, добавить `vi.mock('./bitrix.js')`, в конец файла дописать `describe('canCreateTask')` и `describe('createTaskFlow')`)
- Modify: `src/routes/[slug]/+page.server.ts` (импорты, строки 1–10; `load`: строки 53–54, 64, после 97 и в `return` после строки 116; новый `export const actions` в конце файла)
- Create: `src/routes/[slug]/bitrix/group/+server.ts`
- Modify: `src/routes/[slug]/+page.svelte` (первый `$effect`, строки 13–16)
- Test: `src/lib/server/bitrix-flows.test.ts`

**Interfaces:**
- Consumes:
  - задача 1: колонки `cards.bitrixTaskId` (`integer('bitrix_task_id')`) и `cards.bitrixTaskUrl` (`text('bitrix_task_url')`), `spaces.accessToken` в `src/lib/server/db/schema.ts`; типы `CardTask { id: number; url: string }` и `BitrixInfo { spaceSlug; portal; userName; groupId; groupName }` из `src/lib/types.ts`;
  - задача 2: `canViewSpace(space: { slug; passwordHash; creatorToken; accessToken }, cookies: Cookies): boolean` из `src/lib/server/space-access.ts`;
  - задачи 3–4 (`src/lib/server/bitrix.ts`): `BitrixError` (`kind`, `field?`, `message`), `type BitrixErrorKind`, `type Webhook`, `type TaskFields`, `type CallOptions`, `idempotencyKey(cardId, fields): string`, `createTask(webhook, fields, tz, key, opts?): Promise<CardTask>`, `tagTask(webhook, taskId, opts?): Promise<void>`, `attachImage(webhook, userId, taskId, image, opts?): Promise<void>`, `IMAGE_MAX_BYTES: number`, `resolveGroup(webhook, groupId, opts?): Promise<GroupResolution>`, семафор `withUploadSlot<T>(fn: () => Promise<T>): Promise<T>` (см. contractAdditions: сам `attachImage` слот не берёт, иначе будет взаимная блокировка);
  - задача 5: из `bitrix-flows.ts` — `type ActionErrorKind`, `statusForKind(kind): number`, `persistsLastError(kind): kind is 'invalid_webhook' | 'scope' | 'access'`, `parseGroupId(raw): number | null | 'invalid'`, `type TaskSource`, `parseTaskForm(form): ParsedTaskForm`; из `bitrix-connection.ts` — `loadConnection(spaceId): Promise<BitrixConnection | null>`, `setLastError(spaceId, kind | null): Promise<void>`; из `bitrix-limits.ts` — `groupLimiter`, `createIpLimiter`, `createSpaceLimiter`, `runningCards: Set<string>`;
  - задача 7: `emitBoard(boardSlug, event, payload): boolean` из `src/lib/server/bus.ts`; `boardStore.setBitrix(info: BitrixInfo | null, offer: boolean)`.
- Produces:
  - `canCreateTask(board: { slug: string; creatorToken: string }, space: { slug: string; passwordHash: string | null; creatorToken: string; accessToken: string }, cookies: Cookies): boolean` — новое имя, см. contractAdditions;
  - `CreateTaskDeps`, `CreateTaskOutcome`, `createTaskFlow(deps): Promise<CreateTaskOutcome>` — строго по контракту;
  - page data доски: `bitrix: BitrixInfo | null`, `bitrixOffer: boolean` (задача 10 читает их через `boardStore`);
  - экшен `POST /{slug}?/createTask` с полями `cardId`, `title`, `description`, `groupId`, `deadline`, `important`, `source` → успех `{ task: CardTask, imageAttached: boolean | null }`, отказ `fail(statusForKind(kind), { bitrixError: kind, field?, message?, task? })`;
  - `GET /{slug}/bitrix/group?id=N` → `200 { name }` | `200 { notFound: true }` | `200 { unknown: true }` | `403 { bitrixError: 'forbidden' }` | `409 { bitrixError: 'not_connected' }` | `429 { bitrixError: 'rate_limited' }` | `400 { bitrixError: 'invalid' }`.

**Заметки к задаче (прочитать до начала):**
- Порядок проверок `createTask` задан в Секции 3 спеки: права → `not_connected` → карточка этой доски → `exists` → `running` → лимиты → валидация → метрика `requested` → расшифровка → `createTaskFlow`. `throw error()` нет ни в экшене, ни в эндпоинте группы: только `fail(...)` / `json(..., { status })`. Непредвиденные исключения (например, упала БД) не ловим: клиент получит `result.type === 'error'`, а `runningCards` освободит блок `finally`.
- Экшен и существующий `src/routes/[slug]/+server.ts` (`DELETE`) уживаются так (SvelteKit 2.50, функция `is_endpoint_request` в `runtime/server/endpoint.js`): `DELETE` обслуживает только эндпоинт; `POST` с заголовком `x-sveltekit-action: true` идёт в экшен страницы (так шлёт `use:enhance`); `POST` без этого заголовка и без `Accept: text/html` уходит в `+server.ts`, где `POST` нет, и получает 405. В production-сборке `POST` с формой без `Origin`, равного `ORIGIN`, отбивается CSRF-проверкой (403 с текстом) ещё до обработчика.
- Типы в `bitrix-flows.ts`: Vitest (esbuild) стирает импорты типов, поэтому забытый `import type` тесты не поймают. Ошибку `Cannot find name 'Webhook'` покажет только `npm run check`, поэтому он запускается уже в шаге 8, до правок маршрута.
- **Для e2e (задача 11):** прямой POST в экшен — `request.post('/{slug}?/createTask', { headers: { 'x-sveltekit-action': 'true', origin: 'http://localhost:4777' }, form: { cardId, title: 'x', description: '', groupId: '', deadline: '', source: 'card' } })`. HTTP-статус ответа **200**, тело — `{ "type": "failure", "status": 403, "data": "[{\"bitrixError\":1},\"forbidden\"]" }` (`data` сериализован devalue). Проверять `body.type === 'failure'`, `body.status === 403` и что `body.data` содержит `"forbidden"`.

- [ ] **Step 1: Падающий тест `canCreateTask`**

В шапку `src/lib/server/bitrix-flows.test.ts` добавь импорт типа, а новое имя допиши в существующий импорт из `./bitrix-flows.js` (уже импортированные имена второй раз не добавляй):

```ts
import type { Cookies } from '@sveltejs/kit';
import { canCreateTask } from './bitrix-flows.js'; // имя дописать в существующую строку импорта из './bitrix-flows.js'
```

В конец файла допиши:

```ts
describe('canCreateTask', () => {
	const cookieJar = (entries: Record<string, string>) =>
		({ get: (name: string) => entries[name] }) as unknown as Cookies;
	const board = { slug: 'b1', creatorToken: 'board-tok' };
	const open = { slug: 'sp', passwordHash: null, creatorToken: 'space-tok', accessToken: 'access-tok' };
	const locked = { ...open, passwordHash: 'hash' };

	it('создатель доски в открытом пространстве может создавать задачи', () => {
		expect(canCreateTask(board, open, cookieJar({ retro_creator_b1: 'board-tok' }))).toBe(true);
	});

	it('создатель пространства может без cookie доски, в том числе в закрытом пространстве', () => {
		expect(canCreateTask(board, open, cookieJar({ retro_space_creator_sp: 'space-tok' }))).toBe(true);
		expect(canCreateTask(board, locked, cookieJar({ retro_space_creator_sp: 'space-tok' }))).toBe(true);
	});

	it('гость и неверные токены — нет', () => {
		expect(canCreateTask(board, open, cookieJar({}))).toBe(false);
		expect(canCreateTask(board, open, cookieJar({ retro_creator_b1: 'wrong' }))).toBe(false);
		expect(canCreateTask(board, open, cookieJar({ retro_space_creator_sp: 'wrong' }))).toBe(false);
	});

	it('пустые токены старых досок и пространств прав не дают', () => {
		const oldBoard = { ...board, creatorToken: '' };
		const oldSpace = { ...open, creatorToken: '' };
		expect(canCreateTask(oldBoard, oldSpace, cookieJar({ retro_creator_b1: '', retro_space_creator_sp: '' }))).toBe(false);
	});

	it('создатель доски в закрытом пространстве — только с настоящей cookie доступа', () => {
		expect(canCreateTask(board, locked, cookieJar({ retro_creator_b1: 'board-tok' }))).toBe(false);
		expect(
			canCreateTask(board, locked, cookieJar({ retro_creator_b1: 'board-tok', retro_space_sp: 'authenticated' }))
		).toBe(false);
		expect(
			canCreateTask(board, locked, cookieJar({ retro_creator_b1: 'board-tok', retro_space_sp: 'access-tok' }))
		).toBe(true);
	});
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/lib/server/bitrix-flows.test.ts`
Expected: FAIL — все 5 тестов `canCreateTask` падают с `TypeError: ... canCreateTask is not a function`; тесты задачи 5 в этом файле зелёные.

- [ ] **Step 3: Реализовать `canCreateTask`**

В шапку `src/lib/server/bitrix-flows.ts`, сразу под импорты, которые оставила задача 5, добавь две строки:

```ts
import type { Cookies } from '@sveltejs/kit';
import { canViewSpace } from './space-access.js';
```

В конец файла допиши:

```ts
/**
 * Кто может создавать задачи с доски и проверять группу: создатель доски или
 * пространства, и только с доступом к пространству (cookie retro_space_{slug}
 * сверяется с access_token). Пустые токены старых записей прав не дают.
 * Общая проверка для экшена createTask и GET /[slug]/bitrix/group.
 */
export function canCreateTask(
	board: { slug: string; creatorToken: string },
	space: { slug: string; passwordHash: string | null; creatorToken: string; accessToken: string },
	cookies: Cookies
): boolean {
	const boardCookie = cookies.get(`retro_creator_${board.slug}`) ?? '';
	const spaceCookie = cookies.get(`retro_space_creator_${space.slug}`) ?? '';
	const lead =
		(!!board.creatorToken && boardCookie === board.creatorToken) ||
		(!!space.creatorToken && spaceCookie === space.creatorToken);
	return lead && canViewSpace(space, cookies);
}
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/lib/server/bitrix-flows.test.ts`
Expected: PASS — все тесты файла зелёные, включая 5 тестов `canCreateTask`.

- [ ] **Step 5: Падающие тесты `createTaskFlow`**

Шапка `src/lib/server/bitrix-flows.test.ts`: импорт из `vitest` приведи к виду ниже, объединив с уже существующим. В существующий импорт из `./bitrix-flows.js` допиши `createTaskFlow` и `type CreateTaskDeps`. Добавь импорты из `./bitrix.js` и `$lib/types.js` (уже импортированные имена не дублируй). Блок `vi.mock` поставь сразу после импортов: Vitest всё равно поднимает его в начало файла. Мок частичный (`importOriginal`): `BitrixError`, `idempotencyKey` и `IMAGE_MAX_BYTES` остаются настоящими, а тесты задачи 5 подмены не замечают.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTaskFlow, type CreateTaskDeps } from './bitrix-flows.js'; // имена дописать в существующую строку импорта
import {
	BitrixError,
	IMAGE_MAX_BYTES,
	attachImage,
	createTask,
	idempotencyKey,
	tagTask,
	withUploadSlot,
	type TaskFields,
	type Webhook
} from './bitrix.js';
import type { CardTask } from '$lib/types.js';

// Портал подменяем целиком: оркестрация проверяется без сети и без транспорта
vi.mock('./bitrix.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./bitrix.js')>();
	return { ...actual, createTask: vi.fn(), tagTask: vi.fn(), attachImage: vi.fn(), withUploadSlot: vi.fn() };
});
```

В конец файла допиши:

```ts
describe('createTaskFlow', () => {
	const WEBHOOK: Webhook = { url: 'https://portal.example/rest/1/testcode/', portal: 'portal.example', userId: 1 };
	const FIELDS: TaskFields = {
		title: 'Починить CI',
		description: 'CI падает по утрам',
		groupId: 42,
		deadline: '2026-10-01',
		important: true
	};
	const TASK: CardTask = { id: 745181, url: 'https://portal.example/workgroups/group/42/tasks/task/view/745181/' };
	let log: string[] = [];

	function makeDeps(overrides: Partial<CreateTaskDeps> = {}): CreateTaskDeps {
		return {
			webhook: WEBHOOK,
			connection: { userId: 1, timeZone: 'Europe/Kaliningrad', portalOffset: '+02:00' },
			card: { id: 'card-1', imageId: null },
			fields: FIELDS,
			source: 'card',
			saveTask: vi.fn(async () => {
				log.push('saveTask');
				return true;
			}),
			imageSize: vi.fn(async () => {
				log.push('imageSize');
				return 2048;
			}),
			loadImage: vi.fn(async () => {
				log.push('loadImage');
				return { mimeType: 'image/webp', data: Buffer.from('webp-bytes') };
			}),
			emit: vi.fn(() => {
				log.push('emit');
			}),
			metric: vi.fn((name: string) => {
				log.push(`metric:${name}`);
			}),
			now: vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1250),
			...overrides
		};
	}

	beforeEach(() => {
		log = [];
		vi.mocked(createTask)
			.mockReset()
			.mockImplementation(async () => {
				log.push('createTask');
				return TASK;
			});
		vi.mocked(tagTask)
			.mockReset()
			.mockImplementation(async () => {
				log.push('tagTask');
			});
		vi.mocked(attachImage)
			.mockReset()
			.mockImplementation(async () => {
				log.push('attachImage');
			});
		vi.mocked(withUploadSlot)
			.mockReset()
			.mockImplementation(async (fn) => {
				log.push('slot:enter');
				try {
					return await fn();
				} finally {
					log.push('slot:exit');
				}
			});
	});

	it('успех без картинки: задача сохранена, тег поставлен, метрики и рассылка', async () => {
		const deps = makeDeps();
		const outcome = await createTaskFlow(deps);
		expect(outcome).toEqual({ ok: true, task: TASK, imageAttached: null });
		expect(createTask).toHaveBeenCalledWith(
			WEBHOOK,
			FIELDS,
			{ timeZone: 'Europe/Kaliningrad', portalOffset: '+02:00' },
			idempotencyKey('card-1', FIELDS),
			undefined
		);
		expect(deps.saveTask).toHaveBeenCalledWith('card-1', TASK);
		expect(tagTask).toHaveBeenCalledWith(WEBHOOK, 745181, undefined);
		expect(deps.imageSize).not.toHaveBeenCalled();
		expect(withUploadSlot).not.toHaveBeenCalled();
		expect(deps.emit).toHaveBeenCalledWith('card-1', TASK);
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.created.card', 1);
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.duration_ms', 250, 'ms');
		expect(deps.metric).toHaveBeenCalledTimes(2);
	});

	it('картинка читается и грузится внутри слота; ровно IMAGE_MAX_BYTES — ещё не пропуск', async () => {
		const deps = makeDeps({
			card: { id: 'card-1', imageId: 'img-1' },
			imageSize: vi.fn(async () => {
				log.push('imageSize');
				return IMAGE_MAX_BYTES;
			})
		});
		const outcome = await createTaskFlow(deps);
		expect(outcome).toEqual({ ok: true, task: TASK, imageAttached: true });
		expect(deps.imageSize).toHaveBeenCalledWith('img-1');
		expect(deps.loadImage).toHaveBeenCalledWith('img-1');
		expect(attachImage).toHaveBeenCalledWith(
			WEBHOOK,
			1,
			745181,
			{ cardId: 'card-1', mimeType: 'image/webp', data: Buffer.from('webp-bytes') },
			undefined
		);
		expect(log.indexOf('loadImage')).toBeGreaterThan(log.indexOf('slot:enter'));
		expect(log.indexOf('attachImage')).toBeLessThan(log.indexOf('slot:exit'));
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.image_attached', 1);
	});

	it('порядок: создание → запись → тег → картинка → метрики → рассылка последней', async () => {
		const deps = makeDeps({ card: { id: 'card-1', imageId: 'img-1' }, source: 'summary' });
		await createTaskFlow(deps);
		expect(log).toEqual([
			'createTask',
			'saveTask',
			'tagTask',
			'imageSize',
			'slot:enter',
			'loadImage',
			'attachImage',
			'slot:exit',
			'metric:retro.bitrix.task.image_attached',
			'metric:retro.bitrix.task.created.summary',
			'metric:retro.bitrix.task.duration_ms',
			'emit'
		]);
	});

	it('картинка больше IMAGE_MAX_BYTES не читается и не грузится: image_skipped, imageAttached false', async () => {
		const deps = makeDeps({
			card: { id: 'card-1', imageId: 'img-1' },
			imageSize: vi.fn(async () => IMAGE_MAX_BYTES + 1)
		});
		const outcome = await createTaskFlow(deps);
		expect(outcome).toEqual({ ok: true, task: TASK, imageAttached: false });
		expect(withUploadSlot).not.toHaveBeenCalled();
		expect(deps.loadImage).not.toHaveBeenCalled();
		expect(attachImage).not.toHaveBeenCalled();
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.image_skipped', 1);
		expect(deps.emit).toHaveBeenCalledWith('card-1', TASK);
	});

	it('attachImage упал: задача создана, image_failed, слот освобождён', async () => {
		vi.mocked(attachImage).mockRejectedValueOnce(new BitrixError('scope', 'нет права Диск'));
		const deps = makeDeps({ card: { id: 'card-1', imageId: 'img-1' } });
		const outcome = await createTaskFlow(deps);
		expect(outcome).toEqual({ ok: true, task: TASK, imageAttached: false });
		expect(log).toContain('slot:exit');
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.image_failed', 1);
		expect(deps.metric).not.toHaveBeenCalledWith('retro.bitrix.task.image_attached', 1);
		expect(deps.emit).toHaveBeenCalledWith('card-1', TASK);
	});

	it('строки картинки уже нет (imageSize null): image_failed без захода в слот', async () => {
		const deps = makeDeps({ card: { id: 'card-1', imageId: 'img-1' }, imageSize: vi.fn(async () => null) });
		expect(await createTaskFlow(deps)).toEqual({ ok: true, task: TASK, imageAttached: false });
		expect(withUploadSlot).not.toHaveBeenCalled();
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.image_failed', 1);
	});

	it('loadImage вернул null: image_failed, attachImage не зовётся', async () => {
		const deps = makeDeps({ card: { id: 'card-1', imageId: 'img-1' }, loadImage: vi.fn(async () => null) });
		expect(await createTaskFlow(deps)).toEqual({ ok: true, task: TASK, imageAttached: false });
		expect(attachImage).not.toHaveBeenCalled();
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.image_failed', 1);
	});

	it('очередь на загрузку не дождалась слота: image_failed, байты не читаются', async () => {
		vi.mocked(withUploadSlot).mockRejectedValueOnce(new BitrixError('timeout', 'очередь загрузки'));
		const deps = makeDeps({ card: { id: 'card-1', imageId: 'img-1' } });
		expect(await createTaskFlow(deps)).toEqual({ ok: true, task: TASK, imageAttached: false });
		expect(deps.loadImage).not.toHaveBeenCalled();
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.image_failed', 1);
		expect(deps.emit).toHaveBeenCalledWith('card-1', TASK);
	});

	it('тег не поставился: tag_failed, задача создана и разослана', async () => {
		vi.mocked(tagTask).mockRejectedValueOnce(new BitrixError('rejected', 'tags'));
		const deps = makeDeps();
		expect(await createTaskFlow(deps)).toEqual({ ok: true, task: TASK, imageAttached: null });
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.tag_failed', 1);
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.created.card', 1);
		expect(deps.emit).toHaveBeenCalledWith('card-1', TASK);
	});

	it('saveTask вернул false (карточку удалили): orphaned, not_found, дальше ничего', async () => {
		const deps = makeDeps({ card: { id: 'card-1', imageId: 'img-1' }, saveTask: vi.fn(async () => false) });
		expect(await createTaskFlow(deps)).toEqual({ ok: false, kind: 'not_found' });
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.orphaned', 1);
		expect(deps.metric).toHaveBeenCalledTimes(1);
		expect(tagTask).not.toHaveBeenCalled();
		expect(deps.imageSize).not.toHaveBeenCalled();
		expect(deps.emit).not.toHaveBeenCalled();
	});

	it.each([
		[
			'group',
			new BitrixError('group', 'Доступ запрещен', {
				code: 'BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION',
				status: 403,
				field: 'groupId'
			}),
			{ ok: false, kind: 'group', field: 'groupId', message: 'Доступ запрещен' }
		],
		[
			'access',
			new BitrixError('access', 'Портал отказал', { code: 'ACCESS_DENIED', status: 403 }),
			{ ok: false, kind: 'access', message: 'Портал отказал' }
		],
		['network', new BitrixError('network', 'Портал не ответил'), { ok: false, kind: 'network', message: 'Портал не ответил' }]
	])('BitrixError %s из createTask → отказ того же вида без записи, метрик и рассылки', async (_kind, err, expected) => {
		vi.mocked(createTask).mockRejectedValueOnce(err);
		const deps = makeDeps({ card: { id: 'card-1', imageId: 'img-1' } });
		expect(await createTaskFlow(deps)).toEqual(expected);
		expect(deps.saveTask).not.toHaveBeenCalled();
		expect(tagTask).not.toHaveBeenCalled();
		expect(deps.imageSize).not.toHaveBeenCalled();
		expect(deps.metric).not.toHaveBeenCalled();
		expect(deps.emit).not.toHaveBeenCalled();
	});

	it('не-BitrixError из createTask не маскируется под вид ошибки', async () => {
		vi.mocked(createTask).mockRejectedValueOnce(new TypeError('boom'));
		const deps = makeDeps();
		await expect(createTaskFlow(deps)).rejects.toThrow('boom');
		expect(deps.saveTask).not.toHaveBeenCalled();
	});

	it('source other → created.other; callOpts уходят во все вызовы портала', async () => {
		const callOpts = { timeoutMs: 5000 };
		const deps = makeDeps({ source: 'other', callOpts, card: { id: 'card-1', imageId: 'img-1' } });
		await createTaskFlow(deps);
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.created.other', 1);
		expect(vi.mocked(createTask).mock.calls[0][4]).toBe(callOpts);
		expect(vi.mocked(tagTask).mock.calls[0][2]).toBe(callOpts);
		expect(vi.mocked(attachImage).mock.calls[0][4]).toBe(callOpts);
	});
});
```

- [ ] **Step 6: Убедиться, что тесты падают**

Run: `npx vitest run src/lib/server/bitrix-flows.test.ts`
Expected: FAIL — 15 тестов `createTaskFlow` падают с `TypeError: ... createTaskFlow is not a function`; тесты задачи 5 и `canCreateTask` зелёные.

- [ ] **Step 7: Реализовать `createTaskFlow`**

В шапке `src/lib/server/bitrix-flows.ts` задача 5 оставила импорт только двух типов. `CreateTaskDeps` и `CreateTaskOutcome` используют ещё `Webhook`, `CallOptions` и `CardTask`, а импорта `CardTask` в файле нет.

Было (строка импорта типов из задачи 5):

```ts
import type { BitrixErrorKind, TaskFields } from './bitrix.js';
```

Стало (три импорта подряд на месте этой строки):

```ts
import type { BitrixErrorKind, CallOptions, TaskFields, Webhook } from './bitrix.js';
import type { CardTask } from '$lib/types.js';
import {
	BitrixError,
	IMAGE_MAX_BYTES,
	attachImage,
	createTask,
	idempotencyKey,
	tagTask,
	withUploadSlot
} from './bitrix.js';
```

Если задача 5 уже импортировала какие-то из этих типов (например, строка совпадает с контрактом `import type { BitrixErrorKind, TaskFields, Webhook, CallOptions } from './bitrix.js';`), приведи её к виду выше, не дублируя имён. После правки шапка файла должна содержать ровно такие импорты (порядок не важен):

```ts
import type { BitrixErrorKind, CallOptions, TaskFields, Webhook } from './bitrix.js';
import type { CardTask } from '$lib/types.js';
import { BitrixError, IMAGE_MAX_BYTES, attachImage, createTask, idempotencyKey, tagTask, withUploadSlot } from './bitrix.js';
import type { Cookies } from '@sveltejs/kit';
import { canViewSpace } from './space-access.js';
```

Два объявления импорта из одного модуля (типы и значения) допустимы.

В конец файла допиши:

```ts
export interface CreateTaskDeps {
	webhook: Webhook;
	connection: { userId: number; timeZone: string | null; portalOffset: string | null };
	card: { id: string; imageId: string | null };
	fields: TaskFields;
	source: TaskSource;
	callOpts?: CallOptions;
	saveTask(cardId: string, task: CardTask): Promise<boolean>; // UPDATE ... WHERE bitrix_task_id IS NULL; false — 0 строк
	imageSize(imageId: string): Promise<number | null>; // octet_length без чтения байтов; null — нет строки
	loadImage(imageId: string): Promise<{ mimeType: string; data: Buffer } | null>;
	emit(cardId: string, task: CardTask): void; // emitBoard(slug, 'card:task', ...)
	metric(name: string, value: number, type?: string): void;
	now(): number;
}

export type CreateTaskOutcome =
	| { ok: true; task: CardTask; imageAttached: boolean | null }
	| { ok: false; kind: ActionErrorKind; field?: string; message?: string };

/**
 * Картинка карточки: best-effort. Любая неудача даёт false и метрику, задачу не отменяет.
 * Размер проверяем без чтения байтов; слот загрузки берём до loadImage, чтобы в куче
 * одновременно жила не больше одной картинки (контейнер с --max-old-space-size=256).
 */
async function attachCardImage(deps: CreateTaskDeps, imageId: string, taskId: number): Promise<boolean> {
	try {
		const size = await deps.imageSize(imageId);
		if (size !== null && size > IMAGE_MAX_BYTES) {
			deps.metric('retro.bitrix.task.image_skipped', 1);
			return false;
		}
		const attached =
			size !== null &&
			(await withUploadSlot(async () => {
				const image = await deps.loadImage(imageId);
				if (!image) return false;
				await attachImage(
					deps.webhook,
					deps.connection.userId,
					taskId,
					{ cardId: deps.card.id, mimeType: image.mimeType, data: image.data },
					deps.callOpts
				);
				return true;
			}));
		deps.metric(attached ? 'retro.bitrix.task.image_attached' : 'retro.bitrix.task.image_failed', 1);
		return attached;
	} catch {
		deps.metric('retro.bitrix.task.image_failed', 1);
		return false;
	}
}

/**
 * Создание задачи из карточки после всех проверок экшена. Порядок важен:
 * задача → запись на карточку → тег → картинка → метрики → рассылка card:task.
 * Рассылка последней: сокет создателя тоже в комнате, и бейдж не должен
 * появиться под ещё крутящейся модалкой.
 */
export async function createTaskFlow(deps: CreateTaskDeps): Promise<CreateTaskOutcome> {
	const started = deps.now();
	const { webhook, connection, card, fields, callOpts } = deps;

	let task: CardTask;
	try {
		task = await createTask(
			webhook,
			fields,
			{ timeZone: connection.timeZone, portalOffset: connection.portalOffset },
			idempotencyKey(card.id, fields),
			callOpts
		);
	} catch (err) {
		if (err instanceof BitrixError) return { ok: false, kind: err.kind, field: err.field, message: err.message };
		throw err;
	}

	// 0 строк — карточку удалили, пока шёл запрос: задача в портале осталась сиротой
	if (!(await deps.saveTask(card.id, task))) {
		deps.metric('retro.bitrix.task.orphaned', 1);
		return { ok: false, kind: 'not_found' };
	}

	// Тег best-effort: v3 его не принимает, ставим старым REST после создания
	try {
		await tagTask(webhook, task.id, callOpts);
	} catch {
		deps.metric('retro.bitrix.task.tag_failed', 1);
	}

	const imageAttached = card.imageId ? await attachCardImage(deps, card.imageId, task.id) : null;

	deps.metric(`retro.bitrix.task.created.${deps.source}`, 1);
	deps.metric('retro.bitrix.task.duration_ms', deps.now() - started, 'ms');
	deps.emit(card.id, task);
	return { ok: true, task, imageAttached };
}
```

- [ ] **Step 8: Убедиться, что тесты проходят и типы сходятся**

Run: `npx vitest run src/lib/server/bitrix-flows.test.ts`
Expected: PASS — все тесты файла зелёные (задача 5, 5 тестов `canCreateTask`, 15 тестов `createTaskFlow`).

Run: `npm run check`
Expected: в выводе нет ни одной ошибки по `src/lib/server/bitrix-flows.ts` и `src/lib/server/bitrix-flows.test.ts`. В частности, нет `Cannot find name 'Webhook'`, `'CallOptions'` или `'CardTask'`: Vitest типы стирает и такие ошибки не видит. Если они есть, вернись к шапке из шага 7.

- [ ] **Step 9: Загрузка доски: `bitrix` и `bitrixOffer`**

В `src/routes/[slug]/+page.server.ts` блок импортов (строки 1–10) замени целиком:

```ts
import { error, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db/index.js';
import { boards, cards, votes, comments, spaces, images, spaceAnalyses } from '$lib/server/db/schema.js';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { statePayload } from '$lib/server/analysis.js';
import type { AnalysisState } from '$lib/analysis-state.js';
import { canViewSpace } from '$lib/server/space-access.js';
import { decrypt } from '$lib/server/crypto.js';
import { metric } from '$lib/server/statsd.js';
import { emitBoard } from '$lib/server/bus.js';
import { loadConnection, setLastError } from '$lib/server/bitrix-connection.js';
import { createIpLimiter, createSpaceLimiter, runningCards } from '$lib/server/bitrix-limits.js';
import {
	canCreateTask,
	createTaskFlow,
	parseTaskForm,
	persistsLastError,
	statusForKind,
	type ActionErrorKind
} from '$lib/server/bitrix-flows.js';
import type { BitrixInfo, CardTask } from '$lib/types.js';
import type { Actions, PageServerLoad } from './$types.js';
```

Было (строки 53–54):

```ts
	let space: { slug: string; name: string } | null = null;
	let spaceCreator = false;
```

Стало:

```ts
	let space: { slug: string; name: string } | null = null;
	let spaceId: string | null = null;
	let spaceCreator = false;
```

Было (строка 64):

```ts
			space = { slug: s.slug, name: s.name };
```

Стало:

```ts
			space = { slug: s.slug, name: s.name };
			spaceId = s.id;
```

Было (строки 95–97):

```ts
	} else if (cookieToken && cookieToken === board.creatorToken) {
		isCreator = true;
	}
```

Стало:

```ts
	} else if (cookieToken && cookieToken === board.creatorToken) {
		isCreator = true;
	}

	// Битрикс24. Преформа — ведущему (создатель доски или пространства) с доступом
	// к пространству, когда пространство подключено; пункт меню «Подключить» —
	// только создателю пространства и только пока не подключено.
	// Вебхук (connection.webhook) в page data не уходит никогда.
	let bitrix: BitrixInfo | null = null;
	let bitrixOffer = false;
	if (space && spaceId && spaceViewable && isCreator) {
		const connection = await loadConnection(spaceId);
		if (connection) {
			bitrix = {
				spaceSlug: space.slug,
				portal: connection.portal,
				userName: connection.userName,
				groupId: connection.groupId,
				groupName: connection.groupName
			};
		} else {
			bitrixOffer = spaceCreator;
		}
	}
```

Было (строки 115–116 в `return`):

```ts
		analysisEnabled: spaceViewable && !!env.DEEPSEEK_API_KEY,
		analysis,
```

Стало:

```ts
		analysisEnabled: spaceViewable && !!env.DEEPSEEK_API_KEY,
		analysis,
		bitrix,
		bitrixOffer,
```

Карточки менять не нужно: `...c` уже несёт `bitrixTaskId` и `bitrixTaskUrl` из схемы задачи 1.

- [ ] **Step 10: Экшен `createTask`**

В конец `src/routes/[slug]/+page.server.ts` (после закрывающей `};` функции `load`) допиши:

```ts
// Карточки — uuid; произвольная строка в cardId не должна доходить до Postgres
// (invalid input syntax for type uuid → 500 вместо not_found)
const CARD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const actions: Actions = {
	// «В задачу Битрикс24». Клиент ветвится только по bitrixError, поэтому
	// никаких throw error(): каждый отказ — fail со своим видом (Секция 3 спеки)
	createTask: async ({ request, params, cookies, getClientAddress }) => {
		const failWith = (kind: ActionErrorKind, extra: { field?: string; message?: string; task?: CardTask } = {}) => {
			metric(`retro.bitrix.task.failed.${kind}`, 1);
			return fail(statusForKind(kind), { bitrixError: kind, ...extra });
		};

		// 1. Права: создатель доски или пространства с доступом к пространству.
		// Доска вне пространства — тоже forbidden: подключения у неё быть не может
		const board = await db.query.boards.findFirst({ where: eq(boards.slug, params.slug) });
		const space = board?.spaceId
			? await db.query.spaces.findFirst({ where: eq(spaces.id, board.spaceId) })
			: undefined;
		if (!board || !space || !canCreateTask(board, space, cookies)) return failWith('forbidden');

		// 2. Пространство подключено к порталу
		const connection = await loadConnection(space.id);
		if (!connection) return failWith('not_connected');

		// 3. Карточка принадлежит этой доске
		const form = await request.formData();
		const cardId = String(form.get('cardId') ?? '');
		const card = CARD_ID_RE.test(cardId)
			? await db.query.cards.findFirst({ where: and(eq(cards.id, cardId), eq(cards.boardId, board.id)) })
			: undefined;
		if (!card) return failWith('not_found');

		// 4. Одна задача на карточку: отдаём существующую, клиент покажет бейдж
		if (card.bitrixTaskId !== null) {
			return failWith('exists', { task: { id: card.bitrixTaskId, url: card.bitrixTaskUrl ?? '' } });
		}

		// 5. Второй ведущий уже создаёт задачу по этой карточке. Между has и add
		// нет await, поэтому занятие атомарно в пределах процесса
		if (runningCards.has(card.id)) return failWith('running');
		runningCards.add(card.id);
		try {
			// 6. Лимиты: 10 в минуту с IP, 30 в час на пространство
			if (!createIpLimiter.check(getClientAddress()) || !createSpaceLimiter.check(`space:${space.id}`)) {
				return failWith('rate_limited');
			}

			// 7. Поля формы
			const parsed = parseTaskForm(form);
			if (!parsed.ok) return failWith('invalid', { field: parsed.field });

			metric('retro.bitrix.task.requested', 1);

			// Ключ шифрования сменили или данные испорчены: вебхук не расшифровался
			if (!connection.webhook) {
				await setLastError(space.id, 'invalid_webhook');
				return failWith('invalid_webhook');
			}

			const outcome = await createTaskFlow({
				webhook: connection.webhook,
				connection: {
					userId: connection.userId,
					timeZone: connection.timeZone,
					portalOffset: connection.portalOffset
				},
				card: { id: card.id, imageId: card.imageId },
				fields: parsed.fields,
				source: parsed.source,
				// IS NULL: если карточку удалили, пока шёл запрос, — 0 строк
				saveTask: async (id, task) => {
					const rows = await db
						.update(cards)
						.set({ bitrixTaskId: task.id, bitrixTaskUrl: task.url })
						.where(and(eq(cards.id, id), isNull(cards.bitrixTaskId)))
						.returning({ id: cards.id });
					return rows.length > 0;
				},
				// Размер без чтения байтов: большой GIF не должен попасть в кучу
				imageSize: async (imageId) => {
					const [row] = await db
						.select({ size: sql<number>`octet_length(${images.data})` })
						.from(images)
						.where(eq(images.id, imageId));
					return row ? Number(row.size) : null;
				},
				loadImage: async (imageId) => {
					const [row] = await db
						.select({ mimeType: images.mimeType, data: images.data })
						.from(images)
						.where(eq(images.id, imageId));
					return row ?? null;
				},
				emit: (id, task) => {
					emitBoard(board.slug, 'card:task', { cardId: id, task });
				},
				metric,
				now: Date.now
			});

			if (!outcome.ok) {
				const kind = outcome.kind;
				if (persistsLastError(kind)) await setLastError(space.id, kind);
				// В лог только хост портала и вид ошибки: ни адреса вебхука, ни текста карточки
				console.warn(JSON.stringify({ event: 'bitrix:task_failed', portal: connection.portal, kind }));
				return failWith(kind, { field: outcome.field, message: outcome.message });
			}

			// Успешный экшен стирает предупреждение панели «вебхук перестал работать»
			if (connection.lastError) await setLastError(space.id, null);
			console.info(
				JSON.stringify({
					event: 'bitrix:task_created',
					portal: connection.portal,
					taskId: outcome.task.id,
					imageAttached: outcome.imageAttached
				})
			);
			return { task: outcome.task, imageAttached: outcome.imageAttached };
		} finally {
			runningCards.delete(card.id);
		}
	}
};
```

- [ ] **Step 11: Эндпоинт проверки группы**

Создай `src/routes/[slug]/bitrix/group/+server.ts`:

```ts
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { boards, spaces } from '$lib/server/db/schema.js';
import { resolveGroup } from '$lib/server/bitrix.js';
import { loadConnection } from '$lib/server/bitrix-connection.js';
import { groupLimiter } from '$lib/server/bitrix-limits.js';
import { canCreateTask, parseGroupId } from '$lib/server/bitrix-flows.js';
import type { RequestHandler } from './$types.js';

// Проверка группы из преформы (через 400 мс после ввода). Никаких throw error():
// клиент ветвится по телу ответа. Любая неудача портала, включая нет права
// «Рабочие группы соцсети», — { unknown: true }: поле не подсвечиваем.
const reply = (body: Record<string, unknown>, status = 200) =>
	json(body, { status, headers: { 'cache-control': 'no-store' } });

export const GET: RequestHandler = async ({ params, url, cookies, getClientAddress }) => {
	const board = await db.query.boards.findFirst({ where: eq(boards.slug, params.slug) });
	const space = board?.spaceId
		? await db.query.spaces.findFirst({ where: eq(spaces.id, board.spaceId) })
		: undefined;
	if (!board || !space || !canCreateTask(board, space, cookies)) return reply({ bitrixError: 'forbidden' }, 403);

	if (!groupLimiter.check(getClientAddress())) return reply({ bitrixError: 'rate_limited' }, 429);

	const groupId = parseGroupId(url.searchParams.get('id'));
	if (groupId === null || groupId === 'invalid') return reply({ bitrixError: 'invalid' }, 400);

	const connection = await loadConnection(space.id);
	if (!connection) return reply({ bitrixError: 'not_connected' }, 409);
	// Вебхук не расшифровался — о группе ничего сказать нельзя; отправка формы вернёт invalid_webhook
	if (!connection.webhook) return reply({ unknown: true });

	try {
		const group = await resolveGroup(connection.webhook, groupId);
		if (group.status === 'ok') return reply({ name: group.name });
		if (group.status === 'notFound') return reply({ notFound: true });
		return reply({ unknown: true });
	} catch {
		return reply({ unknown: true });
	}
};
```

- [ ] **Step 12: Страница доски передаёт данные в `boardStore`**

`src/routes/[slug]/+page.svelte`, было (строки 13–16):

```svelte
	$effect(() => {
		boardStore.setState(data);
		boardStore.isCreator = data.isCreator;
	});
```

Стало:

```svelte
	$effect(() => {
		boardStore.setState(data);
		boardStore.isCreator = data.isCreator;
		boardStore.setBitrix(data.bitrix, data.bitrixOffer);
	});
```

- [ ] **Step 13: Типы и сборка**

Run: `npm run check`
Expected: `svelte-check found 0 errors` (или столько же ошибок, сколько было до задачи; новых нет). Типы `./$types.js` для `src/routes/[slug]/bitrix/group` генерирует `svelte-kit sync` внутри `check`.

Run: `npm run build`
Expected: сборка завершается строками `✓ built in …` и `> Using @sveltejs/adapter-node … ✔ done`, без ошибок. Если SvelteKit ругается `Invalid export 'CARD_ID_RE'`, значит перед константой стоит `export`: экспортировать её нельзя.

- [ ] **Step 14: Смоук маршрутизации на собранном приложении**

Шаг проверяет, что экшен и `DELETE` из `+server.ts` уживаются, а отказы приходят через `fail`, а не через `throw error()`. Нужна локальная БД.

```bash
docker compose up -d db
export DATABASE_URL=postgresql://retro:retro@localhost:5433/retro
node migrate.js
PORT=4790 ORIGIN=http://localhost:4790 node server.js > /tmp/retro-task8.log 2>&1 &
until curl -sf http://localhost:4790/health > /dev/null; do sleep 1; done
```

```bash
curl -s -X POST 'http://localhost:4790/no-such-board?/createTask' \
  -H 'x-sveltekit-action: true' -H 'origin: http://localhost:4790' --data 'cardId=x&title=t'; echo
```
Expected: `{"type":"failure","status":403,"data":"[{\"bitrixError\":1},\"forbidden\"]"}` (HTTP 200, как у любого ответа `use:enhance`).

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST 'http://localhost:4790/no-such-board?/createTask' \
  -H 'origin: http://localhost:4790' --data 'cardId=x'
```
Expected: `405`: без `x-sveltekit-action` POST уходит в `+server.ts`, где `POST` нет.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST 'http://localhost:4790/no-such-board?/createTask' \
  -H 'x-sveltekit-action: true' --data 'cardId=x'
```
Expected: `403`: без `Origin` CSRF-проверка SvelteKit срабатывает раньше обработчика.

```bash
curl -s -w ' %{http_code}\n' 'http://localhost:4790/no-such-board/bitrix/group?id=42'
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE 'http://localhost:4790/no-such-board'
kill $(lsof -ti tcp:4790)
```
Expected: `{"bitrixError":"forbidden"} 403`, затем `404` (`DELETE` по-прежнему обслуживает `+server.ts`).

Полное поведение (создание через мок, картинка, `invalid_webhook` → `last_error`, Summary, доска-анализ, `bitrixOffer`, проверка группы через 400 мс, 403 для создателя доски без доступа к закрытому пространству) покрывают e2e-тесты 3–7 и 9–14 из `e2e/bitrix.spec.ts` в задаче 11.

- [ ] **Step 15: Полный прогон и коммит**

Run: `npm test`
Expected: все тестовые файлы PASS, включая `src/lib/server/bitrix-flows.test.ts` и `src/lib/i18n/dictionaries.test.ts` (ключей i18n эта задача не добавляет).

Run: `npm run check`
Expected: новых ошибок нет.

```bash
git add src/lib/server/bitrix-flows.ts src/lib/server/bitrix-flows.test.ts \
  'src/routes/[slug]/+page.server.ts' 'src/routes/[slug]/+page.svelte' \
  'src/routes/[slug]/bitrix/group/+server.ts'
git commit -m "$(cat <<'EOF'
Битрикс24: экшен «В задачу» на доске и проверка группы

createTaskFlow создаёт задачу, записывает её на карточку, ставит тег и
прикрепляет картинку best-effort, card:task рассылается последним.
Доска отдаёт bitrix и bitrixOffer, createTask отвечает только fail с
bitrixError, GET /[slug]/bitrix/group проверяет группу через вебхук.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Черновик задачи из карточки

**Files:**
- Create: `src/lib/bitrix-draft.ts`
- Create: `src/lib/bitrix-draft.test.ts`
- Modify: `src/lib/i18n/en.json`: новая группа `bitrix.draft.*` отдельным абзацем прямо перед строкой `"export.api": "API for agents",` (сейчас строка 131)
- Modify: `src/lib/i18n/ru.json`: та же группа перед строкой `"export.api": "API для агентов",` (сейчас строка 131)
- Test: `src/lib/bitrix-draft.test.ts`

**Interfaces:**
- Consumes (всё уже есть в репозитории, от более ранних задач плана ничего не нужно):
  - `translate(locale: Locale, key: string, params?: Record<string, string | number>): string` и `type Locale` из `$lib/i18n/index.js`. Модуль импортирует `$lib/stores/locale.svelte.js`, а тот импортирует `$app/environment`, поэтому в тесте нужен `vi.mock('$app/environment', () => ({ browser: false }))`, как в `src/lib/i18n/translate.test.ts` и `src/lib/server/export.test.ts`.
  - `ANALYSIS_FORMAT` (`'analysis'`) из `$lib/formats.js`.
  - Ключ `summary.photo`: уже есть, en `Photo`, ru `Фото`.
- Produces (для задачи 10, `BitrixTaskModal.svelte`):
  ```ts
  // src/lib/bitrix-draft.ts
  export interface DraftInput {
  	card: { content: string; authorName: string | null; imageId: string | null };
  	board: { title: string; slug: string; format: string };
  	columnTitle: string | null; // уже локализовано вызывающим через txt(); null — колонка неизвестна
  	comments: { authorName: string | null; content: string; imageId: string | null }[]; // в порядке показа
  	likes: number;
  	dislikes: number;
  	origin: string; // page.url.origin
  	locale: Locale;
  }
  export function buildTaskDraft(input: DraftInput): { title: string; description: string };
  ```
  Как вызывать в задаче 10 (для справки, в этой задаче не пишется):
  ```ts
  buildTaskDraft({
  	card: { content: card.content, authorName: card.authorName, imageId: card.imageId },
  	board: { title: board.title, slug: board.slug, format: board.format },
  	columnTitle: txt(boardStore.columnDef(card.columnType).title),
  	comments: boardStore.getCardComments(card.id),
  	likes: boardStore.getCardLikes(card.id),
  	dislikes: boardStore.getCardDislikes(card.id),
  	origin: page.url.origin,
  	locale: localeStore.locale
  });
  ```
  Ключи i18n: `bitrix.draft.fromRetro`, `bitrix.draft.fromRetroNoColumn` (добавлен к контракту), `bitrix.draft.fromAnalysis`, `bitrix.draft.author`, `bitrix.draft.votes`, `bitrix.draft.against`, `bitrix.draft.comments`, `bitrix.draft.anonymous`, `bitrix.draft.photoCard`.

**Правила черновика** (спека, Секция 4 «Преформа», заметки макета 19–20):
- `title`: первая непустая строка карточки без пробелов по краям. Если она длиннее 100 символов, режем по последнему пробелу в первых 100 символах и добавляем «…». Если сотый символ закрывает слово, слово остаётся целым. Если пробела в первых 100 символах нет (одно длинное слово, ссылка), режем жёстко на 100 символах и не оставляем половинку суррогатной пары. Карточка без текста (фото) получает `bitrix.draft.photoCard`.
- `description`: блоки через пустую строку, каждый только при наличии данных:
  1. текст карточки (trim);
  2. `bitrix.draft.fromRetro` (на доске-анализе `bitrix.draft.fromAnalysis`, при `columnTitle === null` `bitrix.draft.fromRetroNoColumn`), на следующей строке `{origin}/{slug}` (завершающий слэш у origin срезается);
  3. части через ` · `: `bitrix.draft.author` (если имя непустое), `bitrix.draft.votes` (если `likes > 0`), `bitrix.draft.against` (если `dislikes > 0`);
  4. `bitrix.draft.comments` и строки `{name}: {text}`. Пустое имя даёт `bitrix.draft.anonymous`. Пустой текст при `imageId` даёт `summary.photo`. Пустой текст без картинки: строка пропускается. Если не осталось ни одной строки, блока нет.
- Описание не длиннее 20 000 символов, это потолок `parseTaskForm` из задачи 5. Карточка не длиннее 2000 символов, поэтому переполнить потолок могут только комментарии. Те, что не влезли, отбрасываются с конца.
- Пользовательский текст (название доски, имена) подставляется за один проход локальной `fill()`, а не через `params` у `translate()`. `translate` вызывает `replaceAll` со строкой: тот понимает `$&` и `$'`, а `{column}` в названии доски подставится второй раз. Числа (`n`) идут через `translate` как обычно, чтобы работали формы множественного числа.

- [ ] **Step 1: Write the failing test**

Создать `src/lib/bitrix-draft.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

import { buildTaskDraft, type DraftInput } from './bitrix-draft.js';

const ru: DraftInput = {
	card: {
		content: 'Релизы по пятницам ломают выходные\nДавайте катить до четверга',
		authorName: 'Мария',
		imageId: null
	},
	board: { title: 'Спринт 42', slug: 'abc123', format: 'classic' },
	columnTitle: 'Не получилось',
	comments: [
		{ authorName: 'Пётр', content: 'Согласен', imageId: null },
		{ authorName: null, content: 'Только не в релизную неделю', imageId: null }
	],
	likes: 3,
	dislikes: 1,
	origin: 'https://retro.test',
	locale: 'ru'
};

const en: DraftInput = {
	...ru,
	card: { ...ru.card, authorName: 'Maria' },
	board: { ...ru.board, title: 'Sprint 42' },
	columnTitle: "Didn't Go Well",
	comments: [{ authorName: 'Peter', content: 'Agreed', imageId: null }],
	locale: 'en'
};

function withCard(base: DraftInput, card: Partial<DraftInput['card']>): DraftInput {
	return { ...base, card: { ...base.card, ...card } };
}

describe('buildTaskDraft — название', () => {
	it('первая непустая строка карточки без пробелов по краям', () => {
		const draft = buildTaskDraft(withCard(ru, { content: '\n   \n  Релизы по пятницам  \nвторая строка' }));
		expect(draft.title).toBe('Релизы по пятницам');
	});

	it('строка ровно в 100 символов остаётся без многоточия', () => {
		const line = 'x'.repeat(100);
		expect(buildTaskDraft(withCard(ru, { content: line })).title).toBe(line);
	});

	it('длинная строка режется по границе слова и получает многоточие', () => {
		const line = 'слово '.repeat(30).trim();
		const { title } = buildTaskDraft(withCard(ru, { content: line }));
		expect(title).toBe('слово '.repeat(16).trim() + '…');
		expect(title.length).toBeLessThanOrEqual(101);
	});

	it('слово, закончившееся ровно на сотом символе, остаётся целым', () => {
		const line = 'x'.repeat(49) + ' ' + 'y'.repeat(50) + ' хвост';
		expect(buildTaskDraft(withCard(ru, { content: line })).title).toBe('x'.repeat(49) + ' ' + 'y'.repeat(50) + '…');
	});

	it('одно слово длиннее 100 символов режется жёстко', () => {
		const { title } = buildTaskDraft(withCard(ru, { content: 'x'.repeat(150) }));
		expect(title).toBe('x'.repeat(100) + '…');
	});

	it('жёсткая обрезка не оставляет половинку эмодзи', () => {
		const { title } = buildTaskDraft(withCard(ru, { content: 'x'.repeat(99) + '😀'.repeat(5) }));
		expect(title).toBe('x'.repeat(99) + '…');
	});

	it('карточка-фото без текста называется по доске в обеих локалях', () => {
		expect(buildTaskDraft(withCard(ru, { content: '', imageId: 'img-1' })).title).toBe('Карточка из ретро «Спринт 42»');
		expect(buildTaskDraft(withCard(en, { content: '  \n ', imageId: 'img-1' })).title).toBe('Card from retro “Sprint 42”');
	});
});

describe('buildTaskDraft — описание', () => {
	it('все блоки по порядку через пустую строку (ru)', () => {
		expect(buildTaskDraft(ru).description).toBe(
			[
				'Релизы по пятницам ломают выходные\nДавайте катить до четверга',
				'Из ретро «Спринт 42» · колонка «Не получилось»\nhttps://retro.test/abc123',
				'Автор: Мария · 3 голоса · против: 1',
				'Комментарии:\nПётр: Согласен\nАноним: Только не в релизную неделю'
			].join('\n\n')
		);
	});

	it('все блоки по порядку через пустую строку (en)', () => {
		expect(buildTaskDraft(en).description).toBe(
			[
				'Релизы по пятницам ломают выходные\nДавайте катить до четверга',
				'From retro “Sprint 42” · column “Didn\'t Go Well”\nhttps://retro.test/abc123',
				'Author: Maria · 3 votes · against: 1',
				'Comments:\nPeter: Agreed'
			].join('\n\n')
		);
	});

	it('карточка без текста — описание начинается со строки источника', () => {
		const { description } = buildTaskDraft(withCard(ru, { content: '', imageId: 'img-1' }));
		expect(description.startsWith('Из ретро «Спринт 42» · колонка «Не получилось»\nhttps://retro.test/abc123\n\n')).toBe(true);
	});

	it('без автора остаются только голоса', () => {
		const { description } = buildTaskDraft(withCard(ru, { authorName: null }));
		expect(description).toContain('\n\n3 голоса · против: 1\n\n');
		expect(description).not.toContain('Автор');
	});

	it('голоса — только при лайках, «против» — только при дизлайках, с формами числа', () => {
		expect(buildTaskDraft({ ...ru, likes: 0, dislikes: 2 }).description).toContain('\n\nАвтор: Мария · против: 2\n\n');
		expect(buildTaskDraft({ ...ru, likes: 1, dislikes: 0 }).description).toContain('\n\nАвтор: Мария · 1 голос\n\n');
		expect(buildTaskDraft({ ...ru, likes: 5, dislikes: 0 }).description).toContain('· 5 голосов\n\n');
		expect(buildTaskDraft({ ...en, likes: 1, dislikes: 0 }).description).toContain('\n\nAuthor: Maria · 1 vote\n\n');
	});

	it('без автора и голосов блок пропадает', () => {
		const { description } = buildTaskDraft({ ...withCard(ru, { authorName: null }), likes: 0, dislikes: 0 });
		expect(description).toBe(
			[
				'Релизы по пятницам ломают выходные\nДавайте катить до четверга',
				'Из ретро «Спринт 42» · колонка «Не получилось»\nhttps://retro.test/abc123',
				'Комментарии:\nПётр: Согласен\nАноним: Только не в релизную неделю'
			].join('\n\n')
		);
	});

	it('без комментариев блок пропадает', () => {
		const { description } = buildTaskDraft({ ...ru, comments: [] });
		expect(description.endsWith('https://retro.test/abc123\n\nАвтор: Мария · 3 голоса · против: 1')).toBe(true);
		expect(description).not.toContain('Комментарии');
	});

	it('комментарий без имени — «Аноним», без текста с фото — «Фото»', () => {
		const comments = [
			{ authorName: null, content: 'Плюс', imageId: null },
			{ authorName: 'Олег', content: '', imageId: 'img-2' },
			{ authorName: '  ', content: '  ', imageId: 'img-3' }
		];
		expect(buildTaskDraft({ ...ru, comments }).description).toContain('Комментарии:\nАноним: Плюс\nОлег: Фото\nАноним: Фото');
		expect(buildTaskDraft({ ...en, comments }).description).toContain('Comments:\nAnonymous: Плюс\nОлег: Photo\nAnonymous: Photo');
	});

	it('пустой комментарий без фото пропускается, а без других — нет и заголовка', () => {
		const { description } = buildTaskDraft({ ...ru, comments: [{ authorName: 'Олег', content: '   ', imageId: null }] });
		expect(description).not.toContain('Комментарии');
		expect(description).not.toContain('Олег');
	});

	it('доска-анализ — «Из AI-анализа» без колонки', () => {
		const analysis: DraftInput = {
			...withCard(ru, { authorName: null }),
			board: { title: 'Анализ пространства', slug: 'an1', format: 'analysis' },
			columnTitle: 'Снова плохо'
		};
		const { description } = buildTaskDraft(analysis);
		expect(description).toContain('\n\nИз AI-анализа «Анализ пространства»\nhttps://retro.test/an1\n\n');
		expect(description).not.toContain('колонка');
		expect(buildTaskDraft({ ...analysis, locale: 'en' }).description).toContain('From AI analysis “Анализ пространства”\n');
	});

	it('неизвестная колонка — строка источника без колонки', () => {
		expect(buildTaskDraft({ ...ru, columnTitle: null }).description).toContain('\n\nИз ретро «Спринт 42»\nhttps://retro.test/abc123\n\n');
		expect(buildTaskDraft({ ...en, columnTitle: null }).description).toContain('\n\nFrom retro “Sprint 42”\nhttps://retro.test/abc123\n\n');
	});

	it('завершающий слэш в origin не удваивается', () => {
		expect(buildTaskDraft({ ...ru, origin: 'https://retro.test/' }).description).toContain('\nhttps://retro.test/abc123\n');
	});

	it('текст пользователя подставляется как есть, без шаблонных подстановок', () => {
		const tricky: DraftInput = {
			...withCard(ru, { authorName: 'Ник $1 {name}', content: '' }),
			board: { ...ru.board, title: 'Бюджет $& {column}' }
		};
		const draft = buildTaskDraft(tricky);
		expect(draft.title).toBe('Карточка из ретро «Бюджет $& {column}»');
		expect(draft.description).toContain('Из ретро «Бюджет $& {column}» · колонка «Не получилось»');
		expect(draft.description).toContain('Автор: Ник $1 {name} · 3 голоса');
	});

	it('черновик не длиннее 20 000 символов: не влезшие комментарии отбрасываются с конца', () => {
		const comments = Array.from({ length: 25 }, (_, i) => ({ authorName: `Участник${i}`, content: 'к'.repeat(990), imageId: null }));
		const { description } = buildTaskDraft({ ...ru, comments });
		expect(description.length).toBeLessThanOrEqual(20_000);
		expect(description).toContain('Комментарии:\nУчастник0: ');
		expect(description).not.toContain('Участник24: ');
	});
});
```

Проверка арифметики в тесте «по границе слова»: слово `i` занимает индексы `6i..6i+4`, пробел стоит на `6i+5`. Символ 100 — последняя буква слова 16 (индексы 96–100), это не пробел. Последний пробел в первых 100 символах стоит на индексе 95, поэтому остаются слова 0–15, то есть 16 слов.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bitrix-draft.test.ts`
Expected: FAIL, у сьюта ошибка загрузки `Failed to load url ./bitrix-draft.js (resolved id: ./bitrix-draft.js) … Does the file exist?`, `Tests  no tests`.

- [ ] **Step 3: Добавить ключи `bitrix.draft.*` в оба словаря**

`src/lib/i18n/en.json`: найти единственную строку

```json
	"export.api": "API for agents",
```

и заменить её на (группа ключей, пустая строка, та же строка `export.api`):

```json
	"bitrix.draft.fromRetro": "From retro “{board}” · column “{column}”",
	"bitrix.draft.fromRetroNoColumn": "From retro “{board}”",
	"bitrix.draft.fromAnalysis": "From AI analysis “{board}”",
	"bitrix.draft.author": "Author: {name}",
	"bitrix.draft.votes": "{n} vote|{n} votes",
	"bitrix.draft.against": "against: {n}",
	"bitrix.draft.comments": "Comments:",
	"bitrix.draft.anonymous": "Anonymous",
	"bitrix.draft.photoCard": "Card from retro “{board}”",

	"export.api": "API for agents",
```

`src/lib/i18n/ru.json`: найти единственную строку

```json
	"export.api": "API для агентов",
```

и заменить её на:

```json
	"bitrix.draft.fromRetro": "Из ретро «{board}» · колонка «{column}»",
	"bitrix.draft.fromRetroNoColumn": "Из ретро «{board}»",
	"bitrix.draft.fromAnalysis": "Из AI-анализа «{board}»",
	"bitrix.draft.author": "Автор: {name}",
	"bitrix.draft.votes": "{n} голос|{n} голоса|{n} голосов",
	"bitrix.draft.against": "против: {n}",
	"bitrix.draft.comments": "Комментарии:",
	"bitrix.draft.anonymous": "Аноним",
	"bitrix.draft.photoCard": "Карточка из ретро «{board}»",

	"export.api": "API для агентов",
```

Кавычки в EN — типографские `“ ”`, в RU — ёлочки `« »`, ровно как в блоке. Опорная строка `export.api` выбрана потому, что её не трогают задачи 1, 6 и 10, которые тоже правят словари.

Run: `npx vitest run src/lib/i18n/dictionaries.test.ts`
Expected: PASS (3 tests): наборы ключей совпадают, пустых значений нет.

- [ ] **Step 4: Write minimal implementation**

Создать `src/lib/bitrix-draft.ts`:

```ts
// Черновик задачи Битрикс24 из карточки: название и описание для преформы
// (спека, Секция 4 «Преформа», заметки макета 19–20). Чистый модуль без сторов
// и t(): локаль приходит аргументом, поэтому тест гоняет обе локали, а модалка
// считает черновик один раз при открытии.
import { translate, type Locale } from '$lib/i18n/index.js';
import { ANALYSIS_FORMAT } from '$lib/formats.js';

export interface DraftInput {
	card: { content: string; authorName: string | null; imageId: string | null };
	board: { title: string; slug: string; format: string };
	/** Название колонки, уже локализованное вызывающим через txt(); null — колонка неизвестна */
	columnTitle: string | null;
	/** Комментарии карточки в порядке показа */
	comments: { authorName: string | null; content: string; imageId: string | null }[];
	likes: number;
	dislikes: number;
	/** page.url.origin */
	origin: string;
	locale: Locale;
}

const TITLE_MAX = 100;
/** Потолок описания в parseTaskForm: длиннее — 422 invalid */
const DESCRIPTION_MAX = 20_000;

/**
 * Подставляет пользовательский текст в шаблон словаря за один проход.
 * Не через params у translate(): его replaceAll со строкой понимает `$&` и `$'`,
 * а `{column}` в названии доски подставился бы второй раз.
 */
function fill(locale: Locale, key: string, params: Record<string, string>): string {
	return translate(locale, key).replace(/\{(\w+)\}/g, (placeholder, name: string) => params[name] ?? placeholder);
}

function truncateTitle(line: string): string {
	if (line.length <= TITLE_MAX) return line;
	const head = line.slice(0, TITLE_MAX);
	// Сотый символ закончил слово — оно остаётся целым
	if (/\s/.test(line[TITLE_MAX])) return head.trimEnd() + '…';
	const lastSpace = head.search(/\s\S*$/);
	if (lastSpace > 0) return head.slice(0, lastSpace).trimEnd() + '…';
	// Одно слово длиннее 100 символов (например, ссылка): жёсткий срез без половинки эмодзи
	const last = head.charCodeAt(head.length - 1);
	return (last >= 0xd800 && last <= 0xdbff ? head.slice(0, -1) : head) + '…';
}

function sourceLine({ board, columnTitle, locale }: DraftInput): string {
	if (board.format === ANALYSIS_FORMAT) return fill(locale, 'bitrix.draft.fromAnalysis', { board: board.title });
	if (columnTitle) return fill(locale, 'bitrix.draft.fromRetro', { board: board.title, column: columnTitle });
	return fill(locale, 'bitrix.draft.fromRetroNoColumn', { board: board.title });
}

function authorLine({ card, likes, dislikes, locale }: DraftInput): string {
	const parts: string[] = [];
	const name = card.authorName?.trim();
	if (name) parts.push(fill(locale, 'bitrix.draft.author', { name }));
	if (likes > 0) parts.push(translate(locale, 'bitrix.draft.votes', { n: likes }));
	if (dislikes > 0) parts.push(translate(locale, 'bitrix.draft.against', { n: dislikes }));
	return parts.join(' · ');
}

function commentLines({ comments, locale }: DraftInput): string[] {
	const lines: string[] = [];
	for (const comment of comments) {
		const name = comment.authorName?.trim() || translate(locale, 'bitrix.draft.anonymous');
		const text = comment.content.trim() || (comment.imageId ? translate(locale, 'summary.photo') : '');
		if (text) lines.push(`${name}: ${text}`);
	}
	return lines;
}

export function buildTaskDraft(input: DraftInput): { title: string; description: string } {
	const { card, board, locale } = input;
	const text = card.content.trim();
	const title = text
		? truncateTitle(text.split('\n')[0].trim())
		: fill(locale, 'bitrix.draft.photoCard', { board: board.title });

	const blocks: string[] = [];
	if (text) blocks.push(text);
	blocks.push(`${sourceLine(input)}\n${input.origin.replace(/\/+$/, '')}/${board.slug}`);
	const author = authorLine(input);
	if (author) blocks.push(author);
	let description = blocks.join('\n\n');

	const lines = commentLines(input);
	let commentsBlock = translate(locale, 'bitrix.draft.comments');
	let added = 0;
	for (const line of lines) {
		// Карточка ≤ 2000 символов, поэтому переполнить потолок могут только комментарии
		if (description.length + 2 + commentsBlock.length + 1 + line.length > DESCRIPTION_MAX) break;
		commentsBlock += `\n${line}`;
		added++;
	}
	if (added > 0) description += `\n\n${commentsBlock}`;

	return { title, description };
}
```

Заметки к реализации:
- `text` уже без пробелов по краям, поэтому первая строка `text.split('\n')[0]` непустая. `\r` из CRLF срезает `trim()`.
- `head.search(/\s\S*$/)` возвращает позицию последнего пробельного символа в `head`. Результат `> 0`, потому что строка обрезана слева и `head[0]` не пробел.
- Модуль не импортирует `$state` и `t()`, поэтому его можно звать из компонента и из теста.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/bitrix-draft.test.ts src/lib/i18n`
Expected: PASS. `src/lib/bitrix-draft.test.ts (21 tests)`, `dictionaries.test.ts`, `index.test.ts` и `translate.test.ts` зелёные, `Test Files  4 passed (4)`.

- [ ] **Step 6: Полная проверка**

Run: `npm test`
Expected: все файлы тестов зелёные, в сумме на 21 тест больше, чем до задачи.

Run: `npm run check`
Expected: `svelte-check found 0 errors` в `src/lib/bitrix-draft.ts` и `src/lib/bitrix-draft.test.ts`, новых ошибок нет. Если зовут `params[name]` при `noUncheckedIndexedAccess`, тип уже `string | undefined` и закрыт `?? placeholder`.

Компонентов задача не трогает. Вызов `buildTaskDraft` из `BitrixTaskModal.svelte` появится в задаче 10, а e2e задачи 11 (сценарий 3: `description` со ссылкой на доску в `/__calls` мока) проверит черновик от начала до конца.

- [ ] **Step 7: Commit**

```bash
git add src/lib/bitrix-draft.ts src/lib/bitrix-draft.test.ts src/lib/i18n/en.json src/lib/i18n/ru.json
git commit -m "$(cat <<'EOF'
Битрикс24: черновик задачи из карточки

Чистый модуль bitrix-draft.ts собирает название и описание преформы:
первая строка карточки с обрезкой по слову, строка «Из ретро» со ссылкой
на доску (для анализа — «Из AI-анализа»), автор и голоса, комментарии.
Пользовательский текст подставляется без шаблонных сюрпризов, описание
укладывается в 20 000 символов. Подписи bitrix.draft.* в обеих локалях.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Интерфейс доски: кнопка, бейдж, преформа, Итоги, меню

Спека: Секция 4 («Точки входа», «Преформа», таблица реакций), «Уточнения контракта» в шапке плана, заметки макета 10–30 (Секция 5). Экшен и эндпоинт группы уже есть (задача 8), сторы (задача 7), черновик (задача 9). Эта задача добавляет только клиент.

**Files:**
- Create: `src/lib/bitrix-task-result.ts`: чистая таблица реакций на ответ `createTask`
- Test: `src/lib/bitrix-task-result.test.ts`
- Create: `src/lib/components/TaskBadge.svelte`
- Create: `src/lib/components/BitrixTaskModal.svelte`
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/ru.json`: блок ключей после строки `"focus.maxim"`
- Modify: `src/app.css`: класс `.icon-tip` в `@layer components` после блока `ERRORS` (после `.error-box-sm`, строка 234)
- Modify: `src/lib/components/Board.svelte`: импорт (строки 2–7) и монтирование модалки в конце файла
- Modify: `src/lib/components/Card.svelte`: импорты (строки 2–7), derived после строки 24, группа иконок (строки 118–159), ряд действий (строки 188–211)
- Modify: `src/lib/components/SummaryRow.svelte`: импорты (строки 2–6), derived после строки 46, обычная строка (строки 140–145), ряд управления (строки 148–168)
- Modify: `src/lib/components/Header.svelte`: пункт меню после «Переименовать доску» (строки 397–400)
- `Summary.svelte` не меняется: `canControl = boardStore.isCreator && focusActive` уже приходит в `SummaryRow` пропсом (строки 17 и 91).

**Interfaces:**
- Consumes:
  - задача 1: `CardTask { id: number; url: string }`, `BitrixInfo { spaceSlug; portal; userName; groupId: number | null; groupName: string | null }`, `Card.bitrixTaskId: number | null`, `Card.bitrixTaskUrl: string | null` из `$lib/types.js`;
  - задача 6: ключи `bitrix.error.*` и `bitrix.menu.connect`;
  - задача 7: `boardStore.bitrix: BitrixInfo | null`, `boardStore.bitrixOffer: boolean`, `boardStore.setTask(cardId: string, task: CardTask): void`; `bitrixTaskStore` из `$lib/stores/bitrix-task.svelte.js`: `current: { cardId: string; source: 'card' | 'summary' } | null`, `submitting: boolean`, `open(cardId, source)`, `close()`; `ToastAction.external?: boolean` (рисует `Toasts.svelte`);
  - задача 8: `POST /{slug}?/createTask`, поля `cardId`, `title`, `description`, `groupId`, `deadline`, `important` (`on`), `source`. Успех: `{ task: CardTask, imageAttached: boolean | null }`. Отказ: `fail(status, { bitrixError, field?, message?, task? })`. `GET /{slug}/bitrix/group?id=N` отвечает `{ name }` / `{ notFound: true }` / `{ unknown: true }` / `{ bitrixError }`. `boardStore.setBitrix` вызывает страница доски;
  - задача 9: `buildTaskDraft(input: { card; board: { title; slug; format }; columnTitle: string; comments; likes: number; dislikes: number; origin: string; locale }): { title: string; description: string }` из `$lib/bitrix-draft.js`.
- Produces:
  - `TaskBadge.svelte`, props `{ task: CardTask; size?: 'md' | 'sm' }`, `data-testid="task-badge"`;
  - `BitrixTaskModal.svelte` без пропсов, форма `data-testid="bitrix-task-form"`, кнопка `data-testid="bitrix-task-submit"`;
  - `data-testid="card-task-button"`, `data-testid="summary-task-button"`, `data-testid="menu-bitrix-connect"`;
  - `src/lib/bitrix-task-result.ts`: `type TaskFormField`, `interface TaskFormReaction`, `type TaskReaction`, `taskResultReaction(result: ActionResult): TaskReaction | null`;
  - CSS-класс `.icon-tip`;
  - ключи `bitrix.card.*`, `bitrix.form.*`, `bitrix.summary.*`, `bitrix.toast.*`.

---

- [ ] **Step 1: Write the failing test**

Таблица реакций из спеки («Реакция на `result`») — чистая логика, поэтому она вынесена из компонента и покрыта тестом. Ветвление идёт только по `bitrixError`, статус не читается.

Создать `src/lib/bitrix-task-result.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { taskResultReaction, type TaskFormReaction } from './bitrix-task-result.js';

const task = { id: 745181, url: 'https://bitrix24.team/workgroups/group/2014/tasks/task/view/745181/' };

function failure(data: Record<string, unknown>, status = 409) {
	return { type: 'failure' as const, status, data };
}

function form(patch: Partial<TaskFormReaction>): TaskFormReaction {
	return { type: 'form', errorKey: null, params: {}, settings: false, retry: false, field: null, groupNotFound: false, ...patch };
}

describe('taskResultReaction — успех', () => {
	it('задача создана: закрыть модалку и показать тост «создана»', () => {
		expect(taskResultReaction({ type: 'success', status: 200, data: { task, imageAttached: true } })).toEqual({
			type: 'created',
			task,
			toastKey: 'bitrix.toast.created'
		});
		expect(taskResultReaction({ type: 'success', status: 200, data: { task, imageAttached: null } })).toEqual({
			type: 'created',
			task,
			toastKey: 'bitrix.toast.created'
		});
	});

	it('картинка не прикрепилась — тост предупреждает', () => {
		expect(taskResultReaction({ type: 'success', status: 200, data: { task, imageAttached: false } })).toEqual({
			type: 'created',
			task,
			toastKey: 'bitrix.toast.createdNoImage'
		});
	});

	it('успех без корректной задачи в ответе — тост ошибки, форма остаётся', () => {
		expect(taskResultReaction({ type: 'success', status: 200, data: {} })).toEqual({ type: 'toast', toastKey: 'bitrix.toast.error' });
		expect(taskResultReaction({ type: 'success', status: 200, data: { task: { id: '1', url: '/x' } } })).toEqual({
			type: 'toast',
			toastKey: 'bitrix.toast.error'
		});
	});
});

describe('taskResultReaction — отказы экшена', () => {
	it('exists: закрыть модалку, бейдж из ответа', () => {
		expect(taskResultReaction(failure({ bitrixError: 'exists', task }))).toEqual({ type: 'exists', task });
		expect(taskResultReaction(failure({ bitrixError: 'exists' }))).toEqual({ type: 'exists', task: null });
	});

	it('forbidden и not_found: тост ошибки и закрыть модалку', () => {
		expect(taskResultReaction(failure({ bitrixError: 'forbidden' }, 403))).toEqual({ type: 'closeWithToast', toastKey: 'bitrix.error.forbidden' });
		expect(taskResultReaction(failure({ bitrixError: 'not_found' }, 404))).toEqual({ type: 'closeWithToast', toastKey: 'bitrix.error.not_found' });
	});

	it('вебхук, права, доступ и нет подключения: текст и ссылка в настройки пространства', () => {
		for (const kind of ['invalid_webhook', 'scope', 'access', 'not_connected']) {
			expect(taskResultReaction(failure({ bitrixError: kind }))).toEqual(form({ errorKey: `bitrix.error.${kind}`, settings: true }));
		}
	});

	it('сеть, таймаут, ответ, лимиты и «уже создаёт»: текст и кнопка «Повторить»', () => {
		for (const kind of ['network', 'timeout', 'shape', 'limit', 'rate_limited', 'running']) {
			expect(taskResultReaction(failure({ bitrixError: kind }, 502))).toEqual(form({ errorKey: `bitrix.error.${kind}`, retry: true }));
		}
	});

	it('group: подсветка поля группы без текста в error-box', () => {
		expect(taskResultReaction(failure({ bitrixError: 'group' }))).toEqual(form({ field: 'groupId', groupNotFound: true }));
	});

	it('invalid: подсветка названного поля; скрытое поле не подсвечивается', () => {
		expect(taskResultReaction(failure({ bitrixError: 'invalid', field: 'deadline' }, 422))).toEqual(
			form({ errorKey: 'bitrix.error.invalid', field: 'deadline' })
		);
		expect(taskResultReaction(failure({ bitrixError: 'invalid', field: 'cardId' }, 422))).toEqual(form({ errorKey: 'bitrix.error.invalid' }));
	});

	it('rejected: текст портала и поле, если портал его назвал', () => {
		expect(
			taskResultReaction(failure({ bitrixError: 'rejected', message: 'Крайний срок в прошлом', field: 'deadline' }, 422))
		).toEqual(form({ errorKey: 'bitrix.error.rejected', params: { message: 'Крайний срок в прошлом' }, field: 'deadline' }));
		expect(taskResultReaction(failure({ bitrixError: 'rejected', field: 'responsibleId' }, 422))).toEqual(
			form({ errorKey: 'bitrix.error.rejected', params: { message: '' } })
		);
	});

	it('encryption: текст без повтора и без ссылки', () => {
		expect(taskResultReaction(failure({ bitrixError: 'encryption' }, 503))).toEqual(form({ errorKey: 'bitrix.error.encryption' }));
	});

	it('ветвление по bitrixError, а не по статусу', () => {
		expect(taskResultReaction(failure({ bitrixError: 'forbidden' }, 502))).toEqual({ type: 'closeWithToast', toastKey: 'bitrix.error.forbidden' });
		expect(taskResultReaction(failure({ bitrixError: 'network' }, 403))).toEqual(form({ errorKey: 'bitrix.error.network', retry: true }));
	});

	it('неизвестный вид или пустой ответ — тост ошибки, форма остаётся', () => {
		expect(taskResultReaction(failure({ bitrixError: 'something_new' }))).toEqual({ type: 'toast', toastKey: 'bitrix.toast.error' });
		expect(taskResultReaction({ type: 'failure', status: 500 })).toEqual({ type: 'toast', toastKey: 'bitrix.toast.error' });
	});
});

describe('taskResultReaction — ответы не от экшена', () => {
	it('неожиданная ошибка сервера — тост, форма остаётся', () => {
		expect(taskResultReaction({ type: 'error', status: 500, error: new Error('boom') })).toEqual({
			type: 'toast',
			toastKey: 'bitrix.toast.error'
		});
	});

	it('редирект игнорируется', () => {
		expect(taskResultReaction({ type: 'redirect', status: 303, location: '/' })).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bitrix-task-result.test.ts`
Expected: FAIL. Vite не находит модуль: `Failed to resolve import "./bitrix-task-result.js" from "src/lib/bitrix-task-result.test.ts"`.

- [ ] **Step 3: Write minimal implementation**

Создать `src/lib/bitrix-task-result.ts`:

```ts
// Реакция преформы задачи на ответ экшена createTask — таблица из спеки
// (Секция 4, «Реакция на result»). Ветвимся только по bitrixError, статус не читаем.
// Ключи i18n возвращаем, а не переводим: модуль чистый, t() зовёт компонент.
import type { ActionResult } from '@sveltejs/kit';
import type { CardTask } from '$lib/types.js';

export type TaskFormField = 'title' | 'description' | 'groupId' | 'deadline';

/** Форма остаётся открытой: текст в error-box (errorKey), подсветка поля, «Повторить» или ссылка в настройки */
export interface TaskFormReaction {
	type: 'form';
	errorKey: string | null;
	params: Record<string, string>;
	settings: boolean;
	retry: boolean;
	field: TaskFormField | null;
	groupNotFound: boolean;
}

export type TaskReaction =
	| { type: 'created'; task: CardTask; toastKey: 'bitrix.toast.created' | 'bitrix.toast.createdNoImage' }
	| { type: 'exists'; task: CardTask | null }
	| { type: 'closeWithToast'; toastKey: string }
	| { type: 'toast'; toastKey: string }
	| TaskFormReaction;

const FIELDS: readonly TaskFormField[] = ['title', 'description', 'groupId', 'deadline'];
const SETTINGS_KINDS = new Set(['invalid_webhook', 'scope', 'access', 'not_connected']);
const RETRY_KINDS = new Set(['network', 'timeout', 'shape', 'limit', 'rate_limited', 'running']);
const GENERIC: TaskReaction = { type: 'toast', toastKey: 'bitrix.toast.error' };

function isCardTask(value: unknown): value is CardTask {
	const o = value as { id?: unknown; url?: unknown } | null | undefined;
	return !!o && typeof o.id === 'number' && typeof o.url === 'string';
}

function knownField(value: unknown): TaskFormField | null {
	return FIELDS.includes(value as TaskFormField) ? (value as TaskFormField) : null;
}

function form(patch: Partial<TaskFormReaction>): TaskFormReaction {
	return { type: 'form', errorKey: null, params: {}, settings: false, retry: false, field: null, groupNotFound: false, ...patch };
}

export function taskResultReaction(result: ActionResult): TaskReaction | null {
	if (result.type === 'redirect') return null;
	if (result.type === 'error') return GENERIC;

	const data = (result.data ?? {}) as {
		task?: unknown;
		imageAttached?: unknown;
		bitrixError?: unknown;
		field?: unknown;
		message?: unknown;
	};

	if (result.type === 'success') {
		if (!isCardTask(data.task)) return GENERIC;
		return {
			type: 'created',
			task: data.task,
			toastKey: data.imageAttached === false ? 'bitrix.toast.createdNoImage' : 'bitrix.toast.created'
		};
	}

	const kind = typeof data.bitrixError === 'string' ? data.bitrixError : '';
	if (kind === 'exists') return { type: 'exists', task: isCardTask(data.task) ? data.task : null };
	if (kind === 'forbidden' || kind === 'not_found') return { type: 'closeWithToast', toastKey: `bitrix.error.${kind}` };
	if (SETTINGS_KINDS.has(kind)) return form({ errorKey: `bitrix.error.${kind}`, settings: true });
	if (RETRY_KINDS.has(kind)) return form({ errorKey: `bitrix.error.${kind}`, retry: true });
	if (kind === 'group') return form({ field: 'groupId', groupNotFound: true });
	if (kind === 'invalid') return form({ errorKey: 'bitrix.error.invalid', field: knownField(data.field) });
	if (kind === 'rejected') {
		return form({
			errorKey: 'bitrix.error.rejected',
			params: { message: typeof data.message === 'string' ? data.message : '' },
			field: knownField(data.field)
		});
	}
	if (kind === 'encryption') return form({ errorKey: 'bitrix.error.encryption' });
	return GENERIC;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bitrix-task-result.test.ts`
Expected: PASS, 15 тестов в трёх `describe` (3 + 10 + 2).

- [ ] **Step 5: Ключи i18n**

В `src/lib/i18n/en.json` найти строку

```json
	"focus.maxim": "Any argument that cannot be settled in five minutes cannot be settled by arguing",
```

и сразу после неё (перед пустой строкой и `"timer.min"`) вставить:

```json

	"bitrix.card.create": "To Bitrix24 task",
	"bitrix.card.task": "Task #{id}",
	"bitrix.card.taskTitle": "Task #{id} in Bitrix24",
	"bitrix.form.title": "Bitrix24 task",
	"bitrix.form.subtitle": "{portal} · the retro tag is added automatically",
	"bitrix.form.close": "Close",
	"bitrix.form.name": "Title",
	"bitrix.form.description": "Description",
	"bitrix.form.group": "Group (id)",
	"bitrix.form.groupNotFound": "Group not found — check the id or clear the field",
	"bitrix.form.deadline": "Deadline",
	"bitrix.form.important": "Important task",
	"bitrix.form.imageNote": "The card image will be attached",
	"bitrix.form.responsible": "Responsible and creator: {name}",
	"bitrix.form.cancel": "Cancel",
	"bitrix.form.submit": "Create task",
	"bitrix.form.creating": "Creating…",
	"bitrix.form.creatingWithImage": "Creating and attaching the image…",
	"bitrix.form.retry": "Retry",
	"bitrix.form.settingsLink": "Space settings →",
	"bitrix.summary.create": "To task",
	"bitrix.toast.created": "Task #{id} created",
	"bitrix.toast.createdNoImage": "Task #{id} created, the image was not attached",
	"bitrix.toast.open": "Open",
	"bitrix.toast.cardGone": "The card was deleted — no task was created",
	"bitrix.toast.error": "Could not create the task",
```

В `src/lib/i18n/ru.json` найти строку

```json
	"focus.maxim": "Любой спор, который не удаётся завершить за 5 минут, не может быть решён обсуждением",
```

и сразу после неё вставить:

```json

	"bitrix.card.create": "В задачу Битрикс24",
	"bitrix.card.task": "Задача #{id}",
	"bitrix.card.taskTitle": "Задача #{id} в Битрикс24",
	"bitrix.form.title": "Задача в Битрикс24",
	"bitrix.form.subtitle": "{portal} · тег retro добавится автоматически",
	"bitrix.form.close": "Закрыть",
	"bitrix.form.name": "Название",
	"bitrix.form.description": "Описание",
	"bitrix.form.group": "Группа (id)",
	"bitrix.form.groupNotFound": "Группа не найдена — проверьте id или очистите поле",
	"bitrix.form.deadline": "Срок",
	"bitrix.form.important": "Важная задача",
	"bitrix.form.imageNote": "Картинка карточки будет прикреплена",
	"bitrix.form.responsible": "Ответственный и постановщик: {name}",
	"bitrix.form.cancel": "Отмена",
	"bitrix.form.submit": "Создать задачу",
	"bitrix.form.creating": "Создаём…",
	"bitrix.form.creatingWithImage": "Создаём и прикрепляем картинку…",
	"bitrix.form.retry": "Повторить",
	"bitrix.form.settingsLink": "Настройки пространства →",
	"bitrix.summary.create": "В задачу",
	"bitrix.toast.created": "Задача #{id} создана",
	"bitrix.toast.createdNoImage": "Задача #{id} создана, картинка не прикреплена",
	"bitrix.toast.open": "Открыть",
	"bitrix.toast.cardGone": "Карточка удалена — задача не создана",
	"bitrix.toast.error": "Не удалось создать задачу",
```

Run: `npx vitest run src/lib/i18n/dictionaries.test.ts`
Expected: PASS, 3 теста. Если JSON сломан, тест падает на разборе файла.

- [ ] **Step 6: Подсказка `.icon-tip` в `src/app.css`**

Внутри `@layer components`, сразу после строки `.error-box-sm { @apply px-2.5 py-1.5 text-[13px]; }` и до закрывающей `}` слоя, вставить:

```css


	/* ---------- TOOLTIPS ---------- */

	/* Подсказка иконок карточки (заметка макета 11). Та же идиома, что у FocusTimer:
	   чернильная плашка 13px под группой иконок, прижатая к её правому краю.
	   relative стоит на группе, у самой кнопки позиции нет. Текст берётся из
	   aria-label: он не дублируется в DOM и не попадает в текст карточки */
	.icon-tip::after {
		@apply pointer-events-none absolute right-0 top-full z-30 mt-1.5 whitespace-nowrap rounded-xl
		       bg-text-primary px-3 py-2 text-[13px] font-normal leading-snug text-surface shadow-1
		       opacity-0 transition-opacity duration-150;
		content: attr(aria-label);
	}
	/* На таче ховер «залипает» после тапа, поэтому только для устройств с настоящим ховером */
	@media (hover: hover) {
		.icon-tip:hover::after { @apply opacity-100; }
	}
	.icon-tip:focus-visible::after { @apply opacity-100; }
```

- [ ] **Step 7: `TaskBadge.svelte`**

Создать `src/lib/components/TaskBadge.svelte`:

```svelte
<script lang="ts">
	import type { CardTask } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	// Бейдж-ссылка на задачу Битрикс24 (заметки макета 12–14, 29). Нейтральный:
	// не цвет колонки, не терракота и не improve.
	// md — 32px на карточке и в обсуждаемой строке Итогов (40 на телефоне);
	// sm — 28px «#123» в обычной строке Итогов.
	let { task, size = 'md' }: { task: CardTask; size?: 'md' | 'sm' } = $props();
</script>

{#if size === 'sm'}
	<!-- pointer-events-auto: иначе во время обсуждения клик уйдёт в прозрачный слой прыжка фокуса -->
	<a
		href={task.url}
		target="_blank"
		rel="noopener"
		data-testid="task-badge"
		title={t('bitrix.card.taskTitle', { id: task.id })}
		aria-label={t('bitrix.card.taskTitle', { id: task.id })}
		class="badge-pop pointer-events-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-border px-2.5 text-[13px] font-semibold tabular-nums text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
	>
		<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 12 2 2 4-4" /></svg>
		#{task.id}
	</a>
{:else}
	<a
		href={task.url}
		target="_blank"
		rel="noopener"
		data-testid="task-badge"
		title={task.url}
		class="badge-pop inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-card px-3 text-[13px] font-semibold text-text-primary transition-colors hover:border-border-strong hover:bg-surface-hover active:scale-[0.97] max-md:h-10 max-md:px-4"
	>
		{t('bitrix.card.task', { id: task.id })}
		<svg class="h-3.5 w-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
	</a>
{/if}
```

`badgePop` анимирует `transform`, а `active:scale-[0.97]` в Tailwind 4 задаёт отдельное свойство `scale`, поэтому одно другому не мешает.

- [ ] **Step 8: `BitrixTaskModal.svelte`, скрипт**

Создать `src/lib/components/BitrixTaskModal.svelte` с блоком `<script>` (разметку добавляет следующий шаг):

```svelte
<script lang="ts">
	import { onDestroy, tick, untrack } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ToggleSwitch from './ToggleSwitch.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { bitrixTaskStore } from '$lib/stores/bitrix-task.svelte.js';
	import { toastStore } from '$lib/stores/toast.svelte.js';
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { buildTaskDraft } from '$lib/bitrix-draft.js';
	import { taskResultReaction, type TaskFormField } from '$lib/bitrix-task-result.js';
	import { txt } from '$lib/content/localized.js';
	import { t } from '$lib/i18n/index.js';

	// Преформа задачи Битрикс24: одна на доску, монтируется в Board.svelte (заметки макета 17–28).
	// Черновик считается один раз при открытии. Дальнейшие card:updated, голоса,
	// комментарии и переименование поля не трогают: что в поле, то и уходит.
	const FOCUSABLE =
		'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled])';

	type GroupStatus = { kind: 'idle' } | { kind: 'name'; name: string } | { kind: 'notFound' };
	type FormError = { text: string; settings: boolean; retry: boolean };

	let ready = $state(false);
	let cardId = $state('');
	let source = $state<'card' | 'summary'>('card');
	let title = $state('');
	let description = $state('');
	let groupId = $state('');
	let deadline = $state('');
	let important = $state(false);
	let hasImage = $state(false);
	let phone = $state(false);
	let today = $state('');
	let groupStatus = $state<GroupStatus>({ kind: 'idle' });
	let formError = $state<FormError | null>(null);
	let invalidField = $state<TaskFormField | null>(null);
	let groupShake = $state(false);
	let dialogEl = $state<HTMLDivElement | null>(null);

	let busy = $derived(bitrixTaskStore.submitting);

	// Не реактивные: объект current, для которого посчитан черновик, и кому вернуть фокус
	let openedWith: unknown = null;
	let opener: HTMLElement | null = null;
	let groupTimer: ReturnType<typeof setTimeout> | undefined;
	let groupAbort: AbortController | null = null;
	let shakeTimer: ReturnType<typeof setTimeout> | undefined;

	function localDate(): string {
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	function startDraft(current: { cardId: string; source: 'card' | 'summary' }) {
		const board = boardStore.board;
		const info = boardStore.bitrix;
		if (!board || !info) {
			bitrixTaskStore.close();
			return;
		}
		const card = boardStore.cards.find((c) => c.id === current.cardId);
		// Карточки уже нет: модалку закроет эффект «карточка удалена» ниже
		if (!card) return;
		const comments = boardStore
			.getCardComments(card.id)
			.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
		const draft = buildTaskDraft({
			card,
			board: { title: board.title, slug: board.slug, format: board.format },
			columnTitle: txt(boardStore.columnDef(card.columnType).title),
			comments,
			likes: boardStore.getCardLikes(card.id),
			dislikes: boardStore.getCardDislikes(card.id),
			origin: window.location.origin,
			locale: localeStore.locale
		});
		openedWith = current;
		cardId = card.id;
		source = current.source;
		title = draft.title;
		description = draft.description;
		groupId = info.groupId !== null ? String(info.groupId) : '';
		// Название группы пространства уже известно: показываем без запроса
		groupStatus =
			info.groupId !== null && info.groupName ? { kind: 'name', name: info.groupName } : { kind: 'idle' };
		deadline = '';
		important = false;
		hasImage = !!card.imageId;
		formError = null;
		invalidField = null;
		groupShake = false;
		today = localDate();
		phone = window.matchMedia('(max-width: 639.98px)').matches;
		opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		ready = true;
	}

	function finish() {
		resetGroupCheck();
		clearTimeout(shakeTimer);
		openedWith = null;
		if (!ready) return;
		ready = false;
		const back = opener;
		opener = null;
		// Кнопка «В задачу» после создания исчезает, тогда фокус возвращать некуда
		if (back?.isConnected) back.focus();
	}

	// Открытие и закрытие модалки
	$effect(() => {
		const current = bitrixTaskStore.current;
		untrack(() => {
			if (!current) finish();
			else if (openedWith !== current) startDraft(current);
		});
	});

	// Карточку удалили, пока модалка открыта. Если запрос не идёт, закрываемся с тостом.
	// Если идёт, ждём ответа: сервер вернёт not_found
	$effect(() => {
		const current = bitrixTaskStore.current;
		if (!current || bitrixTaskStore.submitting) return;
		if (boardStore.cards.some((c) => c.id === current.cardId)) return;
		untrack(() => {
			bitrixTaskStore.close();
			toastStore.push({ kind: 'error', text: t('bitrix.toast.cardGone') });
		});
	});

	// Задачу по этой карточке создал другой ведущий (card:task): закрываемся молча
	$effect(() => {
		const current = bitrixTaskStore.current;
		if (!current || bitrixTaskStore.submitting) return;
		const card = boardStore.cards.find((c) => c.id === current.cardId);
		if (card?.bitrixTaskId) untrack(() => bitrixTaskStore.close());
	});

	onDestroy(() => {
		resetGroupCheck();
		clearTimeout(shakeTimer);
		// Ушли со страницы доски с открытой модалкой: current не должен дожить до следующей доски
		bitrixTaskStore.close();
	});

	function requestClose() {
		// C2: пока идёт отправка, закрыть нельзя ни крестиком, ни Escape, ни оверлеем
		if (bitrixTaskStore.submitting) return;
		bitrixTaskStore.close();
	}

	function onKeydown(e: KeyboardEvent) {
		if (!ready || !bitrixTaskStore.current || !dialogEl) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			requestClose();
			return;
		}
		if (e.key !== 'Tab') return;
		// Фокус-ловушка: Tab с последнего элемента уходит на первый и обратно
		const items = Array.from(dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE));
		if (items.length === 0) {
			e.preventDefault();
			return;
		}
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement;
		if (!dialogEl.contains(active)) {
			e.preventDefault();
			(e.shiftKey ? last : first).focus();
		} else if (e.shiftKey && active === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}

	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	// Авторост описания: от 4 до 8 строк (min-h / max-h в классах), дальше прокрутка
	function autosize(node: HTMLTextAreaElement) {
		const fit = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight + 2}px`;
		};
		fit();
		const frame = requestAnimationFrame(fit);
		node.addEventListener('input', fit);
		return {
			destroy() {
				cancelAnimationFrame(frame);
				node.removeEventListener('input', fit);
			}
		};
	}

	function clearInvalid(field: TaskFormField) {
		if (invalidField === field) invalidField = null;
	}

	function resetGroupCheck() {
		clearTimeout(groupTimer);
		groupAbort?.abort();
		groupAbort = null;
	}

	// Проверка группы через 400 мс после ввода (заметка 21). Каждый ввод отменяет прошлый запрос
	function onGroupInput(raw: string) {
		resetGroupCheck();
		clearInvalid('groupId');
		const value = raw.trim();
		const info = boardStore.bitrix;
		if (!info || !/^[1-9]\d*$/.test(value)) {
			groupStatus = { kind: 'idle' };
			return;
		}
		if (Number(value) === info.groupId && info.groupName) {
			groupStatus = { kind: 'name', name: info.groupName };
			return;
		}
		groupStatus = { kind: 'idle' };
		groupTimer = setTimeout(() => void checkGroup(value), 400);
	}

	async function checkGroup(value: string) {
		const slug = boardStore.board?.slug;
		if (!slug) return;
		const controller = new AbortController();
		groupAbort = controller;
		try {
			const res = await fetch(`/${slug}/bitrix/group?id=${encodeURIComponent(value)}`, { signal: controller.signal });
			const body = (await res.json()) as { name?: unknown; notFound?: unknown };
			if (controller.signal.aborted || groupId.trim() !== value) return;
			// Ветвимся по телу, не по статусу. { unknown }, forbidden и лимит поле не подсвечивают
			if (typeof body.name === 'string') groupStatus = { kind: 'name', name: body.name };
			else if (body.notFound === true) groupStatus = { kind: 'notFound' };
		} catch {
			// отменили или сеть моргнула: поле не подсвечиваем
		} finally {
			if (groupAbort === controller) groupAbort = null;
		}
	}

	function shakeGroup() {
		groupShake = false;
		clearTimeout(shakeTimer);
		void tick().then(() => {
			groupShake = true;
			shakeTimer = setTimeout(() => (groupShake = false), 600);
		});
	}

	async function focusAfterError(field: TaskFormField | null) {
		await tick();
		if (!dialogEl) return;
		const target = field
			? dialogEl.querySelector<HTMLElement>(`[name="${field}"]`)
			: dialogEl.querySelector<HTMLElement>('[data-testid="bitrix-task-submit"]');
		target?.focus();
	}

	// Идиома AnalyzeButton: колбэк сам разбирает result и НЕ вызывает update().
	// invalidateAll перезапустил бы load доски и $effect входа в комнату
	// (повторный board:join, двойной users:count и board:state всем)
	const submitTask: SubmitFunction = ({ cancel }) => {
		const current = bitrixTaskStore.current;
		if (!current || bitrixTaskStore.submitting) {
			cancel();
			return;
		}
		const forCard = current.cardId;
		// FormData уже собрана до этого колбэка, поэтому disabled на полях её не обнулит
		bitrixTaskStore.submitting = true;
		formError = null;
		invalidField = null;
		return async ({ result }) => {
			bitrixTaskStore.submitting = false;
			const reaction = taskResultReaction(result);
			if (!reaction) return;
			switch (reaction.type) {
				case 'created':
					boardStore.setTask(forCard, reaction.task);
					bitrixTaskStore.close();
					toastStore.push({
						kind: 'success',
						text: t(reaction.toastKey, { id: reaction.task.id }),
						action: { label: t('bitrix.toast.open'), href: reaction.task.url, external: true }
					});
					return;
				case 'exists':
					if (reaction.task) boardStore.setTask(forCard, reaction.task);
					bitrixTaskStore.close();
					return;
				case 'closeWithToast':
					bitrixTaskStore.close();
					toastStore.push({ kind: 'error', text: t(reaction.toastKey) });
					return;
				case 'toast':
					toastStore.push({ kind: 'error', text: t(reaction.toastKey) });
					await focusAfterError(null);
					return;
				case 'form':
					formError = reaction.errorKey
						? { text: t(reaction.errorKey, reaction.params), settings: reaction.settings, retry: reaction.retry }
						: null;
					invalidField = reaction.field;
					if (reaction.groupNotFound) {
						groupStatus = { kind: 'notFound' };
						shakeGroup();
					}
					await focusAfterError(reaction.field);
			}
		};
	};
</script>
```

- [ ] **Step 9: `BitrixTaskModal.svelte`, разметка**

Дописать в тот же файл после `</script>`:

```svelte

<svelte:window onkeydown={onKeydown} />

{#if ready && bitrixTaskStore.current && boardStore.bitrix && boardStore.board}
	{@const info = boardStore.bitrix}
	{@const slug = boardStore.board.slug}
	<!-- Оверлей: bg-scrim, клик мимо карточки закрывает (кроме отправки). На телефоне без scrim -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="modal-overlay-enter fixed inset-0 z-[70] flex items-center justify-center bg-scrim p-4 max-sm:bg-transparent max-sm:p-0"
		onclick={(e) => {
			if (e.target === e.currentTarget) requestClose();
		}}
	>
		<!-- Телефон (заметка 28): лист во весь экран, вход fly y:24; шапка и кнопки прилипают, поля прокручиваются между ними -->
		<div
			bind:this={dialogEl}
			in:fly={{ y: phone ? 24 : 0, duration: phone ? 300 : 0, easing: cubicOut }}
			class="flex max-h-[calc(100dvh-2rem)] w-[480px] max-w-full flex-col rounded-3xl bg-surface-card shadow-2 max-sm:fixed max-sm:inset-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-full max-sm:rounded-none max-sm:shadow-none {phone
				? ''
				: 'modal-card-enter'}"
			role="dialog"
			aria-modal="true"
			aria-labelledby="bitrix-task-heading"
		>
			<div class="flex shrink-0 items-start justify-between gap-3 px-6 pt-6 sm:px-8 sm:pt-8 max-sm:border-b max-sm:border-border max-sm:pb-4">
				<div class="flex min-w-0 flex-col gap-1.5">
					<h3 id="bitrix-task-heading" class="font-heading text-[21px] font-bold text-text-primary">{t('bitrix.form.title')}</h3>
					<p class="text-sm text-text-secondary">{t('bitrix.form.subtitle', { portal: info.portal })}</p>
				</div>
				<button
					type="button"
					onclick={requestClose}
					disabled={busy}
					class="btn-icon btn-icon-lg btn-icon-bordered shrink-0 {busy ? 'pointer-events-none opacity-50' : ''}"
					aria-label={t('bitrix.form.close')}
					title={t('bitrix.form.close')}
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
				</button>
			</div>

			<form
				method="POST"
				action="/{slug}?/createTask"
				use:enhance={submitTask}
				aria-busy={busy}
				data-testid="bitrix-task-form"
				class="flex min-h-0 flex-1 flex-col"
			>
				<input type="hidden" name="cardId" value={cardId} />
				<input type="hidden" name="source" value={source} />
				{#if important}
					<input type="hidden" name="important" value="on" />
				{/if}

				<div class="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-[18px] sm:px-8 {busy ? 'pointer-events-none opacity-50' : ''}">
					<label class="flex flex-col gap-2">
						<span class="text-sm font-semibold text-text-primary">{t('bitrix.form.name')}</span>
						<input
							type="text"
							name="title"
							maxlength="250"
							autocomplete="off"
							bind:value={title}
							use:focusAndSelect
							oninput={() => clearInvalid('title')}
							disabled={busy}
							class="input input-lg bg-surface {invalidField === 'title' ? 'border-bad' : ''}"
						/>
					</label>

					<label class="flex flex-col gap-2">
						<span class="text-sm font-semibold text-text-primary">{t('bitrix.form.description')}</span>
						<textarea
							name="description"
							maxlength="20000"
							rows="4"
							bind:value={description}
							use:autosize
							oninput={() => clearInvalid('description')}
							disabled={busy}
							class="textarea max-h-[204px] min-h-[114px] overflow-y-auto bg-surface px-[18px] py-3 text-[15px] leading-[1.5] {invalidField === 'description'
								? 'border-bad'
								: ''}"
						></textarea>
					</label>

					<div class="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
						<div class="flex min-w-0 flex-col">
							<label class="flex flex-col gap-2">
								<span class="text-sm font-semibold text-text-primary">{t('bitrix.form.group')}</span>
								<input
									type="text"
									name="groupId"
									inputmode="numeric"
									autocomplete="off"
									bind:value={groupId}
									oninput={(e) => onGroupInput(e.currentTarget.value)}
									disabled={busy}
									class="input input-lg bg-surface {groupStatus.kind === 'notFound' || invalidField === 'groupId'
										? 'border-bad'
										: ''} {groupShake ? 'animate-[shake_0.5s_ease]' : ''}"
								/>
							</label>
							{#if groupStatus.kind === 'name'}
								<p class="mt-1.5 truncate text-[13px] text-text-muted">{groupStatus.name}</p>
							{:else if groupStatus.kind === 'notFound'}
								<p class="mt-1.5 text-[13px] text-bad">{t('bitrix.form.groupNotFound')}</p>
							{/if}
						</div>
						<label class="flex min-w-0 flex-col gap-2">
							<span class="text-sm font-semibold text-text-primary">{t('bitrix.form.deadline')}</span>
							<!-- Глиф календаря 16 muted (заметка 21) поверх нативного поля даты.
							     Chromium: свой индикатор пикера прозрачный (opacity-0) и лежит ровно над глифом,
							     клик по глифу открывает пикер (у глифа pointer-events-none).
							     Firefox рисует свою кнопку календаря и не даёт её стилизовать: там глиф прячется
							     и правый паддинг возвращается к 18px (@supports (-moz-appearance:none) — только Firefox).
							     Safari своего индикатора не рисует, глиф там декоративный.
							     span, а не div: внутри label допустим только фразовый контент -->
							<span class="relative block">
								<input
									type="date"
									name="deadline"
									min={today}
									bind:value={deadline}
									oninput={() => clearInvalid('deadline')}
									disabled={busy}
									class="input input-lg relative bg-surface pr-11 supports-[-moz-appearance:none]:pr-[18px] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-3.5 [&::-webkit-calendar-picker-indicator]:my-auto [&::-webkit-calendar-picker-indicator]:size-6 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 {invalidField === 'deadline'
										? 'border-bad'
										: ''}"
								/>
								<svg
									class="pointer-events-none absolute right-[18px] top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted supports-[-moz-appearance:none]:hidden"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>
							</span>
						</label>
					</div>

					<div class="self-start">
						<ToggleSwitch bind:checked={important} label={t('bitrix.form.important')} disabled={busy} />
					</div>

					<!-- Индикаторы, а не контролы: в Tab-порядок не входят -->
					<div class="flex flex-col gap-1.5 text-[13px] text-text-secondary">
						{#if hasImage}
							<p class="flex items-center gap-2">
								<svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
								{t('bitrix.form.imageNote')}
							</p>
						{/if}
						<p class="flex items-center gap-2">
							<svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
							{t('bitrix.form.responsible', { name: info.userName })}
						</p>
					</div>
				</div>

				<div class="flex shrink-0 flex-col gap-3 px-6 pb-6 sm:px-8 sm:pb-8 max-sm:border-t max-sm:border-border max-sm:pt-4 max-sm:pb-[max(env(safe-area-inset-bottom),1rem)]">
					{#if formError}
						<div role="alert" class="error-box flex-wrap" style="animation: fadeUp 0.25s cubic-bezier(0.25, 1, 0.5, 1) both;">
							<span>{formError.text}</span>
							{#if formError.settings}
								<a
									href="/spaces/{info.spaceSlug}?bitrix=1"
									onclick={() => bitrixTaskStore.close()}
									class="font-bold text-bad-strong underline"
								>
									{t('bitrix.form.settingsLink')}
								</a>
							{/if}
						</div>
					{/if}
					<div class="flex gap-2.5">
						<button type="button" onclick={requestClose} disabled={busy} class="btn btn-secondary btn-lg flex-1">
							{t('bitrix.form.cancel')}
						</button>
						<button
							type="submit"
							disabled={busy || !title.trim()}
							data-testid="bitrix-task-submit"
							class="btn btn-primary btn-lg min-w-0 flex-[2]"
						>
							{#if busy}
								<svg class="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.22-8.56" /></svg>
								<span class="min-w-0 truncate">{hasImage ? t('bitrix.form.creatingWithImage') : t('bitrix.form.creating')}</span>
							{:else if formError?.retry}
								{t('bitrix.form.retry')}
							{:else}
								{t('bitrix.form.submit')}
							{/if}
						</button>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}
```

Tab-порядок по DOM совпадает с заметкой 17: закрыть → название → описание → группа → срок → важная → (ссылка в настройки, если есть ошибка) → отмена → создать. Глиф календаря — `svg` без `tabindex`, отдельной остановки Tab не добавляет. Enter в названии, группе и сроке отправляет форму нативно; на пустом названии кнопка `disabled`, поэтому неявной отправки тоже нет.

Поле срока: `.input-lg` задаёт `px-[18px]` в слое `components`, утилита `pr-11` из слоя `utilities` её перебивает, а вариант `supports-[-moz-appearance:none]:pr-[18px]` сортируется после базовой утилиты и в Firefox возвращает 18px. Индикатор Chromium (24×24, `right-3.5`, центр в 26–27px от правого края) накрывает глиф 16px (`right-[18px]`, центр в 26px), поэтому клик по глифу попадает в индикатор и открывает пикер. Все произвольные варианты проверены компиляцией Tailwind 4.1.18: `&::-webkit-calendar-picker-indicator { position: absolute; … opacity: 0% }` и `@supports (-moz-appearance:none) { display: none }`.

- [ ] **Step 10: Смонтировать модалку в `Board.svelte`**

Было (строка 4):

```ts
	import Summary from './Summary.svelte';
```

Стало:

```ts
	import Summary from './Summary.svelte';
	import BitrixTaskModal from './BitrixTaskModal.svelte';
```

В самый конец файла, после закрывающего `</div>` мобильного композера, дописать:

```svelte

<!-- Преформа задачи Битрикс24: одна на доску, открывается из карточки и из Итогов -->
<BitrixTaskModal />
```

- [ ] **Step 11: `Card.svelte`: кнопка, подсказки, бейдж**

Импорты. Было:

```ts
	import VoteButtons from './VoteButtons.svelte';
	import CommentList from './CommentList.svelte';
```

Стало:

```ts
	import VoteButtons from './VoteButtons.svelte';
	import CommentList from './CommentList.svelte';
	import TaskBadge from './TaskBadge.svelte';
```

Было:

```ts
	import { dndStore } from '$lib/stores/dnd.svelte.js';
```

Стало:

```ts
	import { dndStore } from '$lib/stores/dnd.svelte.js';
	import { bitrixTaskStore } from '$lib/stores/bitrix-task.svelte.js';
```

После строки `let commentCount = $derived(boardStore.getCardComments(card.id).length);` добавить:

```ts

	let task = $derived(
		card.bitrixTaskId && card.bitrixTaskUrl ? { id: card.bitrixTaskId, url: card.bitrixTaskUrl } : null
	);
	// «В задачу» видит создатель доски или пространства, только при подключённом Битрикс24
	// и пока у карточки нет задачи (boardStore.bitrix приходит только им)
	let canCreateTask = $derived(boardStore.isCreator && !!boardStore.bitrix && !card.bitrixTaskId);
```

Группа иконок. Было:

```svelte
			<!-- Действия всегда видны, без появления по ховеру. Кнопки 28px вылезают
			     на 6px за паддинг карточки, чтобы глифы стояли вровень с первой строкой -->
			<div class="-mr-1.5 -mt-1.5 flex shrink-0 gap-0.5">
				<button
					onclick={() => (moveOpen = !moveOpen)}
					class="btn-icon btn-icon-sm {moveOpen ? 'bg-surface-hover text-text-primary' : ''}"
```

Стало:

```svelte
			<!-- Действия всегда видны, без появления по ховеру. Кнопки 28px вылезают
			     на 6px за паддинг карточки, чтобы глифы стояли вровень с первой строкой.
			     relative — опора подсказок .icon-tip: плашка прижата к правому краю группы.
			     Верхняя группа — действия над карточкой, поэтому «В задачу» здесь, первой -->
			<div class="relative -mr-1.5 -mt-1.5 flex shrink-0 gap-0.5">
				{#if canCreateTask}
					<button
						onclick={() => bitrixTaskStore.open(card.id, 'card')}
						class="btn-icon btn-icon-sm icon-tip"
						aria-label={t('bitrix.card.create')}
						title={t('bitrix.card.create')}
						data-testid="card-task-button"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="3" y="3" width="18" height="18" rx="2"/>
							<path d="m9 12 2 2 4-4"/>
						</svg>
					</button>
				{/if}
				<button
					onclick={() => (moveOpen = !moveOpen)}
					class="btn-icon btn-icon-sm icon-tip {moveOpen ? 'bg-surface-hover text-text-primary' : ''}"
```

Было:

```svelte
					onclick={startEdit}
					class="btn-icon btn-icon-sm"
```

Стало:

```svelte
					onclick={startEdit}
					class="btn-icon btn-icon-sm icon-tip"
```

Было:

```svelte
					onclick={requestDelete}
					class="btn-icon btn-icon-sm {deleteConfirming
```

Стало:

```svelte
					onclick={requestDelete}
					class="btn-icon btn-icon-sm icon-tip {deleteConfirming
```

Ряд действий (заметки 12, 14, 16). Бейдж и автор собраны в одну пару, которая переносится целиком:
- задачи нет: пара `flex-1` (основа 0) занимает остаток первой строки и никогда не переносится, автор с `ml-auto` обрезается, как сейчас. Раскладка карточек без задачи не меняется ни на телефоне, ни на десктопе;
- задача есть, телефон (`max-md`, та же граница, что у `max-md:h-10` пилюль): `max-md:basis-full` уводит пару на вторую строку, бейдж слева, автор справа в той же строке;
- задача есть, десктоп: пара `grow` с основой по содержимому стоит в первой строке после пилюли комментариев, если влезает, иначе уходит на вторую строку целиком, автор там обрезается (`min-w-0`).

Заменить блок от комментария `<!-- Ряд действий — голоса, комментарии и автор, всегда видны.` до закрывающего `</div>` перед `<CommentList cardId={card.id} expanded={commentsOpen} />` (строки 188–211) на:

```svelte
	<!-- Ряд действий — голоса, комментарии, задача и автор, всегда видны.
	     Счётчик комментариев — нейтральная заливка: это состояние, а не действие,
	     терракота остаётся кнопкам и таймеру. На телефоне пилюли выше ради тача.
	     flex-wrap нужен только паре «бейдж + автор»: она переносится целиком -->
	<div class="mt-3 flex flex-wrap items-center gap-2">
		<VoteButtons cardId={card.id} />
		<button
			onclick={() => (commentsOpen = !commentsOpen)}
			aria-expanded={commentsOpen}
			aria-label={commentCount > 0 ? t('comment.count', { n: commentCount }) : t('comment.add')}
			class="pill max-md:h-10 {commentCount > 0
				? 'pill-neutral hover:opacity-85'
				: 'font-semibold text-text-muted hover:bg-surface-hover hover:text-text-secondary'}"
		>
			{#key commentCount}
				<span class="flex items-center gap-1.5 {commentCount > 0 ? 'badge-pop' : ''}">
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
					{#if commentCount > 0}{commentCount}{:else}{t('comment.add')}{/if}
				</span>
			{/key}
		</button>
		<!-- Пара «бейдж + автор» (заметка 14). Без задачи — остаток строки (basis 0): автор
		     обрезается, а не переносится. С задачей на телефоне пара всегда на второй строке,
		     на десктопе — только если не влезла. Бейдж видят все и независимо от пространства:
		     он живёт на карточке. У карточек анализа автора нет, бейдж стоит последним -->
		{#if task || card.authorName}
			<div class="flex min-w-0 items-center gap-2 {task ? 'grow max-md:basis-full' : 'flex-1'}">
				{#if task}
					<TaskBadge {task} />
				{/if}
				{#if card.authorName}
					<span class="ml-auto min-w-0 truncate text-[13px] text-text-muted">{card.authorName}</span>
				{/if}
			</div>
		{/if}
	</div>
```

- [ ] **Step 12: `SummaryRow.svelte`: D1 и D2**

Импорты. Было:

```ts
	import FocusTimer from './FocusTimer.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
```

Стало:

```ts
	import FocusTimer from './FocusTimer.svelte';
	import TaskBadge from './TaskBadge.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { bitrixTaskStore } from '$lib/stores/bitrix-task.svelte.js';
```

После строки `let scoreLabel = $derived(dislikes > 0 ? ... );` добавить:

```ts

	let task = $derived(
		card.bitrixTaskId && card.bitrixTaskUrl ? { id: card.bitrixTaskId, url: card.bitrixTaskUrl } : null
	);
```

D1, обычная строка. Было:

```svelte
			{#if !focused}
				{#if card.authorName}
					<span class="max-w-28 shrink-0 truncate text-[13px] text-text-muted">{card.authorName}</span>
				{/if}
				{@render commentPill()}
			{/if}
```

Стало:

```svelte
			{#if !focused}
				<!-- При нехватке места первым уступает автор: у него нет shrink-0 -->
				{#if card.authorName}
					<span class="min-w-0 max-w-28 truncate text-[13px] text-text-muted">{card.authorName}</span>
				{/if}
				{#if task}
					<TaskBadge {task} size="sm" />
				{/if}
				{@render commentPill()}
			{/if}
```

D2, ряд управления. Было:

```svelte
		{#if focused}
			<div class="mt-3 flex items-center gap-2 border-t border-border pt-2.5">
```

Стало:

```svelte
		{#if focused}
			<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
```

Было:

```svelte
						<button onclick={onStop} class="btn btn-primary btn-sm">
							{t('focus.stop')}
						</button>
					{/if}
				{/if}
				<span class="ml-auto flex">{@render commentPill()}</span>
```

Стало:

```svelte
						<button onclick={onStop} class="btn btn-primary btn-sm">
							{t('focus.stop')}
						</button>
					{/if}
					<!-- «В задачу» открывает преформу, обсуждение и FocusTimer идут дальше.
					     «Далее →» остаётся единственной терракотой -->
					{#if boardStore.bitrix && !card.bitrixTaskId}
						<button
							onclick={() => bitrixTaskStore.open(card.id, 'summary')}
							class="btn btn-secondary btn-sm pointer-events-auto"
							data-testid="summary-task-button"
						>
							<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 12 2 2 4-4" /></svg>
							{t('bitrix.summary.create')}
						</button>
					{/if}
				{/if}
				<!-- После создания на том же месте бейдж 32, у всех участников -->
				{#if task}
					<TaskBadge {task} />
				{/if}
				<span class="ml-auto flex">{@render commentPill()}</span>
```

- [ ] **Step 13: `Header.svelte`: пункт меню**

Было:

```svelte
								<button onclick={startRename} class="dropdown-item">
									<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
									{t('board.rename')}
								</button>
```

Стало:

```svelte
								<button onclick={startRename} class="dropdown-item">
									<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
									{t('board.rename')}
								</button>
								{#if boardStore.bitrixOffer && spaceSlug}
									<!-- Подключить может только создатель пространства: ?bitrix=1 открывает панель и ставит фокус в поле -->
									<a
										href="/spaces/{spaceSlug}?bitrix=1"
										onclick={() => (menuOpen = false)}
										class="dropdown-item"
										data-testid="menu-bitrix-connect"
									>
										<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
										{t('bitrix.menu.connect')}
									</a>
								{/if}
```

Пункт стоит внутри существующего `{#if boardStore.isCreator}`: `bitrixOffer` приходит только создателю пространства, а он всегда `isCreator`.

- [ ] **Step 14: Проверка типов, сборка, все юнит-тесты**

Run: `npm run check`
Expected: `svelte-check` без новых ошибок и предупреждений относительно состояния до задачи. Особенно проверить, что нет `a11y_*` по новым файлам (оверлей закрыт теми же `svelte-ignore`, что в `NewBoardModal`) и нет ошибок типов у `buildTaskDraft(...)`, `boardStore.setTask`, `toastStore.push({ action: { external: true } })`.

Run: `npm run build`
Expected: сборка проходит; в CSS есть правила `.icon-tip::after`, `::-webkit-calendar-picker-indicator` (с `opacity: 0%`) и `@supports (-moz-appearance:none)`. Проверка: `grep -l "webkit-calendar-picker-indicator" build/client/_app/immutable/assets/*.css` находит файл.

Run: `npm test`
Expected: все тесты зелёные, включая `src/lib/bitrix-task-result.test.ts` и `src/lib/i18n/dictionaries.test.ts`.

Svelte-компоненты юнит-тестами не покрываются. Их поведение проверяют e2e задачи 11 в `e2e/bitrix.spec.ts`:
- тест 3: `card-task-button` у создателя и его нет у гостя, бейдж у гостя без перезагрузки, поля формы (в том числе `deadline` через `fill`) доходят до мока;
- тест 4: кнопки после создания больше нет, `task-badge` с `target="_blank"`;
- тест 5: индикатор картинки и тост «картинка не прикреплена» в `disk_fail`;
- тест 6: `invalid_webhook` показывает `error-box` со ссылкой «Space settings →»;
- тест 7: `summary-task-button` в обсуждаемой строке;
- тест 9: кнопка на доске-анализе;
- тест 12: `menu-bitrix-connect`;
- тест 13: проверка группы через 400 мс;
- тест 14: бейдж без кнопки и пункта меню после удаления пространства.

Раскладку ряда действий на телефоне и глиф календаря e2e не проверяет. Проверить руками в `npm run dev` (Chromium, DevTools, ширина 375px): у карточки с задачей бейдж и автор на второй строке, у карточки без задачи автор в первой строке, как раньше; в преформе справа в поле срока серый глиф 16px, клик по нему открывает нативный пикер.

- [ ] **Step 15: Commit**

```bash
git add src/lib/bitrix-task-result.ts src/lib/bitrix-task-result.test.ts src/lib/components/TaskBadge.svelte src/lib/components/BitrixTaskModal.svelte src/lib/components/Board.svelte src/lib/components/Card.svelte src/lib/components/SummaryRow.svelte src/lib/components/Header.svelte src/app.css src/lib/i18n/en.json src/lib/i18n/ru.json
git commit -m "Битрикс24 на доске: кнопка «В задачу», преформа, бейдж задачи и пункт меню

Преформа одна на доску: черновик считается при открытии, отправка через
use:enhance без update(), реакции на ответ — чистая таблица с тестами.
Бейдж-ссылка на карточке и в Итогах, кнопка в обсуждаемой строке,
подсказки у всех иконок карточки.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: E2E — мок портала Битрикс24 и сценарии 1–15

Цель: сквозная проверка интеграции против мока, который отвечает как живой портал: старый REST и REST 3.0, ссылка на задачу с группой, тег ставится только старым REST, файл прикрепляется по ID объекта Диска. Плюс проброс `ENCRYPTION_KEY` в `docker-compose.yml` и описание флагов в `.env.example`.

Задача ничего не меняет в `src/`. Если сценарий падает из-за приложения, чините код задач 1–10 по спеке. Проверки в тесте не ослабляйте.

**Files:**
- Create: `e2e/mock-bitrix.mjs` — мок портала на порту 4779
- Create: `e2e/fixtures/card.png` — PNG 16×16, создаётся командой `node -e`
- Create: `e2e/bitrix.spec.ts` — сценарии 01–15
- Modify: `e2e/helpers.ts`:
  - `createBoardInSpace` (строки 65–75) теперь возвращает `{ slug, adminUrl }`;
  - в конец файла добавляются `BITRIX_MOCK`, `BITRIX_WEBHOOK`, `CARD_PNG`, `addCardWithImage`, `openBitrixPanel`, `connectBitrix`, `openCardTaskModal`.
- Modify: `e2e/analysis.spec.ts` — строки 44, 47, 294: деструктуризация `slug`.
- Modify: `e2e/export-api.spec.ts` — строка 29: деструктуризация `slug`.
- Modify: `playwright.config.ts`:
  - третий `webServer` для мока;
  - в `env` приложения `BITRIX_ALLOW_HTTP` и `ADDRESS_HEADER`;
  - `use.extraHTTPHeaders`.
- Modify: `docker-compose.yml` — строка после `ORIGIN` (строка 9).
- Modify: `.env.example` — комментарий к `ENCRYPTION_KEY` (строка 4) и секция Битрикс24 в конце файла.
- Modify: `.gitignore` — исключение `!e2e/fixtures/*.png` после `!static/og.png`, потому что `*.png` игнорируется.
- Test: `e2e/bitrix.spec.ts`.

**Interfaces:**
- Consumes (задачи 1–10, строго по контракту):
  - **data-testid:** `bitrix-panel`, `bitrix-panel-toggle` (с `aria-expanded` по заметке 1 макета), `card-task-button`, `summary-task-button`, `menu-bitrix-connect`, `task-badge` (`<a target="_blank" rel="noopener">`), `bitrix-task-form`, `bitrix-task-submit`.
  - **Поля форм:**
    - панель: `input[name="webhook"]`, `input[name="groupId"]`;
    - преформа: `title`, `description` (textarea), `groupId`, `deadline`, `important` (через подпись `ToggleSwitch`), скрытые `cardId` и `source`.
  - **Экшен `/[slug]?/createTask`:** `fail(status, { bitrixError, … })`, в том числе `forbidden` 403 и `exists` 409.
  - **`GET /[slug]/bitrix/group?id=N`:** отвечает `{ name }`, `{ notFound: true }` или `403 { bitrixError: 'forbidden' }`.
  - **Экспорт:** у карточки поле `task: { id, url } | null` (задача 1).
  - **Доступ:** `canViewSpace` сравнивает cookie `retro_space_{slug}` с `spaces.access_token` (задача 2).
  - **`BITRIX_ALLOW_HTTP=1`:** разрешает `http://localhost:{port}` в `parseWebhookUrl` (задачи 3 и 5).
  - **Лимитеры:** ключ — `getClientAddress()` (задачи 5 и 8).
  - **Бейдж результата панели** («Connected» / «Disconnected» / «Saved», ключи `bitrix.panel.*`): по заметке 8 макета и по образцу бейджа пароля страница рисует его у H1 пространства, то есть вне корня `data-testid="bitrix-panel"`. Поэтому сценарий 10 ищет его на странице, а не внутри панели.
  - **Тексты UI — английские:** `initStorage` ставит локаль `en`. Используются `bitrix.panel.connect` «Connect», `bitrix.panel.disconnect` «Disconnect», `bitrix.panel.disconnectConfirm` «Click again to disconnect», `bitrix.panel.disconnected` «Disconnected», `bitrix.panel.lastError`, `bitrix.error.invalid_url` (EN из заметки 9), `bitrix.error.invalid_webhook_panel`, `bitrix.error.scope`, `bitrix.error.invalid_webhook`, `bitrix.error.limit`, `bitrix.form.imageNote`, `bitrix.form.responsible`, `bitrix.form.groupNotFound`, `bitrix.form.important`, `bitrix.form.creatingWithImage`, `bitrix.form.retry`, `bitrix.form.settingsLink`, `bitrix.menu.connect`, `bitrix.card.task`, `bitrix.toast.created`, `bitrix.toast.createdNoImage`, `bitrix.toast.open`, `bitrix.draft.fromRetro`, `bitrix.draft.fromAnalysis`.
- Produces (для задачи 12 и будущих e2e):
  - `e2e/helpers.ts`:
    - `createBoardInSpace(page, spaceSlug, title): Promise<{ slug: string; adminUrl: string }>`;
    - `BITRIX_MOCK = 'http://localhost:4779'`;
    - `BITRIX_WEBHOOK = 'http://localhost:4779/rest/1/testcode/'`;
    - `CARD_PNG = 'e2e/fixtures/card.png'`;
    - `addCardWithImage(page, columnName, text, fixture = CARD_PNG): Promise<void>`;
    - `openBitrixPanel(page): Promise<Locator>`;
    - `connectBitrix(page, spaceUrl, opts?: { group?: number }): Promise<Locator>`;
    - `openCardTaskModal(page, cardText): Promise<Locator>`.
  - Мок `e2e/mock-bitrix.mjs`:
    - `POST /__mode { mode: 'ok'|'invalid_webhook'|'scope'|'disk_fail'|'error'|'delay', delayMs? }`;
    - `GET /__calls` → `[{ method /* в нижнем регистре */, api, userId, body, headers, status, response }]`;
    - `POST /__reset`;
    - `GET /health`.
  - `playwright.config.ts`: в env приложения `BITRIX_ALLOW_HTTP: '1'` и `ADDRESS_HEADER: 'x-forwarded-for'`; `use.extraHTTPHeaders['x-forwarded-for']`.

---

- [ ] **Step 1: Проверить, что задачи 1–10 на месте и в разметке есть крючки, на которые опирается e2e**

Run:
```bash
cd /Volumes/projects/pet/retro
grep -rln 'data-testid="bitrix-panel-toggle"' src/routes src/lib/components
grep -rn 'aria-expanded' $(grep -rln 'data-testid="bitrix-panel-toggle"' src/routes src/lib/components)
grep -n 'name="webhook"\|name="groupId"' src/lib/components/BitrixPanel.svelte
grep -n 'name="cardId"\|name="source"\|name="title"\|name="description"\|name="groupId"\|name="deadline"\|role="alert"\|data-testid="bitrix-task-submit"' src/lib/components/BitrixTaskModal.svelte
grep -rn 'data-testid="card-task-button"\|data-testid="summary-task-button"\|data-testid="menu-bitrix-connect"\|data-testid="task-badge"' src/lib/components
grep -rn 'BITRIX_ALLOW_HTTP' src
grep -n '"bitrix.error.invalid_url"\|"bitrix.form.groupNotFound"\|"bitrix.toast.createdNoImage"' src/lib/i18n/en.json
```
Expected: каждая команда находит хотя бы одно совпадение. В `en.json` текст `bitrix.error.invalid_url` содержит «look like an inbound webhook». Если крючка нет, это пропуск задачи 6, 8 или 10: добавьте его по спеке (заметки 1, 17 и 26, контракт «Компоненты») и только потом продолжайте.

- [ ] **Step 2: Разрешить PNG-фикстуры в git**

В `.gitignore` сейчас:
```
*.png
!static/og.png
.playwright-mcp/
```
Станет:
```
*.png
!static/og.png
!e2e/fixtures/*.png
.playwright-mcp/
```

- [ ] **Step 3: Создать фикстуру `e2e/fixtures/card.png`**

Run:
```bash
cd /Volumes/projects/pet/retro
mkdir -p e2e/fixtures && node -e "require('fs').writeFileSync('e2e/fixtures/card.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGM4EWVDEmIY1TCqYfhqAACeeF4QkI5G2gAAAABJRU5ErkJggg==', 'base64'))"
node -e "require('sharp')(require('fs').readFileSync('e2e/fixtures/card.png')).metadata().then((m) => console.log(m.format, m.width, m.height))"
git status --short e2e/fixtures
```
Expected: `png 16 16`, затем `?? e2e/fixtures/`. Файл не игнорируется.

- [ ] **Step 4: Написать мок портала `e2e/mock-bitrix.mjs`**

```js
// Мок портала Битрикс24 для e2e: третий webServer в playwright.config.ts (порт 4779).
// Приложение ходит сюда по вебхуку http://localhost:4779/rest/1/testcode/ — его пропускает флаг BITRIX_ALLOW_HTTP=1.
// Ответы повторяют живой портал (bitrix24.team, 17.09.2026 — см. спеку):
//  - старый REST: POST /rest/{userId}/{code}/{method}; ошибка ядра — строка error + error_description;
//  - REST 3.0:    POST /rest/api/{userId}/{code}/{method}; ошибка — объект error { code, message, validation? }.
// Служебные адреса: POST /__mode, GET /__calls, POST /__reset, GET /health.
import { createServer } from 'http';

const PORT = Number(process.env.MOCK_PORT || 4779);
const CODE = 'testcode';
const OWNER = { NAME: 'Ivan', LAST_NAME: 'Petrov', TIME_ZONE: 'Europe/Kaliningrad' };
const STORAGE_ID = 11;
const ROOT_OBJECT_ID = 31;
// Рабочие группы портала. groupId не из списка в tasks.task.add — 403 ACCESSDENIEDEXCEPTION, как у живого портала
const GROUPS = { 42: 'Платформа' };
const MODES = ['ok', 'invalid_webhook', 'scope', 'disk_fail', 'error', 'delay'];
// Эти методы портал обслуживает только одним транспортом. Вызов не тем адресом — ERROR_METHOD_NOT_FOUND,
// чтобы e2e ловил перепутанный транспорт
const V3_ONLY = new Set(['tasks.task.add', 'tasks.task.field.list', 'tasks.task.file.attach']);
const LEGACY_ONLY = new Set(['profile', 'sonet_group.get', 'disk.storage.getlist', 'disk.storage.uploadfile']);
const PORTAL_PATH = /^\/rest\/(api\/)?(\d+)\/([^/]+)\/([^/]+)$/;
const DEADLINE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
const VALIDATION = 'BITRIX_REST_V3_EXCEPTION_VALIDATION_DTOVALIDATIONEXCEPTION';

let mode = 'ok';
let delayMs = 0;
let calls = [];
const tasks = new Map(); // id задачи → { tags }
const diskObjects = new Map(); // ID объекта Диска → NAME
const idempotent = new Map(); // Idempotency-Key → { body, payload }
// Счётчики не сбрасываются: id задач и файлов уникальны на весь прогон.
// ID объекта Диска и FILE_ID живут в разных диапазонах — перепутать их незаметно нельзя
let taskSeq = 1000;
let objectSeq = 500;
let fileSeq = 9000;

function reset() {
	mode = 'ok';
	delayMs = 0;
	calls = [];
	tasks.clear();
	diskObjects.clear();
	idempotent.clear();
}

function readBody(req) {
	return new Promise((resolve) => {
		let data = '';
		req.on('data', (chunk) => (data += chunk));
		req.on('end', () => resolve(data));
	});
}

function send(res, status, payload, headers = {}) {
	res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers }).end(JSON.stringify(payload));
}

// Блок time как у портала; date_finish несёт смещение сервера портала (Калининград, +02:00)
function portalTime() {
	const now = Date.now();
	const local = new Date(now + 2 * 3_600_000).toISOString().slice(0, 19) + '+02:00';
	return {
		start: now / 1000,
		finish: now / 1000,
		duration: 0.01,
		processing: 0.005,
		date_start: local,
		date_finish: local,
		operating_reset_at: Math.floor(now / 1000) + 600,
		operating: 0
	};
}

const ok = (result, extra = {}) => ({ status: 200, payload: { result, ...extra, time: portalTime() } });
const coreError = (status, code, description) => ({ status, payload: { error: code, error_description: description } });
const v3Error = (status, code, message, validation) => ({
	status,
	payload: { error: validation ? { code, message, validation } : { code, message } }
});
const insufficientScope = () =>
	coreError(401, 'insufficient_scope', 'The request requires higher privileges than provided by the webhook token');

function portal(method, api, userId, body, headers) {
	if (mode === 'invalid_webhook') return coreError(401, 'INVALID_CREDENTIALS', 'Invalid request credentials');
	if (mode === 'error') return coreError(503, 'QUERY_LIMIT_EXCEEDED', 'Too many requests');
	if ((api && LEGACY_ONLY.has(method)) || (!api && V3_ONLY.has(method))) {
		return coreError(404, 'ERROR_METHOD_NOT_FOUND', 'Method not found!');
	}
	if (mode === 'scope' && method.startsWith('tasks.')) return insufficientScope();
	if (mode === 'disk_fail' && method.startsWith('disk.')) return insufficientScope();

	switch (method) {
		case 'profile':
			return ok({
				ID: String(userId),
				ADMIN: true,
				NAME: OWNER.NAME,
				LAST_NAME: OWNER.LAST_NAME,
				PERSONAL_GENDER: '',
				TIME_ZONE: OWNER.TIME_ZONE
			});

		case 'tasks.task.field.list':
			return ok({
				items: ['id', 'title', 'description', 'creatorId', 'responsibleId', 'groupId', 'deadline', 'priority', 'tags'].map(
					(name) => ({ name })
				)
			});

		case 'sonet_group.get': {
			const filter = body.FILTER ?? body.filter ?? {};
			const ids = filter.ID === undefined ? Object.keys(GROUPS) : [].concat(filter.ID).map(String);
			const items = ids
				.filter((id) => GROUPS[id])
				.map((id) => ({ ID: id, SITE_ID: 's1', NAME: GROUPS[id], DESCRIPTION: '', ACTIVE: 'Y', VISIBLE: 'Y', OPENED: 'N', PROJECT: 'N' }));
			return ok(items, { total: items.length });
		}

		case 'tasks.task.add': {
			const key = headers['idempotency-key'];
			const raw = JSON.stringify(body);
			// Повтор с тем же ключом: тот же ответ без дубля; тот же ключ с другим телом — 422
			if (key && idempotent.has(key)) {
				const saved = idempotent.get(key);
				if (saved.body !== raw) {
					return v3Error(422, 'BITRIX_REST_V3_EXCEPTION_IDEMPOTENCYKEYMISMATCHEXCEPTION', 'Ключ идемпотентности уже использован с другим запросом');
				}
				return { status: 200, payload: saved.payload, headers: { 'Idempotent-Replayed': 'true' } };
			}
			const fields = body.fields;
			if (!fields || typeof fields !== 'object') {
				return v3Error(400, VALIDATION, 'Ошибка валидации', [{ field: 'fields', message: 'Обязательное поле' }]);
			}
			// Живой портал: «Поле "tags" не доступно к заполнению» — тег ставится только старым REST
			if ('tags' in fields) return v3Error(400, VALIDATION, 'Поле "tags" не доступно к заполнению');
			if (typeof fields.title !== 'string' || !fields.title.trim()) {
				return v3Error(400, VALIDATION, 'Ошибка валидации', [{ field: 'title', message: 'Обязательное поле' }]);
			}
			if (fields.deadline != null && !DEADLINE_RE.test(String(fields.deadline))) {
				return v3Error(400, VALIDATION, 'Ошибка валидации', [{ field: 'deadline', message: 'Нужна дата ISO 8601 со смещением' }]);
			}
			if (fields.priority != null && !['high', 'average', 'low'].includes(fields.priority)) {
				return v3Error(400, VALIDATION, 'Ошибка валидации', [{ field: 'priority', message: 'Недопустимое значение' }]);
			}
			const groupId = fields.groupId == null ? 0 : Number(fields.groupId);
			if (fields.groupId != null && !GROUPS[groupId]) {
				return v3Error(403, 'BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION', 'Доступ запрещен');
			}
			const id = ++taskSeq;
			const link = groupId
				? `/workgroups/group/${groupId}/tasks/task/view/${id}/`
				: `/company/personal/user/${userId}/tasks/task/view/${id}/`;
			tasks.set(id, { tags: [] });
			const { payload } = ok({
				item: {
					id,
					title: fields.title,
					description: fields.description ?? '',
					creatorId: Number(fields.creatorId ?? userId),
					responsibleId: Number(fields.responsibleId ?? userId),
					groupId,
					deadline: fields.deadline ?? null,
					priority: fields.priority ?? 'average',
					link
				}
			});
			if (key) idempotent.set(key, { body: raw, payload });
			return { status: 200, payload };
		}

		case 'tasks.task.update': {
			// REST 3.0 тег не принимает ни в add, ни в update; e2e зовёт update только ради тега
			if (api) return v3Error(400, VALIDATION, 'Поле "tags" не доступно к заполнению');
			const task = tasks.get(Number(body.taskId));
			if (!task) return coreError(400, 'ERROR_CORE', 'Задача не найдена или у вас нет прав на её просмотр');
			if (body.fields?.TAGS !== undefined) task.tags = [].concat(body.fields.TAGS).map(String);
			return ok({ task: { id: String(body.taskId), tags: task.tags } });
		}

		case 'disk.storage.getlist': {
			const filter = body.filter ?? body.FILTER ?? {};
			const own = String(filter.ENTITY_TYPE) === 'user' && String(filter.ENTITY_ID) === String(userId);
			const items = own
				? [{
						ID: String(STORAGE_ID),
						NAME: `${OWNER.NAME} ${OWNER.LAST_NAME}`,
						CODE: null,
						MODULE_ID: 'disk',
						ENTITY_TYPE: 'user',
						ENTITY_ID: String(userId),
						ROOT_OBJECT_ID: String(ROOT_OBJECT_ID)
					}]
				: [];
			return ok(items, { total: items.length });
		}

		case 'disk.storage.uploadfile': {
			if (String(body.id) !== String(STORAGE_ID)) return coreError(400, 'ERROR_NOT_FOUND', `Could not find entity with id '${body.id}'`);
			const name = body.data?.NAME;
			if (typeof name !== 'string' || !name) return coreError(400, 'DISK_BASE_SERVICE_22001', 'Error: required parameter NAME');
			const content = body.fileContent;
			const bytes = Array.isArray(content) && typeof content[1] === 'string' ? Buffer.from(content[1], 'base64') : Buffer.alloc(0);
			if (bytes.length === 0) return coreError(400, 'ERROR_ARGUMENT', 'Invalid value of parameter fileContent');
			const taken = new Set(diskObjects.values());
			let finalName = name;
			if (taken.has(name)) {
				if (body.generateUniqueName !== true) {
					return coreError(400, 'DISK_OBJ_22000', 'Не удалось сохранить файл: объект с таким именем уже существует');
				}
				const dot = name.lastIndexOf('.');
				for (let n = 1; taken.has(finalName); n++) {
					finalName = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
				}
			}
			const ID = ++objectSeq;
			const FILE_ID = ++fileSeq;
			diskObjects.set(ID, finalName);
			const stamp = portalTime().date_finish;
			return ok({
				ID,
				NAME: finalName,
				CODE: null,
				STORAGE_ID,
				TYPE: 'file',
				PARENT_ID: ROOT_OBJECT_ID,
				DELETED_TYPE: 0,
				GLOBAL_CONTENT_VERSION: 1,
				FILE_ID,
				SIZE: bytes.length,
				CREATE_TIME: stamp,
				UPDATE_TIME: stamp,
				DELETE_TIME: null,
				CREATED_BY: userId,
				UPDATED_BY: userId,
				DELETED_BY: 0,
				DOWNLOAD_URL: `http://localhost:${PORT}/disk/download/${ID}/`,
				DETAIL_URL: `http://localhost:${PORT}/company/personal/user/${userId}/disk/file/${encodeURIComponent(finalName)}`
			});
		}

		case 'tasks.task.file.attach': {
			if (!tasks.has(Number(body.taskId))) return v3Error(404, 'BITRIX_REST_V3_EXCEPTION_ENTITYNOTFOUNDEXCEPTION', 'Задача не найдена');
			const ids = Array.isArray(body.fileIds) ? body.fileIds : [];
			// Только ID объекта Диска; FILE_ID из uploadFile — «Не удалось найти файл», как у живого портала
			if (ids.length === 0 || ids.some((id) => !diskObjects.has(Number(id)))) {
				return v3Error(400, VALIDATION, 'Не удалось найти файл');
			}
			return ok({ result: true });
		}

		default:
			return coreError(404, 'ERROR_METHOD_NOT_FOUND', 'Method not found!');
	}
}

createServer(async (req, res) => {
	try {
		const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
		if (req.method === 'GET' && pathname === '/health') {
			res.writeHead(200).end('ok');
			return;
		}
		if (req.method === 'POST' && pathname === '/__mode') {
			let body = {};
			try {
				body = JSON.parse((await readBody(req)) || '{}');
			} catch {
				body = {};
			}
			if (!MODES.includes(body.mode)) {
				send(res, 400, { error: `mode must be one of: ${MODES.join(', ')}` });
				return;
			}
			mode = body.mode;
			delayMs = Number(body.delayMs) || (mode === 'delay' ? 2000 : 0);
			send(res, 200, { mode, delayMs });
			return;
		}
		if (req.method === 'GET' && pathname === '/__calls') {
			send(res, 200, calls);
			return;
		}
		if (req.method === 'POST' && pathname === '/__reset') {
			reset();
			send(res, 200, { ok: true });
			return;
		}

		const match = pathname.match(PORTAL_PATH);
		if (!match) {
			res.writeHead(404).end();
			return;
		}
		const [, apiSegment, userIdRaw, code, methodRaw] = match;
		const raw = await readBody(req);
		let body = {};
		let badJson = false;
		if (raw) {
			try {
				body = JSON.parse(raw);
			} catch {
				badJson = true;
			}
		}
		// Вызов записываем до проверок: тесту видны и отклонённые запросы
		const call = {
			method: methodRaw.toLowerCase(),
			api: Boolean(apiSegment),
			userId: Number(userIdRaw),
			body: badJson ? raw : body,
			headers: req.headers,
			status: 0,
			response: null
		};
		calls.push(call);
		if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));

		let out;
		if (req.method !== 'POST') out = coreError(405, 'INVALID_REQUEST', 'POST expected');
		else if (!String(req.headers['content-type'] ?? '').includes('application/json') || badJson || !body || typeof body !== 'object') {
			out = coreError(400, 'INVALID_REQUEST', 'JSON body expected');
		} else if (code !== CODE) out = coreError(401, 'INVALID_CREDENTIALS', 'Invalid request credentials');
		else out = portal(call.method, call.api, call.userId, body, req.headers);

		call.status = out.status;
		call.response = out.payload;
		send(res, out.status, out.payload, out.headers);
	} catch (err) {
		res.writeHead(500, { 'content-type': 'text/plain' }).end(String(err));
	}
}).listen(PORT, () => console.log(`mock bitrix24 on ${PORT}`));
```

- [ ] **Step 5: Проверить мок вручную**

Run:
```bash
cd /Volumes/projects/pet/retro
(MOCK_PORT=47990 node e2e/mock-bitrix.mjs &) ; until curl -sf localhost:47990/health >/dev/null; do :; done
B=localhost:47990; J='content-type: application/json'
curl -s -X POST $B/rest/1/testcode/profile -H "$J" -d '{}'; echo
curl -s -X POST $B/rest/api/1/testcode/tasks.task.add -H "$J" -H 'Idempotency-Key: k1' -d '{"fields":{"title":"T","groupId":42}}'; echo
curl -si -X POST $B/rest/api/1/testcode/tasks.task.add -H "$J" -H 'Idempotency-Key: k1' -d '{"fields":{"title":"T","groupId":42}}' | grep -i replayed
curl -s -X POST $B/rest/api/1/testcode/tasks.task.add -H "$J" -d '{"fields":{"title":"T","groupId":7}}'; echo
curl -s -X POST $B/rest/1/testcode/disk.storage.uploadFile -H "$J" -d '{"id":11,"data":{"NAME":"a.webp"},"fileContent":["a.webp","UklGRg=="],"generateUniqueName":true}' | head -c 120; echo
curl -s -X POST $B/rest/api/1/testcode/tasks.task.file.attach -H "$J" -d '{"taskId":1001,"fileIds":[9001]}'; echo
curl -s -X POST $B/rest/1/wrong/profile -H "$J" -d '{}'; echo
curl -s $B/__calls | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).map((c) => `${c.method} api=${c.api} ${c.status}`).join("\n"))'
pkill -f "node e2e/mock-bitrix.mjs"
```
Expected:
- `profile` → `{"result":{"ID":"1",…,"TIME_ZONE":"Europe/Kaliningrad"},"time":{…"date_finish":"…+02:00"…}}`;
- первый `add` → `{"result":{"item":{"id":1001,…,"groupId":42,…,"link":"/workgroups/group/42/tasks/task/view/1001/"}},…}`;
- повтор с тем же ключом → заголовок `Idempotent-Replayed: true`;
- `groupId` 7 → `{"error":{"code":"BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION","message":"Доступ запрещен"}}`;
- `uploadFile` → `{"result":{"ID":501,"NAME":"a.webp",…,"FILE_ID":9001,…`;
- `attach` с FILE_ID → `{"error":{"code":"BITRIX_REST_V3_EXCEPTION_VALIDATION_DTOVALIDATIONEXCEPTION","message":"Не удалось найти файл"}}`;
- чужой код → `{"error":"INVALID_CREDENTIALS","error_description":"Invalid request credentials"}`.

Список вызовов:
```
profile api=false 200
tasks.task.add api=true 200
tasks.task.add api=true 200
tasks.task.add api=true 403
disk.storage.uploadfile api=false 200
tasks.task.file.attach api=true 400
profile api=false 401
```

- [ ] **Step 6: Подключить мок в `playwright.config.ts`**

Замените файл целиком. Отличия от текущего:
- `use.extraHTTPHeaders`;
- второй элемент `webServer`;
- `BITRIX_ALLOW_HTTP` и `ADDRESS_HEADER` в `env` приложения.

`ENCRYPTION_KEY` уже задан (64 hex).

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 4777;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: 'e2e',
	// Один воркер: общий сервер + realtime-тесты чувствительны к параллельной нагрузке
	workers: 1,
	fullyParallel: false,
	timeout: 30_000,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: BASE_URL,
		trace: 'retain-on-failure',
		// Сервер берёт IP клиента из этого заголовка (ADDRESS_HEADER ниже). Лимиты Битрикс24 считаются
		// по IP, и bitrix.spec.ts выдаёт каждому тесту свой адрес; остальным тестам хватает одного
		extraHTTPHeaders: { 'x-forwarded-for': '127.0.0.1' }
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			// Мок DeepSeek: приложение ходит в него через DEEPSEEK_API_BASE
			command: 'node e2e/mock-deepseek.mjs',
			url: 'http://localhost:4778/health',
			reuseExistingServer: !process.env.CI,
			timeout: 15_000
		},
		{
			// Мок портала Битрикс24: тесты подключают вебхук http://localhost:4779/rest/1/testcode/
			command: 'node e2e/mock-bitrix.mjs',
			url: 'http://localhost:4779/health',
			reuseExistingServer: !process.env.CI,
			timeout: 15_000
		},
		{
			// Сборка происходит ДО запуска тестов (npm run test:e2e / отдельный шаг CI),
			// чтобы таймаут webServer не зависел от времени сборки
			command: 'node migrate.js && node server.js',
			url: `${BASE_URL}/health`,
			reuseExistingServer: !process.env.CI,
			timeout: 60_000,
			env: {
				DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://retro:retro@localhost:5433/retro',
				PORT: String(PORT),
				ORIGIN: BASE_URL,
				BODY_SIZE_LIMIT: '20971520',
				// Как в проде: карточки шифруются, и доска-анализ (пишет SvelteKit) должна читаться сокет-сервером.
				// Без ключа подключение Битрикс24 недоступно (encryptionEnabled)
				ENCRYPTION_KEY: '0123456789abcdef'.repeat(4),
				DEEPSEEK_API_KEY: 'test-key',
				DEEPSEEK_API_BASE: 'http://localhost:4778',
				// Вебхук мока — http://localhost: без флага parseWebhookUrl его отклонит. Только для e2e
				BITRIX_ALLOW_HTTP: '1',
				// adapter-node: getClientAddress() читает x-forwarded-for. Без заголовка маршрут с лимитом
				// упадёт, поэтому заголовок выставлен всем контекстам через use.extraHTTPHeaders
				ADDRESS_HEADER: 'x-forwarded-for'
			}
		}
	]
});
```

- [ ] **Step 7: `createBoardInSpace` возвращает `{ slug, adminUrl }`**

В `e2e/helpers.ts` (строки 65–75) было:
```ts
// Создаёт доску внутри пространства через модалку «New board». Остаётся на странице доски.
export async function createBoardInSpace(page: Page, spaceSlug: string, title: string): Promise<string> {
	await page.goto(`/spaces/${spaceSlug}`);
	await page.getByRole('button', { name: 'New board' }).first().click();
	const modal = page.getByRole('dialog');
	await modal.getByPlaceholder('Board title (optional)').fill(title);
	await modal.locator('button[type="submit"]').click();
	await page.waitForURL(BOARD_URL);
	await dismissToast(page);
	return new URL(page.url()).pathname.slice(1);
}
```
Станет:
```ts
// Создаёт доску внутри пространства через модалку «New board». Остаётся на странице доски.
// adminUrl — ссылка с ?admin=: по ней другой браузер становится создателем доски (но не пространства).
// Токен берём из cookie retro_creator_{slug}: ?admin страница сразу убирает из адреса.
export async function createBoardInSpace(page: Page, spaceSlug: string, title: string): Promise<{ slug: string; adminUrl: string }> {
	await page.goto(`/spaces/${spaceSlug}`);
	await page.getByRole('button', { name: 'New board' }).first().click();
	const modal = page.getByRole('dialog');
	await modal.getByPlaceholder('Board title (optional)').fill(title);
	await modal.locator('button[type="submit"]').click();
	await page.waitForURL(BOARD_URL);
	await dismissToast(page);
	const { origin, pathname } = new URL(page.url());
	const slug = pathname.slice(1);
	const creator = (await page.context().cookies(origin)).find((c) => c.name === `retro_creator_${slug}`);
	if (!creator) throw new Error(`createBoardInSpace: нет cookie создателя для доски ${slug}`);
	return { slug, adminUrl: `${origin}/${slug}?admin=${creator.value}` };
}
```

Вызывающие, которые используют результат. Остальные вызовы значение не читают и не меняются.
- `e2e/export-api.spec.ts:29` было `const b1 = await createBoardInSpace(page, space.slug, 'Sprint 1');`, станет `const { slug: b1 } = await createBoardInSpace(page, space.slug, 'Sprint 1');`.
- `e2e/analysis.spec.ts:44` было `const b1 = await createBoardInSpace(page, space.slug, 'Sprint 1');`, станет `const { slug: b1 } = await createBoardInSpace(page, space.slug, 'Sprint 1');`.
- `e2e/analysis.spec.ts:47` было `const b2 = await createBoardInSpace(page, space.slug, 'Sprint 2');`, станет `const { slug: b2 } = await createBoardInSpace(page, space.slug, 'Sprint 2');`.
- `e2e/analysis.spec.ts:294` было `const boardSlug = await createBoardInSpace(pageA, space.slug, 'Sprint 1');`, станет `const { slug: boardSlug } = await createBoardInSpace(pageA, space.slug, 'Sprint 1');`.

Run: `grep -rn "= await createBoardInSpace" e2e`
Expected: 4 строки, все вида `const { slug: … } = await createBoardInSpace(`.

- [ ] **Step 8: Хелперы Битрикс24 в конец `e2e/helpers.ts`**

Импорты уже есть: `expect`, `Locator`, `Page`.

Про поле файла в `addCardWithImage`. Скрытый `input[type=file]` в колонке не один. Его рисует `CardForm` (`CardForm.svelte:120`, вне условий), а ещё `CommentForm` у каждой карточки: `CommentList` свёрнут через `collapsible`, но в DOM он есть всегда (`Card.svelte:213`, `CommentForm.svelte:100`). В `Column.svelte` блок `CardForm` (строки 83–85) стоит раньше списка карточек (строка 87), поэтому `.first()` берёт поле формы колонки. Без `.first()` второй вызов в сценарии 05 падает по strict mode.

```ts
// ── Битрикс24 ───────────────────────────────────────────────────────────────

// Мок портала (e2e/mock-bitrix.mjs) и вебхук, который тест «вставляет» как пользователь.
// http и localhost сервер принимает только с BITRIX_ALLOW_HTTP=1 (playwright.config.ts)
export const BITRIX_MOCK = 'http://localhost:4779';
export const BITRIX_WEBHOOK = `${BITRIX_MOCK}/rest/1/testcode/`;

// PNG 16×16. Сервер пережимает его в WebP, поэтому на Диск уходит retro-{cardId}.webp
export const CARD_PNG = 'e2e/fixtures/card.png';

// Карточка с текстом и картинкой через форму колонки. У CardForm.submit() нет защиты
// от раннего Enter: без ожидания /api/upload карточка ушла бы без картинки
export async function addCardWithImage(page: Page, columnName: string, text: string, fixture: string = CARD_PNG) {
	const col = column(page, columnName);
	await col.getByRole('button', { name: /Add a card/ }).click();
	const textarea = col.getByPlaceholder("What's on your mind?");
	await textarea.fill(text);
	const upload = page.waitForResponse(
		(r) => new URL(r.url()).pathname === '/api/upload' && r.request().method() === 'POST'
	);
	// Скрытых input[type=file] в колонке несколько: у CardForm и у свёрнутой CommentForm каждой карточки.
	// CardForm стоит в колонке раньше списка карточек, поэтому его поле первое
	await col.locator('input[type="file"]').first().setInputFiles(fixture);
	const response = await upload;
	expect(response.status()).toBe(200);
	await response.finished();
	// Спиннер превью гаснет в finally, уже после записи imageId
	await expect(col.locator('form svg.animate-spin')).toHaveCount(0);
	await expect(col.getByText('Upload failed')).toHaveCount(0);
	await textarea.press('Enter');
	await expect(page.locator('.card-board', { hasText: text }).first().locator('img[src^="/api/image/"]')).toBeVisible();
}

// Раскрывает панель Битрикс24 на странице пространства. Триггер есть уже в SSR-разметке,
// клик до гидрации может потеряться — повторяем, пока aria-expanded не станет true
export async function openBitrixPanel(page: Page): Promise<Locator> {
	const toggle = page.getByTestId('bitrix-panel-toggle');
	await expect(async () => {
		if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 });
	}).toPass({ timeout: 10_000 });
	return page.getByTestId('bitrix-panel');
}

// Подключает мок-портал в панели пространства и ждёт состояние «подключено».
// spaceUrl — обычный адрес /spaces/{slug} (без ?bitrix=1 и ?admin=): панель закрыта
export async function connectBitrix(page: Page, spaceUrl: string, opts: { group?: number } = {}): Promise<Locator> {
	await page.goto(spaceUrl);
	const panel = await openBitrixPanel(page);
	await panel.locator('input[name="webhook"]').fill(BITRIX_WEBHOOK);
	if (opts.group !== undefined) await panel.locator('input[name="groupId"]').fill(String(opts.group));
	await panel.getByRole('button', { name: 'Connect', exact: true }).click();
	// Имя владельца вебхука из profile мока видно только в состоянии «подключено»
	await expect(panel.getByText('Ivan Petrov')).toBeVisible({ timeout: 10_000 });
	return panel;
}

// Открывает преформу задачи с карточки доски и возвращает её форму
export async function openCardTaskModal(page: Page, cardText: string): Promise<Locator> {
	const card = page.locator('.card-board', { hasText: cardText });
	await card.getByTestId('card-task-button').click();
	const form = page.getByTestId('bitrix-task-form');
	await expect(form).toBeVisible();
	return form;
}
```

- [ ] **Step 9: Собрать приложение и проверить, что старые e2e не сломались**

Если от прошлых запусков остались серверы, их надо погасить: `reuseExistingServer` иначе подхватит старый процесс без новых env.

Run:
```bash
cd /Volumes/projects/pet/retro
lsof -t -i :4777 -i :4778 -i :4779 | xargs kill 2>/dev/null || true
docker compose up -d db
npm run build
npx playwright test e2e/analysis.spec.ts e2e/export-api.spec.ts
```
Expected: сборка без ошибок; `16 passed`, `0 failed`.

- [ ] **Step 10: Каркас `e2e/bitrix.spec.ts` и сценарии 01–04**

```ts
import { test, expect, type Browser, type Page } from '@playwright/test';
import {
	addCard,
	addCardWithImage,
	BITRIX_MOCK,
	BITRIX_WEBHOOK,
	connectBitrix,
	createBoardInSpace,
	createLockedSpace,
	createSpace,
	dismissToast,
	initStorage,
	openBitrixPanel,
	openCardTaskModal
} from './helpers';

// Интеграция с Битрикс24 против мока портала (e2e/mock-bitrix.mjs).
// Строки UI — английские: initStorage выставляет локаль en, как во всех e2e.

test.describe.configure({ timeout: 60_000 });

const APP = 'http://localhost:4777';
const DEEPSEEK = 'http://localhost:4778';
const GROUP_NOT_FOUND = 'Group not found — check the id or clear the field';

type Mode = 'ok' | 'invalid_webhook' | 'scope' | 'disk_fail' | 'error' | 'delay';

interface MockCall {
	method: string; // в нижнем регистре: disk.storage.uploadfile
	api: boolean; // true — адрес REST 3.0 (/rest/api/…)
	userId: number;
	body: any;
	headers: Record<string, string>;
	status: number;
	response: any;
}

// Лимиты Битрикс24 считаются по IP (5 подключений в минуту), а весь прогон идёт с одного адреса.
// Сервер e2e берёт IP из x-forwarded-for (ADDRESS_HEADER в playwright.config.ts) — у каждого теста свой
let clientIp = '10.0.0.1';
const octet = () => 1 + Math.floor(Math.random() * 254);

test.beforeEach(async ({ context, request }) => {
	clientIp = `10.${octet()}.${octet()}.${octet()}`;
	await context.setExtraHTTPHeaders({ 'x-forwarded-for': clientIp });
	await request.post(`${BITRIX_MOCK}/__reset`);
	await request.post(`${BITRIX_MOCK}/__mode`, { data: { mode: 'ok' } });
});

// Второй и третий браузер в том же тесте — с тем же адресом, что и основной
function newContext(browser: Browser) {
	return browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': clientIp } });
}

async function setBitrixMode(page: Page, mode: Mode, delayMs = 0) {
	const res = await page.request.post(`${BITRIX_MOCK}/__mode`, { data: { mode, delayMs } });
	expect(res.ok()).toBe(true);
}

async function bitrixCalls(page: Page): Promise<MockCall[]> {
	return (await page.request.get(`${BITRIX_MOCK}/__calls`)).json();
}

const callsOf = (calls: MockCall[], method: string) => calls.filter((c) => c.method === method);
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Ссылка на задачу: хост портала + link из ответа tasks.task.add
const taskUrl = (link: string) => new RegExp(`^https?://localhost(:\\d+)?${escapeRegExp(link)}$`);
const toasts = (page: Page) => page.getByTestId('toast');
const cardOnBoard = (page: Page, text: string) => page.locator('.card-board', { hasText: text });

// Прямой POST в экшен так, как его шлёт use:enhance. Без accept: application/json SvelteKit
// отрендерит страницу вместо ActionResult, без Origin — вернёт CSRF-403 до обработчика
async function postAction(page: Page, path: string, form: Record<string, string>) {
	const res = await page.request.post(path, {
		form,
		headers: { accept: 'application/json', 'x-sveltekit-action': 'true', origin: APP },
		maxRedirects: 0
	});
	return { httpStatus: res.status(), result: await res.json() };
}

// data у failure/success сериализована devalue: плоский массив, корень — первый элемент.
// Разворачиваем только верхний уровень — тестам нужен bitrixError
function actionData(result: { data?: string }): Record<string, unknown> {
	const flat = JSON.parse(result.data ?? '[{}]') as unknown[];
	const root = (flat[0] ?? {}) as Record<string, number>;
	return Object.fromEntries(Object.entries(root).map(([key, index]) => [key, flat[index]]));
}

// Пространство с подключённым мок-порталом и доска в нём; страница остаётся на доске
async function seedBoard(page: Page, name: string, opts: { group?: number } = {}) {
	const space = await createSpace(page, name);
	await connectBitrix(page, `/spaces/${space.slug}`, opts);
	const board = await createBoardInSpace(page, space.slug, 'Sprint 1');
	return { space, board };
}

// Создаёт задачу из карточки через преформу без правок полей
async function createTaskFrom(page: Page, cardText: string) {
	const form = await openCardTaskModal(page, cardText);
	const cardId = await form.locator('input[name="cardId"]').inputValue();
	await page.getByTestId('bitrix-task-submit').click();
	await expect(form).toHaveCount(0, { timeout: 15_000 });
	const add = callsOf(await bitrixCalls(page), 'tasks.task.add').filter((c) => c.status === 200).at(-1);
	expect(add).toBeTruthy();
	const item = add!.response.result.item as { id: number; link: string };
	await expect(toasts(page).getByText(`Task #${item.id} created`, { exact: true })).toBeVisible();
	return { cardId, id: item.id, link: item.link, add: add! };
}

test('01. подключение с группой: портал, владелец и название группы переживают перезагрузку, гость панели не видит', async ({ page, browser }) => {
	const space = await createSpace(page, 'Bitrix connect');
	const panel = await connectBitrix(page, `/spaces/${space.slug}`, { group: 42 });
	await expect(panel.getByText(/localhost/).first()).toBeVisible();
	await expect(panel.getByText(/Платформа/)).toBeVisible();

	// Порядок строгий: profile → пробный вызов REST 3.0 → название группы
	const calls = await bitrixCalls(page);
	expect(calls.map((c) => [c.method, c.api, c.status])).toEqual([
		['profile', false, 200],
		['tasks.task.field.list', true, 200],
		['sonet_group.get', false, 200]
	]);
	for (const call of calls) expect(call.headers['content-type']).toContain('application/json');
	expect(String((calls[2].body.FILTER ?? calls[2].body.filter).ID)).toBe('42');

	await page.reload();
	await openBitrixPanel(page);
	await expect(panel.getByText('Ivan Petrov')).toBeVisible();
	await expect(panel.getByText(/Платформа/)).toBeVisible();
	// Код вебхука не попадает ни в разметку, ни в page data
	expect(await page.content()).not.toContain('testcode');

	const guestCtx = await newContext(browser);
	const guest = await guestCtx.newPage();
	await initStorage(guest);
	await guest.goto(`/spaces/${space.slug}`);
	await expect(guest.getByRole('heading', { level: 1, name: 'Bitrix connect' })).toBeVisible();
	await expect(guest.getByTestId('bitrix-panel-toggle')).toHaveCount(0);
	await expect(guest.getByTestId('bitrix-panel')).toHaveCount(0);
	expect(await guest.content()).not.toContain('Ivan Petrov');
	await guestCtx.close();
});

test('02. неверный вебхук: ошибка в панели, введённое не стирается, после перезагрузки — «не подключено»', async ({ page }) => {
	const space = await createSpace(page, 'Bitrix wrong');
	await page.goto(`/spaces/${space.slug}`);
	const panel = await openBitrixPanel(page);
	const webhook = panel.locator('input[name="webhook"]');
	const connect = panel.getByRole('button', { name: 'Connect', exact: true });

	// Чужой код: портал отвечает INVALID_CREDENTIALS
	const wrong = `${BITRIX_MOCK}/rest/1/wrongcode/`;
	await webhook.fill(wrong);
	await connect.click();
	await expect(panel.getByText(/The portal rejected the webhook/)).toBeVisible({ timeout: 10_000 });
	await expect(webhook).toHaveValue(wrong);
	expect((await bitrixCalls(page)).map((c) => [c.method, c.status])).toEqual([['profile', 401]]);

	// Приватный адрес отсекается до любого исходящего запроса
	await webhook.fill('https://192.168.1.10/rest/1/testcode/');
	await connect.click();
	await expect(panel.getByText(/look like an inbound webhook/)).toBeVisible();
	expect(await bitrixCalls(page)).toHaveLength(1);

	// Нет права «Задачи»: profile проходит, пробный вызов REST 3.0 — нет
	await setBitrixMode(page, 'scope');
	await webhook.fill(BITRIX_WEBHOOK);
	await connect.click();
	await expect(panel.getByText(/lacks the Tasks permission/)).toBeVisible({ timeout: 10_000 });
	expect(callsOf(await bitrixCalls(page), 'tasks.task.field.list').map((c) => c.status)).toEqual([401]);

	await page.reload();
	await openBitrixPanel(page);
	await expect(panel.locator('input[name="webhook"]')).toBeVisible();
	await expect(panel.getByText('Ivan Petrov')).toHaveCount(0);
});

test('03. доска в пространстве: задачу создаёт ведущий, гость видит бейдж без перезагрузки, мок получает поля и тег', async ({ browser }) => {
	const ctxA = await newContext(browser);
	const ctxB = await newContext(browser);
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const space = await createSpace(pageA, 'Bitrix team');
	await connectBitrix(pageA, `/spaces/${space.slug}`, { group: 42 });
	const board = await createBoardInSpace(pageA, space.slug, 'Sprint 7');
	await addCard(pageA, 'To Improve', 'Split the deploy job');

	await initStorage(pageB);
	await pageB.goto(`/${board.slug}`);
	const cardB = cardOnBoard(pageB, 'Split the deploy job');
	await expect(cardB).toBeVisible();
	await expect(cardB.getByTestId('card-task-button')).toHaveCount(0);
	await expect(pageB.getByTestId('task-badge')).toHaveCount(0);

	const form = await openCardTaskModal(pageA, 'Split the deploy job');
	const dialog = pageA.getByRole('dialog');
	await expect(form.locator('input[name="title"]')).toBeFocused();
	await expect(form.locator('input[name="title"]')).toHaveValue('Split the deploy job');
	await expect(form.locator('textarea[name="description"]')).toHaveValue(/From retro .Sprint 7. . column .To Improve./);
	await expect(form.locator('textarea[name="description"]')).toHaveValue(new RegExp(escapeRegExp(`${APP}/${board.slug}`)));
	await expect(form.locator('input[name="groupId"]')).toHaveValue('42');
	await expect(dialog.getByText('Платформа')).toBeVisible();
	await expect(form.locator('input[name="deadline"]')).toHaveValue('');
	await expect(form.locator('input[name="source"]')).toHaveValue('card');
	await expect(dialog.getByText('Responsible and creator: Ivan Petrov')).toBeVisible();
	await expect(dialog.getByText('The card image will be attached')).toHaveCount(0);

	// Срок в будущем году: min у поля — сегодня. Калининград — UTC+2 круглый год
	const deadline = `${new Date().getFullYear() + 1}-03-15`;
	await form.locator('input[name="deadline"]').fill(deadline);
	await dialog.getByText('Important task').click();
	await pageA.getByTestId('bitrix-task-submit').click();
	await expect(form).toHaveCount(0, { timeout: 15_000 });

	const calls = await bitrixCalls(pageA);
	const [add] = callsOf(calls, 'tasks.task.add');
	const taskId = add.response.result.item.id as number;
	const created = toasts(pageA).filter({ hasText: `Task #${taskId} created` });
	await expect(created.getByText(`Task #${taskId} created`, { exact: true })).toBeVisible();
	await expect(created.getByRole('link', { name: /Open/ })).toHaveAttribute('target', '_blank');

	const cardA = cardOnBoard(pageA, 'Split the deploy job');
	await expect(cardA.getByTestId('task-badge')).toContainText(`Task #${taskId}`);
	await expect(cardA.getByTestId('card-task-button')).toHaveCount(0);
	// Гость узнаёт о задаче по сокету
	await expect(cardB.getByTestId('task-badge')).toContainText(`Task #${taskId}`, { timeout: 10_000 });

	expect(add.api).toBe(true);
	expect(add.status).toBe(200);
	expect(add.headers['content-type']).toContain('application/json');
	expect(add.headers['idempotency-key']).toMatch(/^[0-9a-f]{64}$/);
	expect(add.body.fields).toMatchObject({
		title: 'Split the deploy job',
		responsibleId: 1,
		creatorId: 1,
		groupId: 42,
		priority: 'high',
		deadline: `${deadline}T19:00:00+02:00`
	});
	expect(add.body.fields.description).toContain('Split the deploy job');
	expect(add.body.fields.description).toContain(`${APP}/${board.slug}`);
	expect(add.body.fields).not.toHaveProperty('tags');
	expect(add.response.result.item.link).toBe(`/workgroups/group/42/tasks/task/view/${taskId}/`);

	// Тег — отдельным вызовом старого REST сразу после создания
	const methods = calls.map((c) => c.method);
	const [update] = callsOf(calls, 'tasks.task.update');
	expect(update.api).toBe(false);
	expect(Number(update.body.taskId)).toBe(taskId);
	expect(update.body.fields).toEqual({ TAGS: ['retro'] });
	expect(methods.indexOf('tasks.task.update')).toBeGreaterThan(methods.indexOf('tasks.task.add'));
	expect(methods.some((m) => m.startsWith('disk.'))).toBe(false);

	await ctxA.close();
	await ctxB.close();
});

test('04. у карточки с задачей кнопки нет, бейдж ведёт на ссылку портала в новой вкладке, повтор отвечает exists', async ({ page }) => {
	const { board } = await seedBoard(page, 'Bitrix badge', { group: 42 });
	await addCard(page, 'Went Well', 'Pairing on reviews helped');
	const task = await createTaskFrom(page, 'Pairing on reviews helped');
	expect(task.link).toBe(`/workgroups/group/42/tasks/task/view/${task.id}/`);
	// Не «важная» — priority не передаётся; срок пустой
	expect(task.add.body.fields).not.toHaveProperty('priority');
	expect(task.add.body.fields.deadline ?? null).toBeNull();

	await page.reload();
	const card = cardOnBoard(page, 'Pairing on reviews helped');
	const badge = card.getByTestId('task-badge');
	await expect(badge).toContainText(`Task #${task.id}`);
	await expect(card.getByTestId('card-task-button')).toHaveCount(0);
	await expect(badge).toHaveAttribute('target', '_blank');
	await expect(badge).toHaveAttribute('rel', /noopener/);
	await expect(badge).toHaveAttribute('href', taskUrl(task.link));
	const href = (await badge.getAttribute('href'))!;

	// Та же ссылка у компактного бейджа в «Итогах»
	const row = page.getByTestId('summary-card').filter({ hasText: 'Pairing on reviews helped' });
	await expect(row.getByTestId('task-badge')).toHaveAttribute('href', href);

	// Повторный запрос с той же карточки: exists, в портал никто не ходит
	const again = await postAction(page, `/${board.slug}?/createTask`, {
		cardId: task.cardId,
		title: 'Pairing on reviews helped',
		description: '',
		groupId: '',
		deadline: '',
		source: 'card'
	});
	expect(again.result).toMatchObject({ type: 'failure', status: 409 });
	expect(actionData(again.result).bitrixError).toBe('exists');
	expect(callsOf(await bitrixCalls(page), 'tasks.task.add')).toHaveLength(1);
});
```

- [ ] **Step 11: Запустить сценарии 01–04**

Run: `cd /Volumes/projects/pet/retro && npx playwright test e2e/bitrix.spec.ts -g " 0[1-4]\. "`
Expected: `4 passed`.

Если тест упал, откройте trace: `npx playwright show-trace test-results/<папка>/trace.zip`. Ошибку ищите в коде задач 3–10: транспорт, поля `tasks.task.add`, крючки разметки.

- [ ] **Step 12: Сценарии 05–08 — дописать в конец `e2e/bitrix.spec.ts`**

```ts
test('05. карточка с картинкой: файл уходит на личный Диск и прикрепляется по ID объекта; без права «Диск» задача создаётся с предупреждением', async ({ page }) => {
	await seedBoard(page, 'Bitrix image');
	await addCardWithImage(page, 'Went Well', 'Whiteboard after the retro');

	const form = await openCardTaskModal(page, 'Whiteboard after the retro');
	await expect(page.getByRole('dialog').getByText('The card image will be attached')).toBeVisible();
	const cardId = await form.locator('input[name="cardId"]').inputValue();

	// Медленный портал: видно состояние отправки с картинкой
	await setBitrixMode(page, 'delay', 700);
	const submit = page.getByTestId('bitrix-task-submit');
	await submit.click();
	await expect(submit).toContainText(/Creating and attaching the image/);
	await expect(submit).toBeDisabled();
	await expect(form).toHaveCount(0, { timeout: 20_000 });
	await setBitrixMode(page, 'ok');

	const calls = await bitrixCalls(page);
	const methods = calls.map((c) => c.method);
	expect(methods.slice(methods.indexOf('tasks.task.add'))).toEqual([
		'tasks.task.add',
		'tasks.task.update',
		'disk.storage.getlist',
		'disk.storage.uploadfile',
		'tasks.task.file.attach'
	]);
	const [add] = callsOf(calls, 'tasks.task.add');
	const taskId = add.response.result.item.id as number;
	await expect(toasts(page).getByText(`Task #${taskId} created`, { exact: true })).toBeVisible();

	const [storage] = callsOf(calls, 'disk.storage.getlist');
	const storageFilter = storage.body.filter ?? storage.body.FILTER;
	expect(storage.api).toBe(false);
	expect(storageFilter.ENTITY_TYPE).toBe('user');
	expect(String(storageFilter.ENTITY_ID)).toBe('1');

	const [upload] = callsOf(calls, 'disk.storage.uploadfile');
	expect(upload.api).toBe(false);
	expect(upload.status).toBe(200);
	expect(String(upload.body.id)).toBe('11');
	expect(upload.body.data.NAME).toBe(`retro-${cardId}.webp`);
	expect(upload.body.fileContent[0]).toBe(`retro-${cardId}.webp`);
	expect(upload.body.fileContent[1]).toMatch(/^[A-Za-z0-9+/]+=*$/);
	expect(upload.body.generateUniqueName).toBe(true);
	const { ID, FILE_ID } = upload.response.result as { ID: number; FILE_ID: number };
	expect(ID).not.toBe(FILE_ID);

	const [attach] = callsOf(calls, 'tasks.task.file.attach');
	expect(attach.api).toBe(true);
	expect(attach.status).toBe(200);
	expect(Number(attach.body.taskId)).toBe(taskId);
	expect((attach.body.fileIds as unknown[]).map(Number)).toEqual([ID]);

	// Нет права «Диск»: задача создана, картинка не прикреплена, тост предупреждает.
	// В колонке уже есть карточка, поэтому полей файла в ней несколько — addCardWithImage берёт первое
	await addCardWithImage(page, 'Went Well', 'Sticky notes photo');
	await setBitrixMode(page, 'disk_fail');
	await openCardTaskModal(page, 'Sticky notes photo');
	await page.getByTestId('bitrix-task-submit').click();
	await expect(page.getByTestId('bitrix-task-form')).toHaveCount(0, { timeout: 15_000 });
	const second = callsOf(await bitrixCalls(page), 'tasks.task.add').at(-1)!;
	const secondId = second.response.result.item.id as number;
	await expect(toasts(page).getByText(`Task #${secondId} created, the image was not attached`, { exact: true })).toBeVisible();
	await expect(cardOnBoard(page, 'Sticky notes photo').getByTestId('task-badge')).toContainText(`Task #${secondId}`);
	expect(callsOf(await bitrixCalls(page), 'tasks.task.file.attach')).toHaveLength(1);
});

test('06. вебхук отозван при создании: ошибка в преформе со ссылкой в настройки, панель предупреждает и принимает новый вебхук', async ({ page }) => {
	const { space } = await seedBoard(page, 'Bitrix revoked');
	await addCard(page, 'Went Well', 'Retro notes live in the wiki');
	const form = await openCardTaskModal(page, 'Retro notes live in the wiki');
	await setBitrixMode(page, 'invalid_webhook');
	await page.getByTestId('bitrix-task-submit').click();

	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('alert')).toContainText('The webhook no longer works', { timeout: 15_000 });
	// Форма остаётся с тем, что ввели
	await expect(form.locator('input[name="title"]')).toHaveValue('Retro notes live in the wiki');
	await expect(cardOnBoard(page, 'Retro notes live in the wiki').getByTestId('task-badge')).toHaveCount(0);
	const settings = dialog.getByRole('link', { name: /Space settings/ });
	await expect(settings).toHaveAttribute('href', new RegExp(`/spaces/${space.slug}\\?bitrix=1$`));

	await setBitrixMode(page, 'ok');
	await Promise.all([page.waitForURL((u) => u.pathname === `/spaces/${space.slug}`), settings.click()]);
	await expect(page.getByTestId('bitrix-panel-toggle')).toHaveAttribute('aria-expanded', 'true');
	const panel = page.getByTestId('bitrix-panel');
	await expect(panel.getByText(/The webhook stopped working/)).toBeVisible();

	await panel.locator('input[name="webhook"]').fill(BITRIX_WEBHOOK);
	await panel.getByRole('button', { name: 'Connect', exact: true }).click();
	await expect(panel.getByText('Ivan Petrov')).toBeVisible({ timeout: 10_000 });
	await expect(panel.getByText(/The webhook stopped working/)).toHaveCount(0);
});

test('07. задача из сфокусированной строки «Итогов»: повтор после перегрузки портала тем же ключом, обсуждение не прерывается', async ({ page }) => {
	await seedBoard(page, 'Bitrix summary');
	await addCard(page, 'Went Well', 'Demo day went great');
	await addCard(page, "Didn't Go Well", 'Staging was down twice');

	await page.getByRole('button', { name: 'Discuss', exact: true }).click();
	const focused = page.locator('[data-testid="summary-card"][data-focused="true"]');
	await expect(focused).toContainText('Demo day went great');
	await expect(page.getByTestId('summary-task-button')).toHaveCount(1);

	await focused.getByTestId('summary-task-button').click();
	const form = page.getByTestId('bitrix-task-form');
	await expect(form.locator('input[name="title"]')).toHaveValue('Demo day went great');
	await expect(form.locator('input[name="source"]')).toHaveValue('summary');

	// Портал перегружен: текст, главная кнопка — «Повторить», форма на месте
	await setBitrixMode(page, 'error');
	const submit = page.getByTestId('bitrix-task-submit');
	await submit.click();
	await expect(page.getByRole('dialog').getByRole('alert')).toContainText('The portal is overloaded', { timeout: 15_000 });
	await expect(submit).toContainText('Retry');

	await setBitrixMode(page, 'ok');
	await submit.click();
	await expect(form).toHaveCount(0, { timeout: 15_000 });

	const adds = callsOf(await bitrixCalls(page), 'tasks.task.add');
	expect(adds.map((c) => c.status)).toEqual([503, 200]);
	expect(adds[1].headers['idempotency-key']).toBe(adds[0].headers['idempotency-key']);
	const taskId = adds[1].response.result.item.id as number;

	await expect(focused).toContainText('Demo day went great');
	await expect(focused.getByTestId('task-badge')).toContainText(`#${taskId}`);
	await expect(focused.getByTestId('summary-task-button')).toHaveCount(0);
	await expect(cardOnBoard(page, 'Demo day went great').getByTestId('task-badge')).toContainText(`Task #${taskId}`);
	await expect(page.getByRole('button', { name: /Next/ })).toBeVisible();
});

test('08. экспорт JSON и Markdown несёт задачу карточки', async ({ page }) => {
	const { board } = await seedBoard(page, 'Bitrix export');
	await addCard(page, 'Went Well', 'Keep the release checklist');
	await addCard(page, 'Went Well', 'Coffee machine is broken');
	const task = await createTaskFrom(page, 'Keep the release checklist');

	const res = await page.request.get(`/api/v1/boards/${board.slug}/export.json`);
	expect(res.status()).toBe(200);
	const data = await res.json();
	const cards = data.columns.went_well as { content: string; task: { id: number; url: string } | null }[];
	const withTask = cards.find((c) => c.content === 'Keep the release checklist')!;
	expect(withTask.task).toEqual({ id: task.id, url: expect.stringMatching(taskUrl(task.link)) });
	expect(cards.find((c) => c.content === 'Coffee machine is broken')!.task).toBeNull();
	expect(JSON.stringify(data)).not.toContain('testcode');

	const md = await (await page.request.get(`/api/v1/boards/${board.slug}/export.md`)).text();
	expect(md).toContain(withTask.task!.url);

	// Экспорт из меню доски собирается той же функцией
	const legacy = await (await page.request.get(`/${board.slug}/export`)).json();
	const legacyCard = legacy.columns.went_well.find((c: { content: string }) => c.content === 'Keep the release checklist');
	expect(legacyCard.task.id).toBe(task.id);
});
```

- [ ] **Step 13: Запустить сценарии 05–08**

Run: `cd /Volumes/projects/pet/retro && npx playwright test e2e/bitrix.spec.ts -g " 0[5-8]\. "`
Expected: `4 passed`.

- [ ] **Step 14: Сценарии 09–12 — дописать в конец `e2e/bitrix.spec.ts`**

```ts
test('09. доска-анализ: у создателя пространства есть «В задачу», описание начинается с AI-анализа', async ({ page }) => {
	await page.request.post(`${DEEPSEEK}/__mode`, { data: { mode: 'ok', delayMs: 0 } });
	const space = await createSpace(page, 'Bitrix analysis');
	await connectBitrix(page, `/spaces/${space.slug}`);
	await createBoardInSpace(page, space.slug, 'Sprint 1');
	await addCard(page, "Didn't Go Well", 'flaky tests');

	await page.goto(`/spaces/${space.slug}`);
	await page.getByTestId('analyze-button').click();
	const ready = page.locator('[data-testid="toast"][data-kind="success"]').filter({ hasText: 'AI analysis is ready' });
	await expect(ready).toBeVisible({ timeout: 20_000 });
	const path = await ready.getByRole('link', { name: /Open/ }).getAttribute('href');
	await page.goto(path!);
	await expect(page).toHaveTitle(/^Space analysis for/);

	const form = await openCardTaskModal(page, 'Deploys keep going smoothly');
	await expect(form.locator('input[name="groupId"]')).toHaveValue('');
	await expect(form.locator('textarea[name="description"]')).toHaveValue(/From AI analysis .Space analysis for/);
	await page.getByTestId('bitrix-task-submit').click();
	await expect(form).toHaveCount(0, { timeout: 15_000 });

	const add = callsOf(await bitrixCalls(page), 'tasks.task.add').at(-1)!;
	const taskId = add.response.result.item.id as number;
	expect(add.body.fields.description).toMatch(/From AI analysis .Space analysis for/);
	expect(add.body.fields.groupId ?? null).toBeNull();
	expect(add.response.result.item.link).toBe(`/company/personal/user/1/tasks/task/view/${taskId}/`);
	await expect(cardOnBoard(page, 'Deploys keep going smoothly').getByTestId('task-badge')).toContainText(`Task #${taskId}`);
});

test('10. отключение: после перезагрузки кнопок нет, бейджи остаются, меню снова предлагает подключить', async ({ page }) => {
	const { space, board } = await seedBoard(page, 'Bitrix disconnect');
	await addCard(page, 'Went Well', 'Ship the changelog');
	await addCard(page, 'Went Well', 'Rotate on-call weekly');
	const task = await createTaskFrom(page, 'Ship the changelog');

	await page.goto(`/spaces/${space.slug}`);
	const panel = await openBitrixPanel(page);
	await panel.getByRole('button', { name: 'Disconnect', exact: true }).click();
	// Подтверждение вторым кликом, без браузерного диалога
	await panel.getByRole('button', { name: 'Click again to disconnect' }).click();
	// Бейдж «Отключено» страница рисует у H1 пространства (заметка 8), вне корня панели; живёт 2,5 с
	await expect(page.getByText('Disconnected', { exact: true })).toBeVisible();
	await expect(panel.locator('input[name="webhook"]')).toBeVisible();

	await page.reload();
	await openBitrixPanel(page);
	await expect(panel.locator('input[name="webhook"]')).toBeVisible();
	await expect(panel.getByText('Ivan Petrov')).toHaveCount(0);

	await page.goto(`/${board.slug}`);
	await expect(cardOnBoard(page, 'Ship the changelog').getByTestId('task-badge')).toHaveAttribute('href', taskUrl(task.link));
	await expect(cardOnBoard(page, 'Rotate on-call weekly')).toBeVisible();
	await expect(page.getByTestId('card-task-button')).toHaveCount(0);
	await page.getByRole('button', { name: 'Menu' }).click();
	await expect(page.getByTestId('menu-bitrix-connect')).toBeVisible();
	expect(callsOf(await bitrixCalls(page), 'tasks.task.add')).toHaveLength(1);
});

test('11. закрытое пространство: создатель доски без пароля пространства не видит «В задачу» и получает forbidden, гость тоже', async ({ browser }) => {
	const ctxA = await newContext(browser);
	const ctxB = await newContext(browser);
	const ctxC = await newContext(browser);
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();
	const pageC = await ctxC.newPage();

	const space = await createLockedSpace(pageA, 'Bitrix locked', 's3cret');
	await connectBitrix(pageA, `/spaces/${space.slug}`);
	const board = await createBoardInSpace(pageA, space.slug, 'Sprint 1');
	await addCard(pageA, 'Went Well', 'Secret roadmap item');
	// id карточки — из скрытого поля преформы; саму преформу закрываем без отправки
	const formA = await openCardTaskModal(pageA, 'Secret roadmap item');
	const cardId = await formA.locator('input[name="cardId"]').inputValue();
	await pageA.keyboard.press('Escape');
	await expect(formA).toHaveCount(0);

	// B открыл admin-ссылку доски: cookie retro_creator_{slug} есть, retro_space_{slug} нет
	await initStorage(pageB);
	await pageB.goto(board.adminUrl);
	await dismissToast(pageB);
	const cardB = cardOnBoard(pageB, 'Secret roadmap item');
	await expect(cardB).toBeVisible();
	await expect(cardB.getByTestId('card-task-button')).toHaveCount(0);
	await pageB.getByRole('button', { name: 'Menu' }).click();
	await expect(pageB.getByRole('button', { name: 'Rename board' })).toBeVisible();
	await expect(pageB.getByTestId('menu-bitrix-connect')).toHaveCount(0);

	const form = { cardId, title: 'Hijacked task', description: '', groupId: '', deadline: '', source: 'card' };
	for (const p of [pageB, pageC]) {
		const denied = await postAction(p, `/${board.slug}?/createTask`, form);
		expect(denied.result).toMatchObject({ type: 'failure', status: 403 });
		expect(actionData(denied.result).bitrixError).toBe('forbidden');
		const group = await p.request.get(`/${board.slug}/bitrix/group?id=42`);
		expect(group.status()).toBe(403);
		expect(await group.json()).toEqual({ bitrixError: 'forbidden' });
	}
	const calls = await bitrixCalls(pageA);
	expect(callsOf(calls, 'tasks.task.add')).toHaveLength(0);
	expect(callsOf(calls, 'sonet_group.get')).toHaveLength(0);

	await ctxA.close();
	await ctxB.close();
	await ctxC.close();
});

test('12. пункт «Подключить Битрикс24» ведёт в открытую панель и пропадает после подключения; создатель доски его не видит', async ({ browser }) => {
	const ctxA = await newContext(browser);
	const ctxB = await newContext(browser);
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const space = await createSpace(pageA, 'Bitrix offer');

	// B создаёт свою доску в пространстве: создатель доски, но не пространства
	await initStorage(pageB);
	await createBoardInSpace(pageB, space.slug, 'Guest sprint');
	await pageB.getByRole('button', { name: 'Menu' }).click();
	await expect(pageB.getByRole('button', { name: 'Rename board' })).toBeVisible();
	await expect(pageB.getByTestId('menu-bitrix-connect')).toHaveCount(0);

	const board = await createBoardInSpace(pageA, space.slug, 'Sprint 1');
	await pageA.getByRole('button', { name: 'Menu' }).click();
	const item = pageA.getByTestId('menu-bitrix-connect');
	await expect(item).toContainText('Connect Bitrix24');
	await Promise.all([pageA.waitForURL(new RegExp(`/spaces/${space.slug}\\?bitrix=1$`)), item.click()]);

	await expect(pageA.getByTestId('bitrix-panel-toggle')).toHaveAttribute('aria-expanded', 'true');
	const panel = pageA.getByTestId('bitrix-panel');
	const webhook = panel.locator('input[name="webhook"]');
	await expect(webhook).toBeFocused();
	await webhook.fill(BITRIX_WEBHOOK);
	// Enter в поле = «Подключить»
	await webhook.press('Enter');
	await expect(panel.getByText('Ivan Petrov')).toBeVisible({ timeout: 10_000 });

	await pageA.goto(`/${board.slug}`);
	await pageA.getByRole('button', { name: 'Menu' }).click();
	await expect(pageA.getByRole('button', { name: 'Rename board' })).toBeVisible();
	await expect(pageA.getByTestId('menu-bitrix-connect')).toHaveCount(0);

	await ctxA.close();
	await ctxB.close();
});
```

- [ ] **Step 15: Запустить сценарии 09–12**

Run: `cd /Volumes/projects/pet/retro && npx playwright test e2e/bitrix.spec.ts -g " (09|1[0-2])\. "`
Expected: `4 passed`.

- [ ] **Step 16: Сценарии 13–15 — дописать в конец `e2e/bitrix.spec.ts`**

```ts
test('13. проверка группы в преформе: чужой id — «не найдена», существующий — название; портал отказывает по чужой группе', async ({ page }) => {
	// Без группы по умолчанию: название известной группы показывается без запроса, а здесь нужен запрос
	const { board } = await seedBoard(page, 'Bitrix groups');
	await addCard(page, 'Went Well', 'Move CI to the new runners');
	const form = await openCardTaskModal(page, 'Move CI to the new runners');
	const dialog = page.getByRole('dialog');
	const group = form.locator('input[name="groupId"]');
	await expect(group).toHaveValue('');

	const groupCheck = (id: string) =>
		page.waitForResponse((r) => r.url().endsWith(`/${board.slug}/bitrix/group?id=${id}`));

	let checked = groupCheck('777');
	await group.fill('777');
	expect(await (await checked).json()).toEqual({ notFound: true });
	await expect(dialog.getByText(GROUP_NOT_FOUND)).toBeVisible();

	// Отправку не блокируем: портал сам отказывает по чужой группе, форма остаётся
	const submit = page.getByTestId('bitrix-task-submit');
	await submit.click();
	await expect
		.poll(async () => callsOf(await bitrixCalls(page), 'tasks.task.add').map((c) => c.status), { timeout: 15_000 })
		.toEqual([403]);
	await expect(submit).toBeEnabled();
	await expect(form).toBeVisible();
	await expect(dialog.getByText(GROUP_NOT_FOUND)).toBeVisible();
	await expect(cardOnBoard(page, 'Move CI to the new runners').getByTestId('task-badge')).toHaveCount(0);

	checked = groupCheck('42');
	await group.fill('42');
	expect(await (await checked).json()).toEqual({ name: 'Платформа' });
	await expect(dialog.getByText('Платформа')).toBeVisible();
	await expect(dialog.getByText(GROUP_NOT_FOUND)).toHaveCount(0);

	await submit.click();
	await expect(form).toHaveCount(0, { timeout: 15_000 });
	const calls = await bitrixCalls(page);
	const adds = callsOf(calls, 'tasks.task.add');
	expect(adds.map((c) => c.status)).toEqual([403, 200]);
	expect(adds[1].body.fields.groupId).toBe(42);
	// Правка формы меняет ключ идемпотентности
	expect(adds[1].headers['idempotency-key']).not.toBe(adds[0].headers['idempotency-key']);
	const taskId = adds[1].response.result.item.id as number;
	expect(adds[1].response.result.item.link).toBe(`/workgroups/group/42/tasks/task/view/${taskId}/`);
	const checkedIds = callsOf(calls, 'sonet_group.get').map((c) => String((c.body.FILTER ?? c.body.filter).ID));
	expect(checkedIds).toEqual(expect.arrayContaining(['777', '42']));
});

test('14. пространство удалено: бейдж на доске остаётся ссылкой в новой вкладке, кнопки и пункта меню нет', async ({ page }) => {
	const { space, board } = await seedBoard(page, 'Bitrix gone');
	await addCard(page, 'Went Well', 'Archive old boards');
	await addCard(page, 'Went Well', 'Label flaky tests');
	const task = await createTaskFrom(page, 'Archive old boards');

	await page.goto(`/spaces/${space.slug}`);
	// Кнопка удаления есть в SSR-разметке: клик до гидрации повторяем, пока не появится вопрос
	const question = page.getByText('Delete space?');
	await expect(async () => {
		if (!(await question.isVisible())) await page.getByRole('button', { name: 'Delete Space' }).click();
		await expect(question).toBeVisible({ timeout: 1_000 });
	}).toPass({ timeout: 10_000 });
	await Promise.all([
		page.waitForURL((u) => u.pathname === '/'),
		page.getByRole('button', { name: 'Delete Space' }).click()
	]);

	await page.goto(`/${board.slug}`);
	const badge = cardOnBoard(page, 'Archive old boards').getByTestId('task-badge');
	await expect(badge).toHaveAttribute('target', '_blank');
	await expect(badge).toHaveAttribute('href', taskUrl(task.link));
	await expect(cardOnBoard(page, 'Label flaky tests')).toBeVisible();
	await expect(page.getByTestId('card-task-button')).toHaveCount(0);
	await page.getByRole('button', { name: 'Menu' }).click();
	await expect(page.getByRole('button', { name: 'Rename board' })).toBeVisible();
	await expect(page.getByTestId('menu-bitrix-connect')).toHaveCount(0);
});

test('15. подделанная cookie доступа не открывает закрытое пространство и не даёт создать доску', async ({ browser }) => {
	const ctxA = await newContext(browser);
	const ctxB = await newContext(browser);
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const space = await createLockedSpace(pageA, 'Bitrix forged', 's3cret');
	await initStorage(pageB);
	await ctxB.addCookies([{ name: `retro_space_${space.slug}`, value: 'x', url: APP }]);

	await pageB.goto(`/spaces/${space.slug}`);
	await expect(pageB.getByPlaceholder('Password')).toBeVisible();
	await expect(pageB.getByRole('button', { name: 'New board' })).toHaveCount(0);
	expect((await pageB.request.get(`/spaces/${space.slug}/analysis`)).status()).toBe(403);

	const created = await postAction(pageB, `/spaces/${space.slug}?/createBoard`, {
		title: 'Intruder board',
		locale: 'en',
		format: 'classic'
	});
	expect(created.result.type).not.toBe('redirect');
	const status = created.result.type === 'error' ? created.httpStatus : created.result.status;
	expect(status).toBe(403);

	await pageA.goto(`/spaces/${space.slug}`);
	await expect(pageA.getByRole('heading', { level: 1, name: 'Bitrix forged' })).toBeVisible();
	await expect(pageA.getByTestId('space-tile').filter({ hasText: 'Intruder board' })).toHaveCount(0);

	await ctxA.close();
	await ctxB.close();
});
```

- [ ] **Step 17: Запустить весь `e2e/bitrix.spec.ts`**

Run: `cd /Volumes/projects/pet/retro && npx playwright test e2e/bitrix.spec.ts`
Expected: `15 passed`. Второй прогон подряд тоже `15 passed`: у тестов разные IP, лимиты не срабатывают.

- [ ] **Step 18: `ENCRYPTION_KEY` в `docker-compose.yml`**

Было (строки 9–10):
```yaml
      ORIGIN: http://localhost:3777
      BODY_SIZE_LIMIT: "20971520"
```
Станет:
```yaml
      ORIGIN: http://localhost:3777
      ENCRYPTION_KEY: ${ENCRYPTION_KEY:-}
      BODY_SIZE_LIMIT: "20971520"
```
Run: `cd /Volumes/projects/pet/retro && docker compose config | grep -n ENCRYPTION_KEY`
Expected: одна строка `ENCRYPTION_KEY: ""`, а при экспортированном ключе — его значение.

- [ ] **Step 19: `.env.example` — комментарий к ключу и флаги Битрикс24**

Было (строки 3–4):
```
ORIGIN=http://localhost:3000
ENCRYPTION_KEY=
```
Станет:
```
ORIGIN=http://localhost:3000
# AES-256-GCM для карточек, комментариев и вебхуков Битрикс24: 64 hex-символа, сгенерировать — openssl rand -hex 32.
# Без ключа подключение Битрикс24 недоступно (панель пространства скажет «шифрование не настроено»)
ENCRYPTION_KEY=
```
В конец файла, после `DEEPSEEK_API_BASE=https://api.deepseek.com`:
```
# Битрикс24 (опционально)
# BITRIX_ALLOW_HTTP=1 — только для e2e: разрешает вебхук http://localhost:{port}/ мока портала; на проде не ставить
# BITRIX_IMAGE_MAX_BYTES=4194304 — картинка карточки крупнее (в байтах) к задаче не прикрепляется; по умолчанию 4 МБ
```

- [ ] **Step 20: Полная проверка**

Run:
```bash
cd /Volumes/projects/pet/retro
npm test
npm run check
lsof -t -i :4777 -i :4778 -i :4779 | xargs kill 2>/dev/null || true
docker compose up -d db
npm run test:e2e
```
Expected:
- `npm test` — все юнит-тесты зелёные: задача не трогает `src/`;
- `npm run check` — число ошибок и предупреждений как до задачи: `e2e/` не входит в `svelte-check`;
- `npm run test:e2e` — сборка и весь набор Playwright, `0 failed`, в том числе `15 passed` из `bitrix.spec.ts` и старые `analysis`/`export-api`.

- [ ] **Step 21: Commit**

```bash
cd /Volumes/projects/pet/retro
git add e2e/mock-bitrix.mjs e2e/bitrix.spec.ts e2e/helpers.ts e2e/analysis.spec.ts e2e/export-api.spec.ts e2e/fixtures/card.png playwright.config.ts docker-compose.yml .env.example .gitignore
git commit -m "$(cat <<'EOF'
E2E Битрикс24: мок портала, хелперы и пятнадцать сценариев

Мок отвечает как живой портал: старый REST и REST 3.0, ссылка на задачу
с группой, тег только старым REST, файл прикрепляется по ID объекта Диска,
чужая группа — 403. Лимиты по IP в e2e разводятся через x-forwarded-for.
createBoardInSpace отдаёт adminUrl; ENCRYPTION_KEY пробрасывается
в docker-compose, флаги Битрикс24 описаны в .env.example.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Документация и финальная проверка

Задача последняя: код интеграции уже написан задачами 1–11. Здесь три документа: запись в changelog для пользователей, `CLAUDE.md` для будущих сессий, `DESIGN-SYSTEM.md` для UI. Дальше полный прогон тестов, проверки перед коммитом и коммит. Юнит-тестов нет: логики в задаче нет, проверкой служат `npm test`, `npm run check`, `npm run build` и e2e. В конце — чеклист ручной проверки на живом портале для владельца. Исполнитель его не выполняет.

**Files:**
- Modify: `src/routes/changelog/+page.svelte` — массив `releases` (строка 14): новый первый элемент, версия `1.14`.
- Modify: `CLAUDE.md`:
  - Key directories — строки 19 и 23;
  - Local development — строка 46;
  - Testing — строка 52;
  - Features — пункт **Spaces** (строка 70) и новый пункт **Bitrix24** перед **SEO** (строка 83);
  - Conventions / Notifications — строка 103;
  - Environment variables — строки 115 и 120.
- Modify: `DESIGN-SYSTEM.md`:
  - правило 2 — строки 21–22;
  - Header / Board — строки 178–180;
  - Header / Space — строки 195–200;
  - Toast — строки 223–224;
  - Cards — строки 246–254;
  - новый подраздел `.icon-tip` перед `### «Add a card…»` (строка 261);
  - Summary — строки 290–297;
  - новый раздел Bitrix24 перед `### Feedback` (строка 367);
  - таблицы радиусов (116–117), высот (126–131), анимаций (396–404), z-index (433), Feedback Patterns (516), Utility Classes (607–611).
- Test: новых тестов нет. Проверка: `npm test`, `npm run check`, `npm run build`, `docker compose up -d db && npm run test:e2e`.

**Interfaces:**
- Consumes (только описывает, код не трогает):
  - модули: `src/lib/server/bitrix.ts` (`parseWebhookUrl`, `isBlockedHost`, `callV3`, `callLegacy`, `IMAGE_MAX_BYTES`), `src/lib/server/bitrix-flows.ts` (`createTaskFlow`, `statusForKind`), `src/lib/server/bitrix-connection.ts`, `src/lib/server/bitrix-limits.ts` (`connectLimiter`, `groupLimiter`, `createIpLimiter`, `createSpaceLimiter`, `runningCards`);
  - шина и данные: `emitBoard(boardSlug, event, payload)` из `src/lib/server/bus.ts`, `encryptionEnabled` из `crypto.ts`, `canViewSpace(space, cookies)` с `accessToken`, таблица `space_bitrix`, колонки `cards.bitrix_task_id` / `bitrix_task_url` и `spaces.access_token`, сокет-события `card:task` и `bitrix:opened`;
  - клиент: `boardStore.bitrix` / `bitrixOffer` / `setBitrix` / `setTask`, `socketStore.trackTaskOpened`, `bitrixTaskStore` (`src/lib/stores/bitrix-task.svelte.ts`), `ToastAction.external`;
  - компоненты: `TaskBadge.svelte` (`task`, `size: 'md' | 'sm'`), `BitrixPanel.svelte`, `BitrixTaskModal.svelte`, класс `.icon-tip` в `src/app.css`;
  - e2e: `e2e/mock-bitrix.mjs` (порт 4779), хелперы `addCardWithImage` и `createBoardInSpace`;
  - переменные окружения `BITRIX_ALLOW_HTTP`, `BITRIX_IMAGE_MAX_BYTES`;
  - тестовые фикстуры задач 4 и 5: фиктивный вебхук `https://bitrix24.team/rest/1/abc123secret/` в `src/lib/server/bitrix.test.ts` и `src/lib/server/bitrix-connection.test.ts`, поле `webhookEnc` в фикстуре `row` в `bitrix-connection.test.ts` (шаги 10 и 15 учитывают их, чтобы не принять за утечку).
- Produces: ничего для других задач. Документация становится источником правды для следующих сессий.

- [ ] **Step 1: Changelog — запись 1.14**

В `src/routes/changelog/+page.svelte` новый объект вставляется первым элементом массива `releases`: сразу после строки `const releases: Release[] = [` и перед объектом с `version: '1.13'`. Отступы — табы, как в файле. В английских строках нет ASCII-апострофов: строки в одинарных кавычках. Английские тексты не повторяются, потому что `{#each}` использует `change.en` как ключ. Слова «вебхук» в тексте нет: для пользователя это «ссылка для подключения».

Было:

```svelte
	const releases: Release[] = [
		{
			version: '1.13',
```

Стало:

```svelte
	const releases: Release[] = [
		{
			version: '1.14',
			date: '2026-09-17',
			title: { en: 'Tasks in Bitrix24', ru: 'Задачи в Битрикс24' },
			changes: [
				{ en: 'Turn a retro card into a Bitrix24 task right from the board: press «To Bitrix24 task» on the card, check the prefilled form and press «Create task»', ru: 'Карточку ретро можно превратить в задачу Битрикс24 прямо с доски: нажмите «В задачу Битрикс24» на карточке, проверьте заполненную форму и нажмите «Создать задачу»' },
				{ en: 'The form fills itself in: the title is the first line of the card, the description has the card text, a link to the board, the author, votes and comments — edit anything before sending', ru: 'Форма заполняется сама: название — первая строка карточки, в описании текст карточки, ссылка на доску, автор, голоса и комментарии — перед отправкой всё можно поправить' },
				{ en: 'Pick a group, a deadline and mark the task as important; the retro tag is added automatically, and the card image is attached to the task as a file', ru: 'Можно указать группу, срок и отметить задачу важной; тег retro добавляется сам, а картинка карточки прикрепляется к задаче файлом' },
				{ en: 'Once created, the card shows a «Task #123» link — everyone on the board sees it at once, and it is also in the Summary and in the JSON and Markdown export', ru: 'После создания на карточке появляется ссылка «Задача #123» — её сразу видят все участники доски, она же есть в «Итогах» и в экспорте JSON и Markdown' },
				{ en: 'In discussion mode a task can be created straight from the Summary without interrupting the discussion', ru: 'В режиме обсуждения задачу можно поставить прямо из «Итогов», не прерывая обсуждение' },
				{ en: 'Bitrix24 is connected once per space: the space creator presses «Bitrix24» on the space page (or «Connect Bitrix24» in the board menu) and pastes the connection link from the portal — the hint on where to get it is right there. The link is stored encrypted and never shown again', ru: 'Битрикс24 подключается один раз на пространство: создатель пространства нажимает «Битрикс24» на странице пространства (или «Подключить Битрикс24» в меню доски) и вставляет ссылку для подключения из портала — подсказка, где её взять, там же. Ссылка хранится зашифрованной и больше не показывается' },
				{ en: 'Tasks are created on behalf of whoever connected the portal — they are both the creator and the responsible person. Only the board creator and the space creator see the button, on regular boards and on AI analysis boards alike', ru: 'Задачи ставятся от имени того, кто подключил портал, — он и постановщик, и ответственный. Кнопку видят только создатель доски и создатель пространства — на обычных досках и на досках AI-анализа' },
				{ en: 'Card icons now show a hint on hover', ru: 'У иконок на карточке появились подсказки при наведении' },
				{ en: 'Password-protected spaces are better protected: after the update you may need to enter the space password once more', ru: 'Пространства с паролем защищены надёжнее: после обновления пароль, возможно, придётся ввести ещё раз' }
			]
		},
		{
			version: '1.13',
```

Зачем последний пункт: миграция `0008` задаёт `spaces.access_token` случайным значением. Старые cookie `retro_space_{slug}=authenticated` перестают подходить (задача 2), поэтому гостям закрытых пространств придётся ввести пароль заново.

- [ ] **Step 2: Проверить, что страница компилируется**

Run: `npm run check`
Expected: последняя строка `svelte-check found 0 errors and 0 warnings`. До начала плана, 17.09, базовая линия была 0 и 0.

- [ ] **Step 3: CLAUDE.md — Key directories, Local development, Testing**

Правка 1. Было:

```text
- `src/lib/components/` — Svelte components (Card, CardForm, CommentForm, Lightbox, ToggleSwitch, Summary/SummaryRow/FocusTimer, NamePrompt, Toasts, AiBadge, Seo, JsonLd, etc.)
```

Стало:

```text
- `src/lib/components/` — Svelte components (Card, CardForm, CommentForm, Lightbox, ToggleSwitch, Summary/SummaryRow/FocusTimer, NamePrompt, Toasts, AiBadge, BitrixPanel/BitrixTaskModal/TaskBadge, Seo, JsonLd, etc.)
```

Правка 2. Было:

```text
- `src/lib/server/` — server-side code (DB, encryption, image processing, StatsD)
```

Стало:

```text
- `src/lib/server/` — server-side code (DB, encryption, image processing, StatsD, DeepSeek and Bitrix24 clients)
```

Правка 3. Было:

```text
App available at http://localhost:3777
```

Стало:

```text
App available at http://localhost:3777

Put a stable `ENCRYPTION_KEY=<64 hex chars>` (`openssl rand -hex 32`) into `.env` — compose passes it to the app. Without it the Bitrix24 panel says encryption is not configured; changing it later leaves cards encrypted with the old key unreadable. `npm run dev` has no Socket.IO server (it lives in `server.js`), so live boards and the bus (`card:task`, space analysis) work only in the built app — `docker compose` or `node server.js`
```

Правка 4. Было:

```text
Shared helpers in `e2e/helpers.ts` (`createBoard`, `addCard`, `column`, `initStorage`) — every test creates its own board, no DB cleanup needed. In CI the `e2e` job gates the deploy.
```

Стало:

```text
External APIs are mocks started as extra `webServer`s in `playwright.config.ts`: `e2e/mock-deepseek.mjs` (4778, via `DEEPSEEK_API_BASE`) and `e2e/mock-bitrix.mjs` (4779, reachable thanks to `BITRIX_ALLOW_HTTP=1`). Locally Playwright reuses servers already answering on 4777–4779, so stop stale ones after changing a mock or rebuilding. Shared helpers in `e2e/helpers.ts` (`createBoard`, `addCard`, `addCardWithImage`, `createSpace`, `createLockedSpace`, `createBoardInSpace`, `column`, `initStorage`) — every test creates its own board, no DB cleanup needed. `*.png` is in `.gitignore`, so a new image fixture in `e2e/fixtures/` needs `git add -f` (or a `.gitignore` exception). In CI the `e2e` job gates the deploy.
```

- [ ] **Step 4: CLAUDE.md — Features: Spaces и новый пункт Bitrix24**

Правка 1. Было:

```text
- **Spaces**: group boards together, optional password protection
```

Стало:

```text
- **Spaces**: group boards together, optional password protection. The access cookie `retro_space_{slug}` holds `spaces.access_token` (set on password entry, `?admin=` and creation with a password; every «enable password» issues a new token, so old cookies stop working) and is compared by value in `canViewSpace` (`src/lib/server/space-access.ts`) and in `server.js` `space:join` — a forged cookie opens nothing. The creator cookie `retro_space_creator_{slug}` is compared with `creator_token` the same way
```

Правка 2 вставляет новый пункт перед пунктом **SEO**. Якорь `old_string` — начало строки SEO, он встречается один раз. Было:

```text
- **SEO**: `seo-paths.js` **in the repo root**
```

Стало (новый пункт, перевод строки, затем тот же якорь):

```text
- **Bitrix24**: a card on a board inside a space becomes a Bitrix24 task through the space's inbound webhook. *Connecting* (space creator only): the «Битрикс24» button next to the password switch opens `BitrixPanel.svelte` (`?bitrix=1` opens it with focus in the webhook field; the board `⋯` item «Подключить Битрикс24» leads there and is shown via `bitrixOffer` to the space creator while nothing is connected); form actions `bitrixConnect` / `bitrixDisconnect` / `bitrixSetGroup` in `src/routes/spaces/[slug]/+page.server.ts` run `profile` → tasks permission probe → optional group name and save nothing if a step fails. One `space_bitrix` row per space (cascades with the space), read and written only by `src/lib/server/bitrix-connection.ts`: the webhook is AES-256-GCM encrypted (connecting is refused without `ENCRYPTION_KEY` — `encryptionEnabled` in `crypto.ts`), `last_error` keeps `invalid_webhook | scope | access` from a failed action, a successful one clears it. The webhook code never reaches logs, error messages, metrics, page data, export or the socket; clients only get `portal`, `userName`, `groupId`, `groupName`, `lastError`. *Client* `src/lib/server/bitrix.ts`: `parseWebhookUrl` + `isBlockedHost` (https only; no localhost, dotless, `*.local`, private or `::ffff:`-mapped hosts; `redirect: 'manual'`, any 3xx = `invalid_webhook`), POST + JSON only, 15 s timeout (30 s and one at a time for the file upload), an error is the `error` key in the body, never the HTTP status. Tasks use **REST 3.0** (`/rest/api/{user}/{code}/`: `tasks.task.add` with `Idempotency-Key` = sha256 of card id + fields, `tasks.task.field.list` as the permission probe, `tasks.task.file.attach`); **legacy REST** (`/rest/{user}/{code}/`) covers what v3 lacks or refuses: `profile` (owner and `TIME_ZONE`), `sonet_group.get` (group name; without the «Рабочие группы соцсети» permission the id is kept without a name), `tasks.task.update { TAGS: ['retro'] }` (v3 rejects `tags`), `disk.storage.getlist` / `disk.storage.uploadFile` (the card image goes to the owner's Drive root and is attached by the Drive object `ID`, not `FILE_ID`; images over `BITRIX_IMAGE_MAX_BYTES` are skipped). Responsible = creator = webhook owner; deadline = the picked date at 19:00 in the owner's zone; task URL = portal host + `link` from the `tasks.task.add` response (it already reflects the group). *Creating* (board creator with access to the space, or the space creator): the task icon on a card and «В задачу» in the focused Summary row open `BitrixTaskModal.svelte` (mounted once in `Board.svelte`, state in `bitrixTaskStore` — `src/lib/stores/bitrix-task.svelte.ts`), prefilled once on the client by `buildTaskDraft` (`src/lib/bitrix-draft.ts`); the modal's own `$effect`s close it when the card disappears or gets a task from someone else (not the store — that would create an import cycle with `board.svelte.ts` / `socket.svelte.ts`). It posts to `?/createTask`, the first action of `src/routes/[slug]/+page.server.ts`, and never calls `update()` (`invalidateAll()` would rerun the board load and rejoin the room); the group field is checked by `GET /[slug]/bitrix/group?id=N`. Neither ever throws: `fail(status, { bitrixError })` / `json(…, { status })`, and the client branches on `bitrixError`, never on the status. Orchestration is `createTaskFlow` in `src/lib/server/bitrix-flows.ts` (pure, dependencies injected, unit-tested): `tasks.task.add` → `UPDATE cards … WHERE bitrix_task_id IS NULL` (0 rows → orphaned task, `not_found`) → tag and image best-effort → `emitBoard(slug, 'card:task', { cardId, task })` (`bus.ts` channel `board`, relayed by `server.js` to the board room) → `boardStore.setTask` on every client. Rate limits and the in-flight `runningCards` set live in `src/lib/server/bitrix-limits.ts` (connect 5/min per IP, group check 30/min per IP, create 10/min per IP and 30/h per space). *Result*: one task per card in `cards.bitrix_task_id` / `bitrix_task_url` (also in `server.js`'s schema copy, so `board:state` carries them); `TaskBadge.svelte` renders from `card.bitrixTaskUrl` for everyone and stays after disconnect or space deletion; the export has `task: { id, url } | null` per card; nothing syncs back from the portal. Metrics `retro.bitrix.*`; opened forms are counted via the `bitrix:opened` socket event (`socketStore.trackTaskOpened`, creator token checked in `server.js`). E2e runs against `e2e/mock-bitrix.mjs` (port 4779; `POST /__mode`, `GET /__calls`, `POST /__reset`) with `BITRIX_ALLOW_HTTP=1` from `playwright.config.ts` and the webhook `http://localhost:4779/rest/1/testcode/`
- **SEO**: `seo-paths.js` **in the repo root**
```

- [ ] **Step 5: CLAUDE.md — Conventions и Environment variables**

Правка 1 (строка Notifications). Было:

```text
(`action` = `{ label, href }` or `{ label, onClick }`)
```

Стало:

```text
(`action` = `{ label, href, external? }` or `{ label, onClick }`; `external: true` opens the link in a new tab)
```

Правка 2. Было:

```text
- `ENCRYPTION_KEY` — AES-256-GCM key for card/comment encryption
```

Стало:

```text
- `ENCRYPTION_KEY` — AES-256-GCM key (64 hex chars, `openssl rand -hex 32`) for card/comment encryption and the Bitrix24 webhook; without it Bitrix24 cannot be connected
```

Правка 3. Было:

```text
- `DEEPSEEK_API_KEY` — enables the space analysis button; `DEEPSEEK_API_BASE` — override for tests/proxies (default `https://api.deepseek.com`)
```

Стало:

```text
- `DEEPSEEK_API_KEY` — enables the space analysis button; `DEEPSEEK_API_BASE` — override for tests/proxies (default `https://api.deepseek.com`)
- `BITRIX_ALLOW_HTTP` — `1` lets the Bitrix24 client accept `http://localhost:{port}` webhooks (the e2e mock); set only in `playwright.config.ts`, never in production
- `BITRIX_IMAGE_MAX_BYTES` — card images larger than this are not attached to Bitrix24 tasks (default `4194304`, 4 MB; `docker-compose.prod.yml` does not pass it, so production uses the default)
```

- [ ] **Step 6: DESIGN-SYSTEM.md — правило высот, шапка доски и пространства, тост**

Правка 1 (правило 2). Было:

```text
   the composer is 48, vote/comment pills are 40, column tabs are `min-h-11`.
```

Стало:

```text
   the composer is 48, vote/comment pills and the card's task badge are 40, column tabs are `min-h-11`.
```

Правка 2 (Header / Board, меню `⋯`). Было:

```text
  EN + Theme toggles, rename, delete (`text-bad hover:bg-bad-bg`, inline confirm with `btn-sm`)
```

Стало:

```text
  EN + Theme toggles, rename, «Connect Bitrix24» (space creator, space without a connection: link
  glyph 16 muted → `/spaces/{slug}?bitrix=1`), delete (`text-bad hover:bg-bad-bg`, inline confirm
  with `btn-sm`)
```

Правка 3 (Header / Space, ряд создателя). Было:

```text
  Right: labelled `ToggleSwitch` «Password» (38) + delete `btn-icon btn-icon-lg btn-icon-bordered`
  (hover `bad-bg`/`bad`); confirm state = 13 secondary text + `btn-danger btn-md` + `btn-secondary btn-md`
```

Стало:

```text
  Right (creator): «Bitrix24» panel trigger (see Bitrix24) + labelled `ToggleSwitch` «Password» (38)
  + delete `btn-icon btn-icon-lg btn-icon-bordered` (hover `bad-bg`/`bad`); confirm state = 13
  secondary text + `btn-danger btn-md` + `btn-secondary btn-md`
```

Правка 4 (панель пароля). Было:

```text
  error 13 `text-bad` with `shake`
```

Стало:

```text
  error 13 `text-bad` with `shake`. The Bitrix24 panel uses the same frame; one panel is open at a
  time, and the delete confirm collapses both
```

Правка 5 (Toast). Было:

```text
- Text 14/1.4 ink; action 13/700 accent «label →»: `{ label, href }` renders a link,
```

Стало:

```text
- Text 14/1.4 ink; action 13/700 accent «label →»: `{ label, href }` renders a link
  (`external: true` adds `target="_blank" rel="noopener"` — «Task #N created → Open»),
```

- [ ] **Step 7: DESIGN-SYSTEM.md — карточка, подсказка `.icon-tip`, «Итоги»**

Правка 1 (иконки карточки). Было:

```text
  `btn-icon btn-icon-sm` (28, radius 8, glyph 16): move = swap arrows, edit = pencil, delete = ✕
  (first click → `bg-bad text-white` confirm state for 3s). Move opens a row of `badge-sm` tone
```

Стало:

```text
  `btn-icon btn-icon-sm` (28, radius 8, glyph 16): task = square with a check (first; board or
  space creator, connected space, card without a task), move = swap arrows, edit = pencil,
  delete = ✕ (first click → `bg-bad text-white` confirm state for 3s). Each icon keeps `title` +
  `aria-label` and shows an `.icon-tip` tooltip. Move opens a row of `badge-sm` tone
```

Правка 2 (ряд действий карточки). Было:

```text
  terracotta stays with actions and the timer; author right, 13 muted. Pills are 40px on phones
```

Стало:

```text
  terracotta stays with actions and the timer; `TaskBadge` (32) after the comment pill; author
  right (`ml-auto`), 13 muted. Pills and the task badge are 40px on phones, where the row wraps
  (`flex-wrap gap-2`) and the badge moves to the second line together with the author
```

Правка 3 (новый подраздел перед «Add a card…»). Было:

```text
### «Add a card…» (`CardForm.svelte`)
```

Стало:

```text
### Icon tooltip (`.icon-tip`)
- The FocusTimer tooltip idiom for icon buttons, one class in `src/app.css`: `rounded-xl
  bg-text-primary px-3 py-2 text-[13px] text-surface shadow-1`, `mt-1.5` under the icon group,
  aligned to its right edge; appears over 150ms on hover and `focus-within`
- Used on all four card icons (task, move, edit, delete); the button keeps `title` + `aria-label`,
  the tooltip repeats the same text

### «Add a card…» (`CardForm.svelte`)
```

Правка 4 (строка «Итогов»). Было:

```text
  13/600 muted `min-w-6` centred (✓ in `well` once discussed), text 15/1.4 ink, author 13 muted,
```

Стало:

```text
  13/600 muted `min-w-6` centred (✓ in `well` once discussed), text 15/1.4 ink, author 13 muted
  (yields space first: `max-w-28 truncate`), task link «#123» (`TaskBadge size="sm"`, 28,
  `pointer-events-auto` so the click is not swallowed by the focus-jump layer),
```

Правка 5 (сфокусированная строка). Было:

```text
  «Next →» `btn btn-primary btn-sm` (on the last card: «End discussion»), comment pill `ml-auto`
```

Стало:

```text
  «Next →» `btn btn-primary btn-sm` (on the last card: «End discussion»), «To task»
  `btn btn-secondary btn-sm` with a 14px glyph (creator, connected space, no task yet) that turns
  into the 32px `TaskBadge` once the task exists (both `pointer-events-auto`, the row wraps),
  comment pill `ml-auto`
```

- [ ] **Step 8: DESIGN-SYSTEM.md — раздел Bitrix24**

Вставить перед `### Feedback`. Якорь берётся из двух строк, потому что `### Feedback` — подстрока `### Feedback Patterns`. Было:

```text
### Feedback
- **FAB**: `fixed right-5 bottom-5 z-[500] h-[38px] rounded-full bg-text-primary px-4 sm:px-[18px]
```

Стало:

```text
### Bitrix24 (`BitrixPanel.svelte`, `BitrixTaskModal.svelte`, `TaskBadge.svelte`)
- Neutral family: the task badge never takes a column tone, accent or `improve`; `well` / `bad`
  only for success and error states; terracotta only on the one primary button of the panel
  («Connect») and of the modal («Create task»)
- **Trigger** (space page, creator row before «Password»): `btn btn-secondary btn-md pr-3.5`, link
  glyph 16 `text-text-secondary` (✓ 16 `text-well` once connected), label «Bitrix24», chevron 14
  muted rotated 180° when open, `aria-expanded`; `?bitrix=1` opens the panel with focus in the
  webhook field
- **`BitrixPanel`**: `collapsible` + `mt-7 rounded-2xl border border-border bg-surface-card p-4`.
  Not connected: labels 14/600, `input input-md` webhook `flex-1` (`type=url`) + group `w-[290px]`
  (`inputmode=numeric`), «Connect» `btn btn-primary btn-md` + «Cancel» `btn btn-secondary btn-md`,
  one-line hint 13 muted; Enter = Connect. Checking: 16px `animate-spin` spinner + «Checking…»,
  fields `opacity-50 pointer-events-none`. Connected: title 14/600 «Bitrix24 · {portal}» +
  `badge badge-outline` ✓ «Connected»; ink initial avatar 32 (13/700); «Tasks are created by:
  {name}» + a 13 note; default group «42 · Name» (muted «not set») with a pencil `btn-icon
  btn-icon-sm` → `input input-md w-32` + Save `btn btn-dark btn-md` + Cancel; «Disconnect»
  `btn btn-secondary btn-md hover:bg-bad-bg hover:text-bad` → `btn btn-danger btn-md` «Click again
  to disconnect» for 3s, no browser dialogs. Result badges `badge badge-success badge-pop` for 2.5s.
  Errors: field `border-bad` + `shake`, 13 `text-bad` under the row, the typed value stays;
  `last_error` → `error-box` above the reconnect form; no `ENCRYPTION_KEY` → an explanation
  instead of the form
- **`TaskBadge`** (`task`, `size`): an `<a target="_blank" rel="noopener">`; next to `AiBadge` it
  is the framed one. `md` (card, focused Summary row): `inline-flex h-8 items-center gap-1.5
  rounded-full border border-border bg-surface-card px-3 text-[13px] font-semibold
  text-text-primary`, external-link glyph 14 muted, «Task #123», hover `border-border-strong
  bg-surface-hover`, `active:scale-[0.97]`, `badgePop`, `title` = the task URL,
  `max-md:h-10 max-md:px-4`. `sm` (Summary row): `h-7 gap-1 px-2.5 text-text-secondary`, glyph 12,
  «#123», hover `border-border-strong text-text-primary`, `title` «Task #123 in Bitrix24».
  Rendered for everyone from `card.bitrixTaskUrl`, with or without a space
- **`BitrixTaskModal`** (mounted once in `Board.svelte`): the `NewBoardModal` recipe — overlay
  `fixed inset-0 z-[70] bg-scrim p-4`, card `w-[480px] max-w-full rounded-3xl bg-surface-card
  p-6 sm:p-8 shadow-2 gap-[18px]`, `role="dialog" aria-modal="true"`, focus trap, the title is
  focused and selected on open. Title Unbounded 21 + context 14 secondary «{portal} · the retro
  tag is added automatically»; close `btn-icon btn-icon-lg btn-icon-bordered`. Fields `input
  input-lg bg-surface` (title `maxlength=250`; group with a 13 status line `mt-1.5`: name muted /
  «not found» `text-bad`; date `type=date` with a 16px muted calendar glyph over a transparent native picker indicator); description `textarea bg-surface px-[18px] py-3
  text-[15px] leading-[1.5]`, grows 4–8 lines, then `max-h-[204px] overflow-y-auto`; «Important
  task» = `ToggleSwitch`; indicator lines 13 secondary with 14px glyphs, outside the Tab order.
  Buttons `btn btn-secondary btn-lg flex-1` + `btn btn-primary btn-lg flex-[2]`. Submitting: 16px
  spinner + «Creating…» («Creating and attaching the image…» with an image), form and close
  `opacity-50 pointer-events-none`, `aria-busy`, Escape and overlay ignored. Errors: `error-box`
  (`fadeUp`, `role="alert"`) above the buttons, «Space settings →» 700 `text-bad-strong
  underline`; retryable errors turn the primary button into «Retry»
- **Phone sheet** (below `sm`): `max-sm:fixed max-sm:inset-0 max-sm:h-[100dvh]
  max-sm:rounded-none`, no scrim, enters with `fly y:24`; the header and the button row are
  `sticky` on `bg-surface-card` with a `border-border` divider, fields scroll between them, so
  «Create task» stays visible above the keyboard
- Test ids: `bitrix-panel-toggle`, `bitrix-panel`, `menu-bitrix-connect`, `card-task-button`,
  `summary-task-button`, `bitrix-task-form`, `bitrix-task-submit`, `task-badge`

### Feedback
- **FAB**: `fixed right-5 bottom-5 z-[500] h-[38px] rounded-full bg-text-primary px-4 sm:px-[18px]
```

- [ ] **Step 9: DESIGN-SYSTEM.md — таблицы шкал, анимаций, z-index, паттернов и утилит**

Каждая строка «было» встречается в файле ровно один раз (проверено `grep -cF`). Одна правка — одна строка.

| Было | Стало |
|---|---|
| `\| 24 \| `rounded-3xl` \| NewBoardModal \|` | `\| 24 \| `rounded-3xl` \| NewBoardModal, BitrixTaskModal (a square sheet on phones) \|` |
| `\| full \| `rounded-full` \| `pill`, `badge`, avatars, `+N`, FAB, toast icon circles, mood bar segments, switch \|` | `\| full \| `rounded-full` \| `pill`, `badge`, `TaskBadge`, avatars, `+N`, FAB, toast icon circles, mood bar segments, switch \|` |
| `\| 28 \| `btn-icon-sm`, `badge`, summary comment pill \| Inside cards, summary rows, chips; lock badge next to the space H1 \|` | `\| 28 \| `btn-icon-sm`, `badge`, summary comment pill, `TaskBadge size="sm"` \| Inside cards, summary rows, chips; lock badge next to the space H1 \|` |
| `\| 32 \| `btn-sm`, `input-sm`, `btn-icon-md`, `pill`, avatar, `+N`, FocusTimer chip, name-card avatar \| Card action rows, summary controls, comment form, header participants \|` | `\| 32 \| `btn-sm`, `input-sm`, `btn-icon-md`, `pill`, avatar, `+N`, FocusTimer chip, name-card avatar, `TaskBadge` \| Card action rows, summary controls, comment form, header participants \|` |
| `\| 38 \| `btn-md`, `input-md`, `btn-icon-lg`, timer chips, ToggleSwitch, FAB, ⋯ button, mobile share \| Header, toolbars, inline forms, name card, password panel, feedback panel \|` | `\| 38 \| `btn-md`, `input-md`, `btn-icon-lg`, timer chips, ToggleSwitch, FAB, ⋯ button, mobile share, Bitrix24 trigger \| Header, toolbars, inline forms, name card, password and Bitrix24 panels, feedback panel \|` |
| `\| 54 \| `btn-lg`, `input-lg` \| Create screen, NewBoardModal, space password form \|` | `\| 54 \| `btn-lg`, `input-lg` \| Create screen, NewBoardModal, BitrixTaskModal, space password form \|` |
| `\| badgePop \| 0.25s \| spring \| Comment counter, password success badge \|` | `\| badgePop \| 0.25s \| spring \| Comment counter, password success badge, TaskBadge, Bitrix24 panel badges \|` |
| `\| collapsible \| 0.25s \| `(0.25, 1, 0.5, 1)` \| Password panel, comments (grid-template-rows) \|` | `\| collapsible \| 0.25s \| `(0.25, 1, 0.5, 1)` \| Password and Bitrix24 panels, comments (grid-template-rows) \|` |
| `\| modalFadeIn / modalZoomIn \| 0.2s / 0.3s \| ease / spring \| NewBoardModal overlay / card \|` | `\| modalFadeIn / modalZoomIn \| 0.2s / 0.3s \| ease / spring \| NewBoardModal and BitrixTaskModal overlay / card (the phone sheet flies in, y 24) \|` |
| `\| shake \| 0.5s \| ease \| Wrong password \|` | `\| shake \| 0.5s \| ease \| Wrong password, Bitrix24 webhook and group fields \|` |
| `\| Modal \| 70 \| NewBoardModal overlay \|` | `\| Modal \| 70 \| NewBoardModal and BitrixTaskModal overlays \|` |

Экранирование `\|` нужно только внутри этой таблицы. В файле строки пишутся с обычным `|`, например `| shake | 0.5s | ease | Wrong password, Bitrix24 webhook and group fields |`.

Feedback Patterns: после строки ниже добавить новую строку. Было:

```text
| Background job done | Info/success toast with an «Open →» link — on any page |
```

Стало:

```text
| Background job done | Info/success toast with an «Open →» link — on any page |
| Create a Bitrix24 task | Spinner + «Creating…» on the button, modal locked; success closes it, the badge pops for everyone, success toast «Task #N created» with «Open →» in a new tab |
```

Utility Classes — таблица подсказок и список общих компонентов. Было:

```text
| `.error-box-sm` | Smaller padding + `text-[13px]` |
```

Стало:

```text
| `.error-box-sm` | Smaller padding + `text-[13px]` |

### Tooltips

| Class | Purpose |
|-------|---------|
| `.icon-tip` | Icon-button tooltip (FocusTimer idiom): `rounded-xl bg-text-primary px-3 py-2 text-[13px] text-surface shadow-1`, 150ms on hover / `focus-within` — the card icons |
```

Было:

```text
`ToggleSwitch.svelte` (38px labelled frame), `Toasts.svelte` + `toastStore`, `NamePrompt.svelte`.
```

Стало:

```text
`ToggleSwitch.svelte` (38px labelled frame), `Toasts.svelte` + `toastStore`, `NamePrompt.svelte`,
`TaskBadge.svelte` (bordered link pill, `md` 32 / `sm` 28).
```

- [ ] **Step 10: Сверка документации с кодом**

Документация описывает код, а не спеку. Если класс, имя или путь в коде отличаются от текста шагов 3–9, текст правится под код. Если код расходится с заметками Секции 5 спеки, это расхождение выписывается в отчёт задачи и молча не чинится. Команды (пути со скобками — в кавычках):

```bash
ls src/lib/server/bitrix.ts src/lib/server/bitrix-flows.ts src/lib/server/bitrix-connection.ts src/lib/server/bitrix-limits.ts src/lib/bitrix-draft.ts src/lib/stores/bitrix-task.svelte.ts src/lib/components/BitrixPanel.svelte src/lib/components/BitrixTaskModal.svelte src/lib/components/TaskBadge.svelte 'src/routes/[slug]/bitrix/group/+server.ts' e2e/mock-bitrix.mjs e2e/bitrix.spec.ts drizzle/0008_bitrix.sql
```
Expected: выведены все 13 путей, нет `No such file or directory`.

```bash
grep -n "export async function\|export function" e2e/helpers.ts
```
Expected: среди имён есть `addCardWithImage`, `createBoardInSpace`, `createSpace`, `createLockedSpace`, `createBoard`, `addCard`, `column`, `initStorage` — те, что перечислены в шаге 3.

```bash
grep -rn "BITRIX_ALLOW_HTTP\|BITRIX_IMAGE_MAX_BYTES" src playwright.config.ts .env.example
grep -n "emitBoard" src/lib/server/bus.ts
grep -n "'board'\|bitrix:opened\|accessToken" server.js
grep -n "accessToken" src/lib/server/space-access.ts
grep -rln "webhookEnc\|webhook_enc" src server.js --exclude='*.test.ts'
```
Expected:
- обе переменные читает `src/lib/server/bitrix.ts`; `BITRIX_ALLOW_HTTP: '1'` задан в `env` веб-сервера приложения в `playwright.config.ts`; обе переменные есть в `.env.example`;
- `export function emitBoard` есть;
- в `server.js` есть `bus.on('board'`, `socket.on('bitrix:opened'` и сравнение cookie с `accessToken`;
- в `space-access.ts` есть сравнение с `accessToken`;
- последняя команда выводит ровно два пути: `src/lib/server/db/schema.ts` и `src/lib/server/bitrix-connection.ts`. Тесты исключены флагом `--exclude='*.test.ts'`: в `src/lib/server/bitrix-connection.test.ts` поле `webhookEnc` законно стоит в фикстуре `row` для `toConnection` (задача 5). Любой другой путь — находка для отчёта: шифротекст читается вне модуля подключения.

```bash
grep -n "icon-tip" -A8 src/app.css
grep -n "class=" src/lib/components/TaskBadge.svelte
grep -n "max-sm:\|z-\[70\]\|aria-modal\|aria-busy" src/lib/components/BitrixTaskModal.svelte
grep -n "collapsible\|data-testid\|badge-pop\|shake" src/lib/components/BitrixPanel.svelte 'src/routes/spaces/[slug]/+page.svelte'
grep -n "external" src/lib/stores/toast.svelte.ts src/lib/components/Toasts.svelte
grep -n "menu-bitrix-connect" -A6 src/lib/components/Header.svelte
```
Expected: классы совпадают с разделом Bitrix24 и подразделом `.icon-tip`:
- в `TaskBadge` есть `h-8` и `max-md:h-10` (md), `h-7` (sm);
- в модалке есть `max-sm:h-[100dvh]`, `z-[70]`, `aria-modal="true"`, `aria-busy`;
- в панели есть `collapsible` и `data-testid="bitrix-panel"`;
- в тостах есть `external` и `target="_blank"`;
- пункт меню ведёт на `/spaces/${…}?bitrix=1`.

- [ ] **Step 11: Юнит-тесты целиком**

Run: `npm test`
Expected:
- `Test Files  28 passed (28)`: 25 файлов до плана, плюс `bitrix.test.ts`, `bitrix-flows.test.ts`, `bitrix-draft.test.ts`. Если задачи добавили ещё файлы (например, `bitrix-connection.test.ts`, `bitrix-panel.test.ts`), число больше.
- `Tests` больше 193 (до плана было 193), ни одного `failed`.
- `dictionaries.test.ts` зелёный, значит ключи `bitrix.*` и `apiExport.task` есть в обоих словарях.

- [ ] **Step 12: Типы**

Run: `npm run check`
Expected: `svelte-check found 0 errors and 0 warnings`.

- [ ] **Step 13: Сборка**

Run: `npm run build`
Expected: сборка завершается строками `> Using @sveltejs/adapter-node` и `✔ done`, без `error`. Предупреждение Svelte о недоступности (a11y) в новых компонентах — повод поправить компонент до коммита.

- [ ] **Step 14: E2e**

Сначала убедиться, что порты свободны. Локально Playwright переиспользует уже запущенные серверы (`reuseExistingServer: !process.env.CI`) и иначе прогонит тесты на старой сборке или старом моке:

```bash
lsof -nP -iTCP:4777 -iTCP:4778 -iTCP:4779 -sTCP:LISTEN
```
Expected: пустой вывод. Если там висят процессы `node server.js` / `node e2e/mock-*.mjs` от прошлых прогонов, завершить их `kill <PID>`.

Run: `docker compose up -d db && npm run test:e2e`
Expected:
- `migrate.js` применяет `0008_bitrix.sql` к локальной базе без ошибок;
- в итоге `N passed` без `failed` и `flaky`: 37 тестов до плана плюс тесты `e2e/bitrix.spec.ts` (15 сценариев спеки, если задача 11 не разбила их иначе);
- `analysis.spec.ts` и `space-rename.spec.ts` зелёные — значит, cookie `access_token` у закрытых пространств ничего не сломала.

- [ ] **Step 15: Проверки перед коммитом**

```bash
git ls-files e2e/fixtures/card.png
```
Expected: `e2e/fixtures/card.png`. `.gitignore` игнорирует `*.png`, и если вывод пустой, фикстура не в git — e2e в CI упадёт на `addCardWithImage`. Тогда выполнить `git add -f e2e/fixtures/card.png`: файл войдёт в коммит этой задачи.

Поиск секретов. Pathspec-исключения — в одинарных кавычках, иначе zsh раскроет `*`:

```bash
git grep -nE "bitrix24\.team/rest/" -- ':!*.test.ts' ':!docs/**'
git grep -nE "bitrix24\.team/rest/(api/)?[0-9]+/[A-Za-z0-9]+" | grep -v "/abc123secret/"
git grep -nE "ENCRYPTION_KEY=[0-9a-f]{64}"
```
Expected: все три вывода пустые.
- Первая команда: в коде, конфигах, e2e, `CLAUDE.md` и `DESIGN-SYSTEM.md` адресов портала автора нет вообще. Тесты и `docs/` исключены: фикстуры задач 4 и 5 в `src/lib/server/bitrix.test.ts` и `src/lib/server/bitrix-connection.test.ts` законно содержат фиктивный `https://bitrix24.team/rest/1/abc123secret/` (и его v3-вариант `/rest/api/1/abc123secret/`), и тексты плана могут их цитировать.
- Вторая команда проверяет все файлы, включая тесты и `docs/`: у любого адреса портала с кодом должен быть только фиктивный код `abc123secret`. Плейсхолдеры без кода (`…`, `{code}`) регулярное выражение не ловит. Если строка нашлась, это может быть настоящий вебхук. Тогда не коммитить: заменить код в файле на `abc123secret` и сообщить владельцу, что вебхук, возможно, надо перевыпустить.
- Третья команда: настоящего ключа шифрования в отслеживаемых файлах нет. Тестовые адреса вида `http://localhost:4779/rest/1/testcode/` проверки не задевают.

```bash
git status --short
```
Expected: изменены только `CLAUDE.md`, `DESIGN-SYSTEM.md`, `src/routes/changelog/+page.svelte` (и, если понадобилось, `e2e/fixtures/card.png`). `.env` в списке нет: он в `.gitignore`. Неотслеживаемые файлы вне задачи (например, сам план `docs/superpowers/plans/2026-09-17-bitrix24-integration.md`, если его ещё не закоммитили) не трогать и в коммит не добавлять.

- [ ] **Step 16: Commit**

```bash
git add src/routes/changelog/+page.svelte CLAUDE.md DESIGN-SYSTEM.md
git commit -F - <<'EOF'
Битрикс24: changelog 1.14, CLAUDE.md и дизайн-система

Запись 1.14 для пользователей: карточка → задача Битрикс24, подключение
на пространство, бейдж у всех участников, повторный ввод пароля закрытого
пространства после обновления. CLAUDE.md: пункт Bitrix24 (bitrix.ts,
bitrix-flows.ts, bitrix-connection.ts, space_bitrix, cards.bitrix_task_*,
card:task через emitBoard, REST 3.0 и старый REST для Диска, profile и тега,
мок e2e), access_token у пространств, BITRIX_ALLOW_HTTP и
BITRIX_IMAGE_MAX_BYTES. DESIGN-SYSTEM.md: BitrixPanel, BitrixTaskModal с
мобильным листом, TaskBadge, подсказка .icon-tip.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```
Expected: `git log -1 --stat` показывает три файла (четыре, если добавлена фикстура). Пуш и деплой решает пользователь, исполнитель не пушит.

После деплоя (для владельца):
- миграция `0008` применится при старте контейнера (`entrypoint.sh` → `migrate.js`);
- `ENCRYPTION_KEY` на проде уже задан. Проверка: `docker compose -f docker-compose.prod.yml exec app node -e "console.log((process.env.ENCRYPTION_KEY||'').length)"` → `64`;
- гости закрытых пространств один раз введут пароль заново — об этом предупреждает запись 1.14.

#### Ручная проверка на живом портале — чеклист для владельца (исполнитель не выполняет)

Проверка идёт на локальной сборке в Docker, а не в `npm run dev`: в `vite dev` нет Socket.IO-сервера и шины, доска там не получает карточки и `card:task`. Docker ближе всего к проду: те же `mem_limit: 384m` и `--max-old-space-size=256`, важные для загрузки картинки.

Подготовка:
1. В `.env` в корне репозитория: `ENCRYPTION_KEY=` и 64 hex-символа из `openssl rand -hex 32`, значение не менять между запусками. Затем `docker compose up -d --build`, потом `docker compose logs app | grep -i migrat` — миграции прошли без ошибок.
2. Вебхук: портал → Разработчикам → Другое → Входящий вебхук с правами «Задачи», «Диск», «Рабочие группы соцсети». Подойдёт и вебхук из скилла `to-task`: у него нет «Рабочих групп соцсети», на нём проверяется ветка «id без названия». Адрес вставлять только в поле панели: не в чат и не в терминал.

Панель пространства:
3. http://localhost:3777 → создать пространство без пароля. Ряд создателя: [Битрикс24 ⌄] [Пароль] [корзина]. Панель Битрикс24 и панель пароля не открыты одновременно.
4. Ввести `https://example.com/x` → «Это не похоже на входящий вебхук…», поле трясётся, введённое не стёрто.
5. Настоящий адрес с изменённым последним символом кода → «Портал отклонил вебхук. Проверьте, что он не удалён и не истёк.»
6. Настоящий адрес и группа `2014`:
   - «Подключено», «Битрикс24 · bitrix24.team», аватар-инициал, «Задачи создаёт: {Имя Фамилия}», группа «2014 · {название}»;
   - с вебхуком `to-task` — «2014» без названия и сообщение «Название группы недоступно…».
7. Перезагрузить страницу — состояние то же. Проверить утечки:
   - DevTools → Network: поиск `/rest/` по ответам страницы и `__data.json` ничего не находит;
   - `docker compose logs app 2>&1 | grep -c "/rest/"` → `0`;
   - `docker compose exec db psql -U retro -d retro -c "select portal, user_id, time_zone, portal_offset, group_id, group_name, position('/rest/' in webhook_enc) from space_bitrix"`: `time_zone` — зона профиля (например `Europe/Kaliningrad`), `portal_offset` вида `+03:00`, `position` = `0`, то есть вебхук зашифрован.
8. Карандаш группы → очистить → «Сохранить» → «не задана». Вернуть `2014`.

Задача с карточки:
9. Создать доску в пространстве. Добавить карточки:
   - многострочную, с первой строкой длиннее 100 символов;
   - карточку с картинкой;
   - два комментария, один без имени;
   - несколько голосов.

   У создателя первая иконка карточки — «квадрат с галочкой» с подсказкой «В задачу Битрикс24»; у переноса, правки и удаления тоже есть подсказки.
10. Открыть форму и проверить:
    - название — первая строка, обрезанная по слову, с «…»;
    - описание: текст карточки, «Из ретро «…» · колонка «…»», ссылка `http://localhost:3777/{slug}`, автор и голоса, комментарии (без имени — «Аноним»);
    - группа `2014`, срок пуст, нельзя выбрать дату раньше сегодняшней;
    - Escape и клик по фону закрывают форму.
11. Указать срок, включить «Важная задача», нажать «Создать задачу».
    - В форме: спиннер «Создаём…», Escape не закрывает; затем тост «Задача #N создана», «Открыть» ведёт в новую вкладку.
    - В портале: задача в группе 2014; постановщик и ответственный — владелец вебхука; срок — выбранная дата, 19:00 по зоне профиля; высокий приоритет; тег `retro`; переносы строк на месте; ссылка на доску кликается.
12. Окно инкогнито по ссылке доски: бейдж «Задача #N» появился без перезагрузки, кнопки создания нет, бейдж открывается в новой вкладке. У создателя на этой карточке кнопки больше нет.
13. Карточка с картинкой: подпись «Создаём и прикрепляем картинку…», тост без предупреждения. В задаче вложение `retro-{cardId}.webp`, файл лежит в корне Диска владельца.
14. В форме ввести группу `999999999`:
    - с полным набором прав через ~400 мс появится «Группа не найдена — проверьте id или очистите поле»;
    - с вебхуком без «Рабочих групп соцсети» строка останется пустой, а отправка даст «Группа не найдена или недоступна» с подсветкой поля.

    Очистить поле — задача создаётся без группы.

«Итоги», экспорт, вид:
15. «Итоги» → «Обсудить» → на карточке без задачи «В задачу» в ряду управления → создать. На месте кнопки появился бейдж, таймер обсуждения не сбросился. В обычных строках ссылка «#N» кликается.
16. `http://localhost:3777/api/v1/boards/{slug}/export.json`: у карточек с задачей `"task": { "id": N, "url": "https://bitrix24.team/…" }`, у остальных `null`. В `.md` под карточкой строка «Задача» со ссылкой.
17. Тёмная тема и переключатель EN: панель, форма, бейдж и тосты читаются, все строки переведены.
18. DevTools, ширина 375 px: форма — лист во весь экран, шапка и кнопки прилипают, «Создать задачу» видна. Бейдж на карточке 40 px и переносится на вторую строку вместе с автором.

Ошибки и отключение:
19. (По желанию.) В портале снять у вебхука право «Задачи» и создать задачу.
    - В форме: «У вебхука нет права «Задачи»…» и ссылка «Настройки пространства →».
    - Ссылка открывает панель с предупреждением «Вебхук перестал работать…».
    - Вернуть право и подключить заново — предупреждение исчезло.
20. «Отключить» → «Нажмите ещё раз — отключить» (3 с) → второй клик → «Отключено».
    - На доске после перезагрузки кнопки нет, бейджи на месте.
    - Пункт меню ⋯ «Подключить Битрикс24» ведёт на `?bitrix=1`: панель открыта, фокус в поле вебхука.
21. Включить пароль пространства и в другом браузере войти с паролем. Выключить и снова включить пароль: этому гостю после перезагрузки снова нужен пароль.

Уборка:
22. Удалить в портале тестовые задачи и файлы `retro-*.webp` в корне Диска владельца, удалить тестовое пространство. Если адрес вебхука попадал куда-то кроме поля панели, перевыпустить вебхук.
