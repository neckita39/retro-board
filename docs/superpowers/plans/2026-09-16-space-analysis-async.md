# Асинхронный анализ пространства — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Клик по «Анализ пространства» только запускает фоновую задачу; все в пространстве видят плитку с лоадером и уведомления «запущен / готов / ошибка» в правом верхнем углу; переходов нет.

**Architecture:** Состояние анализа — таблица `space_analyses` (pending / ready / failed); доска создаётся только при успехе. Form action вставляет pending и запускает задачу без ожидания; задача шлёт события в `globalThis.__retroBus`, `server.js` ретранслирует их в Socket.IO-комнату `space:{slug}`. Клиент держит состояние в `socketStore.analysis`, уведомления — общий `toastStore` в layout.

**Tech Stack:** SvelteKit (Svelte 5 runes), Drizzle ORM + PostgreSQL, Socket.IO, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-16-space-analysis-async-design.md` (поверх `2026-09-16-space-analysis-design.md`).

## Global Constraints

- Никаких редиректов после анализа. Уведомления — единственный канал статуса; плашка снизу из первой версии удаляется.
- Состояния: `pending` (живой — моложе `PENDING_STALE_MS = 5 * 60_000`), `ready` (с `board_id`), `failed`. Устаревший pending читается как `failed` с ошибкой `timeout`. Лимит: ready + живой pending за 24 ч, 3 и больше — отказ. Перед новой попыткой failed-записи удаляются.
- Payload состояния (и по сокету, и по HTTP):
  ```ts
  { state: 'idle' }
  | { state: 'pending'; id: string; title: string; createdAt: string }
  | { state: 'ready'; id: string; title: string; createdAt: string; board: { slug: string; title: string } }
  | { state: 'failed'; id: string; title: string; createdAt: string; error: string }
  ```
- Все строки через `t()`, ключи в обоих словарях. Tabs. Коммиты по-русски с `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Перед коммитом `npm test` и `npm run check` зелёные.
- В `src/routes/spaces/[slug]/+page.server.ts` уже есть импорты из первой версии (`env`, `db`, `spaces, boards, cards, votes`, `eq, sql, desc, inArray`, `nanoid`, `metric`, `decrypt, encrypt`, всё из `analysis.js`, `chatCompletion, DeepSeekError`) — их правят, а не добавляют заново.

---

### Task 1: Уведомления (стор, компонент, layout)

**Files:**
- Create: `src/lib/stores/toast.svelte.ts`
- Create: `src/lib/components/Toasts.svelte`
- Modify: `src/routes/+layout.svelte`
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/ru.json`
- Test: `src/lib/stores/toast.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ToastKind = 'info' | 'success' | 'error';
  export interface ToastInput { kind: ToastKind; text: string; action?: { label: string; href: string }; timeoutMs?: number }
  export interface Toast extends ToastInput { id: number }
  toastStore.toasts: Toast[]; toastStore.push(input): number; toastStore.dismiss(id): void; toastStore.clear(): void
  ```
  Таймаут по умолчанию 8000 мс, для `error` 12000.

- [ ] **Step 1: Падающий тест**

`src/lib/stores/toast.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toastStore } from './toast.svelte.js';

describe('toastStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		toastStore.clear();
	});
	afterEach(() => vi.useRealTimers());

	it('push добавляет уведомление, dismiss убирает', () => {
		const id = toastStore.push({ kind: 'info', text: 'hi' });
		expect(toastStore.toasts).toHaveLength(1);
		expect(toastStore.toasts[0]).toMatchObject({ id, kind: 'info', text: 'hi' });
		toastStore.dismiss(id);
		expect(toastStore.toasts).toHaveLength(0);
	});

	it('само скрывается через 8 с, ошибка — через 12 с', () => {
		toastStore.push({ kind: 'success', text: 'ok' });
		toastStore.push({ kind: 'error', text: 'bad' });
		vi.advanceTimersByTime(8_000);
		expect(toastStore.toasts.map((t) => t.text)).toEqual(['bad']);
		vi.advanceTimersByTime(4_000);
		expect(toastStore.toasts).toHaveLength(0);
	});

	it('явный timeoutMs побеждает дефолт, стопка сохраняет порядок', () => {
		toastStore.push({ kind: 'info', text: 'a', timeoutMs: 1_000 });
		toastStore.push({ kind: 'info', text: 'b' });
		expect(toastStore.toasts.map((t) => t.text)).toEqual(['a', 'b']);
		vi.advanceTimersByTime(1_000);
		expect(toastStore.toasts.map((t) => t.text)).toEqual(['b']);
	});
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run src/lib/stores/toast.test.ts` → FAIL, модуль не найден.

- [ ] **Step 3: Стор**

`src/lib/stores/toast.svelte.ts`:

```ts
// Уведомления в правом верхнем углу. Живут в layout, поэтому переживают
// переходы между страницами: «AI-анализ готов» догонит, куда бы ни ушёл человек.
export type ToastKind = 'info' | 'success' | 'error';

export interface ToastInput {
	kind: ToastKind;
	text: string;
	action?: { label: string; href: string };
	timeoutMs?: number;
}

export interface Toast extends ToastInput {
	id: number;
}

const DEFAULT_TIMEOUT_MS = 8_000;
const ERROR_TIMEOUT_MS = 12_000;

class ToastStore {
	toasts = $state<Toast[]>([]);
	private nextId = 1;
	private timers = new Map<number, ReturnType<typeof setTimeout>>();

	push(input: ToastInput): number {
		const id = this.nextId++;
		this.toasts = [...this.toasts, { ...input, id }];
		const timeout = input.timeoutMs ?? (input.kind === 'error' ? ERROR_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
		this.timers.set(id, setTimeout(() => this.dismiss(id), timeout));
		return id;
	}

	dismiss(id: number) {
		const timer = this.timers.get(id);
		if (timer) clearTimeout(timer);
		this.timers.delete(id);
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	clear() {
		for (const id of [...this.timers.keys()]) this.dismiss(id);
		this.toasts = [];
	}
}

export const toastStore = new ToastStore();
```

- [ ] **Step 4: Прогнать тест**

Run: `npx vitest run src/lib/stores/toast.test.ts` → PASS (3).

- [ ] **Step 5: Компонент и layout**

`src/lib/components/Toasts.svelte`:

```svelte
<script lang="ts">
	import { toastStore } from '$lib/stores/toast.svelte.js';
	import { t } from '$lib/i18n/index.js';
</script>

<!-- Стопка уведомлений: правый верхний угол, стиль карточек сайта -->
<div class="pointer-events-none fixed right-4 top-4 z-[700] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2.5" aria-live="polite">
	{#each toastStore.toasts as toast (toast.id)}
		<div
			role={toast.kind === 'error' ? 'alert' : 'status'}
			data-testid="toast"
			data-kind={toast.kind}
			class="card-enter pointer-events-auto flex items-start gap-3 rounded-2xl border border-border bg-surface-card px-4 py-3 shadow-xl"
		>
			<span
				class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full
					{toast.kind === 'success' ? 'bg-well-bg text-well-strong' : toast.kind === 'error' ? 'bg-bad-bg text-bad-strong' : 'badge-ai'}"
				aria-hidden="true"
			>
				{#if toast.kind === 'success'}
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
				{:else if toast.kind === 'error'}
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="17" r="0.6"/></svg>
				{:else}
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
				{/if}
			</span>
			<div class="flex min-w-0 flex-1 flex-col gap-1.5">
				<p class="text-[13.5px] leading-snug text-text-primary">{toast.text}</p>
				{#if toast.action}
					<a
						href={toast.action.href}
						onclick={() => toastStore.dismiss(toast.id)}
						class="self-start text-[13px] font-bold text-accent hover:underline"
					>
						{toast.action.label} →
					</a>
				{/if}
			</div>
			<button
				onclick={() => toastStore.dismiss(toast.id)}
				class="btn-icon shrink-0 text-text-muted hover:text-text-primary"
				aria-label={t('toast.close')}
			>
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</div>
	{/each}
</div>
```

В `src/routes/+layout.svelte`: `import Toasts from '$lib/components/Toasts.svelte';` и `<Toasts />` после `<FeedbackFab />`.

Словари: `"toast.close": "Close"` / `"toast.close": "Закрыть"` (после `"card.cancel"`).

- [ ] **Step 6: Проверить и закоммитить**

Run: `npm run check && npm test`

```bash
git add src/lib/stores/toast.svelte.ts src/lib/stores/toast.test.ts src/lib/components/Toasts.svelte src/routes/+layout.svelte src/lib/i18n/en.json src/lib/i18n/ru.json
git commit -m "Уведомления: стор и стопка в правом верхнем углу

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Таблица `space_analyses` и чистая логика состояний

**Files:**
- Create: `drizzle/0006_space_analyses.sql`
- Modify: `src/lib/server/db/schema.ts`
- Create: `src/lib/analysis-state.ts` (общие типы клиент/сервер + переходы уведомлений)
- Modify: `src/lib/server/analysis.ts` (убрать `runOnce`, добавить функции состояний)
- Test: `src/lib/server/analysis.test.ts`, `src/lib/analysis-state.test.ts`

**Interfaces:**
- Produces (`src/lib/analysis-state.ts`):
  ```ts
  export type AnalysisState = { state: 'idle' } | { state: 'pending'; id; title; createdAt } | { state: 'ready'; id; title; createdAt; board: { slug; title } } | { state: 'failed'; id; title; createdAt; error };
  export type AnalysisTransition = 'started' | 'ready' | 'failed';
  export function analysisTransition(prev: AnalysisState | null, next: AnalysisState): AnalysisTransition | null;
  ```
- Produces (`src/lib/server/analysis.ts`):
  ```ts
  export interface AnalysisRow { id: string; state: 'pending' | 'ready' | 'failed'; error: string | null; title: string; boardSlug: string; boardId: string | null; createdAt: Date }
  export const PENDING_STALE_MS = 5 * 60_000;
  export function effectiveRow(row: AnalysisRow, now: Date): AnalysisRow;      // устаревший pending → failed/timeout
  export function livePending(rows: AnalysisRow[], now: Date): AnalysisRow | null;
  export function latestReady(rows: AnalysisRow[]): AnalysisRow | null;        // ready с boardId
  export function limitRows(rows: AnalysisRow[], now: Date): AnalysisRow[];    // ready + живой pending
  export function rowToState(row: AnalysisRow, now: Date): AnalysisState;
  export function statePayload(rows: AnalysisRow[], now: Date): AnalysisState;
  ```

- [ ] **Step 1: Падающие тесты**

`src/lib/analysis-state.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { analysisTransition, type AnalysisState } from './analysis-state.js';

const pending: AnalysisState = { state: 'pending', id: 'a1', title: 'T', createdAt: '2026-09-16T10:00:00Z' };
const ready: AnalysisState = { state: 'ready', id: 'a1', title: 'T', createdAt: '2026-09-16T10:00:00Z', board: { slug: 's', title: 'T' } };
const failed: AnalysisState = { state: 'failed', id: 'a1', title: 'T', createdAt: '2026-09-16T10:00:00Z', error: 'http' };

describe('analysisTransition — когда показывать уведомление', () => {
	it('первое применение молчит', () => {
		expect(analysisTransition(null, pending)).toBeNull();
		expect(analysisTransition(null, ready)).toBeNull();
	});
	it('idle → pending: запущен; pending → ready: готов; pending → failed: ошибка', () => {
		expect(analysisTransition({ state: 'idle' }, pending)).toBe('started');
		expect(analysisTransition(pending, ready)).toBe('ready');
		expect(analysisTransition(pending, failed)).toBe('failed');
	});
	it('то же состояние с тем же id не повторяет уведомление', () => {
		expect(analysisTransition(pending, { ...pending })).toBeNull();
		expect(analysisTransition(ready, { ...ready })).toBeNull();
	});
	it('новая попытка после failed или ready — снова «запущен»', () => {
		expect(analysisTransition(failed, { ...pending, id: 'a2' })).toBe('started');
		expect(analysisTransition(ready, { ...pending, id: 'a2' })).toBe('started');
	});
	it('переход в idle молчит', () => {
		expect(analysisTransition(ready, { state: 'idle' })).toBeNull();
	});
});
```

В `src/lib/server/analysis.test.ts` заменить `describe('runOnce …')` целиком на:

```ts
describe('состояния анализа', () => {
	const now = d('2026-09-16T12:00:00Z');
	const row = (id: string, state: 'pending' | 'ready' | 'failed', createdAt: string, extra: Partial<AnalysisRow> = {}): AnalysisRow => ({
		id, state, error: null, title: `Analysis ${id}`, boardSlug: `slug-${id}`, boardId: state === 'ready' ? `board-${id}` : null, createdAt: d(createdAt), ...extra
	});

	it('pending моложе 5 минут живой, старше — failed/timeout', () => {
		const fresh = row('p1', 'pending', '2026-09-16T11:58:00Z');
		const stale = row('p2', 'pending', '2026-09-16T11:50:00Z');
		expect(livePending([fresh], now)?.id).toBe('p1');
		expect(livePending([stale], now)).toBeNull();
		expect(effectiveRow(stale, now)).toMatchObject({ state: 'failed', error: 'timeout' });
		expect(effectiveRow(fresh, now).state).toBe('pending');
		expect(PENDING_STALE_MS).toBe(300_000);
	});

	it('latestReady — самая новая ready с доской; без доски не считается', () => {
		const rows = [
			row('r1', 'ready', '2026-09-10T10:00:00Z'),
			row('r2', 'ready', '2026-09-12T10:00:00Z', { boardId: null }),
			row('f1', 'failed', '2026-09-13T10:00:00Z')
		];
		expect(latestReady(rows)?.id).toBe('r1');
		expect(latestReady([])).toBeNull();
	});

	it('limitRows — ready и живой pending, без failed и устаревших', () => {
		const rows = [
			row('r1', 'ready', '2026-09-16T09:00:00Z'),
			row('p1', 'pending', '2026-09-16T11:59:00Z'),
			row('p2', 'pending', '2026-09-16T11:00:00Z'),
			row('f1', 'failed', '2026-09-16T10:00:00Z')
		];
		expect(limitRows(rows, now).map((r) => r.id).sort()).toEqual(['p1', 'r1']);
	});

	it('statePayload — живой pending важнее всего, иначе самая новая запись', () => {
		expect(statePayload([], now)).toEqual({ state: 'idle' });
		const p = row('p1', 'pending', '2026-09-16T11:59:00Z');
		const r = row('r1', 'ready', '2026-09-16T11:00:00Z');
		expect(statePayload([r, p], now)).toEqual({ state: 'pending', id: 'p1', title: 'Analysis p1', createdAt: '2026-09-16T11:59:00.000Z' });
		expect(statePayload([r], now)).toEqual({
			state: 'ready', id: 'r1', title: 'Analysis r1', createdAt: '2026-09-16T11:00:00.000Z', board: { slug: 'slug-r1', title: 'Analysis r1' }
		});
		const f = row('f1', 'failed', '2026-09-16T11:30:00Z', { error: 'http' });
		expect(statePayload([r, f], now)).toEqual({ state: 'failed', id: 'f1', title: 'Analysis f1', createdAt: '2026-09-16T11:30:00.000Z', error: 'http' });
		const staleP = row('p2', 'pending', '2026-09-16T11:40:00Z');
		expect(statePayload([r, staleP], now)).toMatchObject({ state: 'failed', id: 'p2', error: 'timeout' });
		const gone = row('r2', 'ready', '2026-09-16T11:45:00Z', { boardId: null });
		expect(statePayload([gone], now)).toEqual({ state: 'idle' });
	});
});
```

Импорт в этом файле: убрать `runOnce`, добавить `effectiveRow, livePending, latestReady, limitRows, statePayload, PENDING_STALE_MS, type AnalysisRow`.

- [ ] **Step 2: Убедиться, что падают**

Run: `npx vitest run src/lib/analysis-state.test.ts src/lib/server/analysis.test.ts` → FAIL (модуль/функции отсутствуют).

- [ ] **Step 3: Миграция и схема**

`drizzle/0006_space_analyses.sql`:

```sql
CREATE TABLE IF NOT EXISTS "space_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
	"state" text NOT NULL DEFAULT 'pending',
	"error" text,
	"title" text NOT NULL,
	"locale" text NOT NULL DEFAULT 'en',
	"board_slug" text NOT NULL,
	"creator_token" text NOT NULL,
	"board_id" uuid REFERENCES "boards"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_analyses_space_created_idx" ON "space_analyses" ("space_id", "created_at");
```

В `src/lib/server/db/schema.ts` после `boards`:

```ts
// Ход AI-анализа пространства: pending → ready (доска создана) | failed.
// Доска-анализ появляется только при успехе, поэтому состояние живёт отдельно.
export const spaceAnalyses = pgTable('space_analyses', {
	id: uuid('id').primaryKey().defaultRandom(),
	spaceId: uuid('space_id')
		.notNull()
		.references(() => spaces.id, { onDelete: 'cascade' }),
	state: text('state').notNull().default('pending'),
	error: text('error'),
	title: text('title').notNull(),
	locale: text('locale').notNull().default('en'),
	// slug и токен будущей доски генерируются при старте: нажавший сразу получает cookie
	boardSlug: text('board_slug').notNull(),
	creatorToken: text('creator_token').notNull(),
	boardId: uuid('board_id').references(() => boards.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	finishedAt: timestamp('finished_at', { withTimezone: true })
});
```

- [ ] **Step 4: `src/lib/analysis-state.ts`**

```ts
// Состояние AI-анализа пространства, общее для сервера и клиента: то, что
// приходит по сокету и из GET /spaces/{slug}/analysis, и правило, когда
// смена состояния заслуживает уведомления.
export type AnalysisState =
	| { state: 'idle' }
	| { state: 'pending'; id: string; title: string; createdAt: string }
	| { state: 'ready'; id: string; title: string; createdAt: string; board: { slug: string; title: string } }
	| { state: 'failed'; id: string; title: string; createdAt: string; error: string };

export type AnalysisTransition = 'started' | 'ready' | 'failed';

/**
 * null — молчим: первое применение (страница только загрузилась), то же
 * состояние повторно, или переход в idle. Иначе — какое уведомление показать.
 */
export function analysisTransition(prev: AnalysisState | null, next: AnalysisState): AnalysisTransition | null {
	if (!prev) return null;
	if (next.state === 'idle') return null;
	if (prev.state === next.state && 'id' in prev && prev.id === next.id) return null;
	if (next.state === 'pending') return 'started';
	return next.state;
}
```

- [ ] **Step 5: Функции состояний в `src/lib/server/analysis.ts`**

Удалить блок `runOnce` (комментарий, `inFlight`, функцию). Добавить импорт `import type { AnalysisState } from '$lib/analysis-state.js';` и в конец файла:

```ts
export interface AnalysisRow {
	id: string;
	state: 'pending' | 'ready' | 'failed';
	error: string | null;
	title: string;
	boardSlug: string;
	boardId: string | null;
	createdAt: Date;
}

/** pending старше этого — сервер перезапустился посреди работы, задача потеряна */
export const PENDING_STALE_MS = 5 * 60_000;

export function effectiveRow(row: AnalysisRow, now: Date): AnalysisRow {
	if (row.state === 'pending' && now.getTime() - row.createdAt.getTime() > PENDING_STALE_MS) {
		return { ...row, state: 'failed', error: 'timeout' };
	}
	return row;
}

export function livePending(rows: AnalysisRow[], now: Date): AnalysisRow | null {
	return rows.map((r) => effectiveRow(r, now)).find((r) => r.state === 'pending') ?? null;
}

/** Самая новая ready-запись, у которой доска ещё существует */
export function latestReady(rows: AnalysisRow[]): AnalysisRow | null {
	return (
		[...rows]
			.filter((r) => r.state === 'ready' && r.boardId)
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
	);
}

/** Что считается в лимит «3 в сутки»: успешные и идущие; упавшие — нет */
export function limitRows(rows: AnalysisRow[], now: Date): AnalysisRow[] {
	return rows.map((r) => effectiveRow(r, now)).filter((r) => r.state === 'ready' || r.state === 'pending');
}

export function rowToState(row: AnalysisRow, now: Date): AnalysisState {
	const r = effectiveRow(row, now);
	const base = { id: r.id, title: r.title, createdAt: r.createdAt.toISOString() };
	if (r.state === 'pending') return { state: 'pending', ...base };
	if (r.state === 'failed') return { state: 'failed', ...base, error: r.error ?? 'network' };
	if (!r.boardId) return { state: 'idle' };
	return { state: 'ready', ...base, board: { slug: r.boardSlug, title: r.title } };
}

/** Живой pending важнее всего; иначе говорит самая новая запись */
export function statePayload(rows: AnalysisRow[], now: Date): AnalysisState {
	const pending = livePending(rows, now);
	if (pending) return rowToState(pending, now);
	const newest = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
	return newest ? rowToState(newest, now) : { state: 'idle' };
}
```

- [ ] **Step 6: Прогнать, проверить типы, закоммитить**

Run: `npx vitest run src/lib/analysis-state.test.ts src/lib/server/analysis.test.ts && npm run check`

`npm run check` упадёт на `runOnce` в `+page.server.ts` — это ожидаемо до Task 4; на этом шаге временно оставить импорт `runOnce` убранным и заменить в action `slug = await runOnce(space.id, async () => {` на `slug = await (async () => {` и закрывающую `});` на `})();`. Task 4 всё равно переписывает action.

```bash
git add drizzle/0006_space_analyses.sql src/lib/server/db/schema.ts src/lib/analysis-state.ts src/lib/analysis-state.test.ts src/lib/server/analysis.ts src/lib/server/analysis.test.ts src/routes/spaces/[slug]/+page.server.ts
git commit -m "Асинхронный анализ: таблица space_analyses и логика состояний

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Шина событий, комната пространства, стор сокета

**Files:**
- Create: `src/lib/server/bus.ts`
- Modify: `server.js` (шина, `space:join`)
- Modify: `src/lib/stores/socket.svelte.ts`
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/ru.json`
- Test: `src/lib/server/bus.test.ts`

**Interfaces:**
- Produces: `emitSpace(spaceSlug: string, event: string, payload: unknown): boolean` (false — шины нет). Сокет-событие клиента `space:join { slug }`; сервер шлёт в комнату `space:{slug}` события из шины как есть. Стор: `socketStore.analysis: AnalysisState | null`, `joinSpace(slug)`, `seedAnalysis(state)`, `applyAnalysis(state)`, `refreshAnalysis()`.

- [ ] **Step 1: Падающий тест шины**

`src/lib/server/bus.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { emitSpace } from './bus.js';

const g = globalThis as { __retroBus?: unknown };

describe('emitSpace', () => {
	afterEach(() => {
		delete g.__retroBus;
	});

	it('без шины (npm run dev) возвращает false и не падает', () => {
		expect(emitSpace('sp', 'analysis:state', { state: 'idle' })).toBe(false);
	});

	it('с шиной шлёт событие space с slug, именем и payload', () => {
		const seen: unknown[] = [];
		g.__retroBus = { emit: (name: string, msg: unknown) => seen.push([name, msg]) };
		expect(emitSpace('sp', 'analysis:state', { state: 'idle' })).toBe(true);
		expect(seen).toEqual([['space', { spaceSlug: 'sp', event: 'analysis:state', payload: { state: 'idle' } }]]);
	});
});
```

Run: `npx vitest run src/lib/server/bus.test.ts` → FAIL.

- [ ] **Step 2: `src/lib/server/bus.ts`**

```ts
// Мост SvelteKit → Socket.IO. Сокет-сервер живёт в server.js в том же процессе
// и кладёт EventEmitter в globalThis; здесь мы только кидаем в него события.
// В npm run dev шины нет — события молча теряются.
export interface SpaceBusMessage {
	spaceSlug: string;
	event: string;
	payload: unknown;
}

interface Bus {
	emit(name: 'space', msg: SpaceBusMessage): unknown;
}

export function emitSpace(spaceSlug: string, event: string, payload: unknown): boolean {
	const bus = (globalThis as { __retroBus?: Bus }).__retroBus;
	if (!bus) return false;
	bus.emit('space', { spaceSlug, event, payload });
	return true;
}
```

Run: `npx vitest run src/lib/server/bus.test.ts` → PASS.

- [ ] **Step 3: `server.js`**

Импорт: `import { EventEmitter } from 'events';`. Сразу после импортов:

```js
// Шина SvelteKit → Socket.IO: form action анализа пространства шлёт сюда события,
// а мы ретранслируем их комнате space:{slug}. Один процесс, поэтому globalThis хватает.
const bus = new EventEmitter();
globalThis.__retroBus = bus;
```

После создания `io` (после `const roomFocus = new Map();` блока констант, перед `io.on('connection'`):

```js
bus.on('space', ({ spaceSlug, event, payload }) => {
	if (typeof spaceSlug !== 'string' || typeof event !== 'string') return;
	io.to(`space:${spaceSlug}`).emit(event, payload);
});
```

В `io.on('connection', (socket) => {` после `let socketCreatorToken = '';`:

```js
	// Комната пространства: только статус AI-анализа, содержимого досок в ней нет,
	// поэтому проверок доступа не делаем — slug пространства и так неугадываем
	let currentSpace = null;

	socket.on('space:join', (payload) => {
		const slug = payload?.slug;
		if (typeof slug !== 'string' || !slug || slug.length > 64) return;
		if (currentSpace) socket.leave(`space:${currentSpace}`);
		currentSpace = slug;
		socket.join(`space:${slug}`);
	});
```

- [ ] **Step 4: Стор сокета**

В `src/lib/stores/socket.svelte.ts`:

```ts
import { io, type Socket } from 'socket.io-client';
import { boardStore } from './board.svelte.js';
import { toastStore } from './toast.svelte.js';
import { t } from '$lib/i18n/index.js';
import { analysisTransition, type AnalysisState } from '$lib/analysis-state.js';
```

Поля после `focusDiscussed`:

```ts
	/** Статус AI-анализа текущего пространства; null — пространство не подключено */
	analysis = $state<AnalysisState | null>(null);

	private currentSpace: string | null = null;
```

В обработчике `connect` после блока `board:join`:

```ts
			if (this.everConnected && this.currentSpace) {
				this.socket?.emit('space:join', { slug: this.currentSpace });
				void this.refreshAnalysis();
			}
```

После `this.socket.on('focus:state', …)`:

```ts
		this.socket.on('analysis:state', (state: AnalysisState) => {
			this.applyAnalysis(state);
		});
```

Методы после `joinBoard`:

```ts
	/** Комната пространства — статус анализа для всех, кто в нём. Первый статус
	 *  добираем по HTTP: задача могла закончиться, пока сокет подключался. */
	joinSpace(slug: string) {
		this.currentSpace = slug;
		this.socket?.emit('space:join', { slug });
		void this.refreshAnalysis();
	}

	async refreshAnalysis() {
		const slug = this.currentSpace;
		if (!slug) return;
		try {
			const res = await fetch(`/spaces/${slug}/analysis`);
			if (!res.ok) return;
			const state = (await res.json()) as AnalysisState;
			if (this.currentSpace === slug) this.applyAnalysis(state);
		} catch {
			// сеть моргнула — следующий сокет-ивент или реконнект всё поправят
		}
	}

	/** Состояние из данных страницы: молча, если ещё ничего не знали */
	seedAnalysis(state: AnalysisState | null) {
		if (!state) return;
		if (this.analysis === null) this.analysis = state;
		else this.applyAnalysis(state);
	}

	applyAnalysis(next: AnalysisState) {
		const transition = analysisTransition(this.analysis, next);
		this.analysis = next;
		if (!transition || next.state === 'idle') return;
		if (transition === 'started') {
			toastStore.push({ kind: 'info', text: t('space.analysis.toast.started', { title: next.title }) });
		} else if (transition === 'ready' && next.state === 'ready') {
			toastStore.push({
				kind: 'success',
				text: t('space.analysis.toast.ready', { title: next.title }),
				action: { label: t('space.analysis.toast.open'), href: `/${next.board.slug}` }
			});
		} else if (transition === 'failed' && next.state === 'failed') {
			toastStore.push({ kind: 'error', text: t(`space.analysis.error.${next.error}`) });
		}
	}
```

В `disconnect()` добавить `this.currentSpace = null; this.analysis = null;`.

- [ ] **Step 5: Словарь**

en (после `"space.analysis.error.empty"`; ключ `"space.analysis.running"` удалить из обоих словарей):

```json
	"space.analysis.error.running": "An analysis is already running",
	"space.analysis.toast.started": "Space analysis started — usually under a minute",
	"space.analysis.toast.ready": "AI analysis is ready: {title}",
	"space.analysis.toast.open": "Open",
	"space.analysis.toast.cached": "The analysis is up to date — no new boards since the last one",
	"space.analysis.tile.pending": "Analysing…",
	"space.analysis.tile.failed": "Analysis failed",
	"space.analysis.tile.retry": "Retry",
```

ru:

```json
	"space.analysis.error.running": "Анализ уже идёт",
	"space.analysis.toast.started": "Анализ пространства запущен — обычно до минуты",
	"space.analysis.toast.ready": "AI-анализ готов: {title}",
	"space.analysis.toast.open": "Открыть",
	"space.analysis.toast.cached": "Анализ актуален — новых досок с прошлого раза не было",
	"space.analysis.tile.pending": "Анализируем…",
	"space.analysis.tile.failed": "Анализ не удался",
	"space.analysis.tile.retry": "Повторить",
```

- [ ] **Step 6: Проверить и закоммитить**

Run: `npm run check && npm test` (AnalyzeButton ещё ссылается на `space.analysis.running` — заменить там `t('space.analysis.running')` на `t('space.analysis.toast.started')`, компонент переписывается в Task 5).

```bash
git add src/lib/server/bus.ts src/lib/server/bus.test.ts server.js src/lib/stores/socket.svelte.ts src/lib/i18n/en.json src/lib/i18n/ru.json src/lib/components/AnalyzeButton.svelte
git commit -m "Асинхронный анализ: шина SvelteKit → Socket.IO, комната пространства, статус в сторе

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Сервер — action `analyze`, фоновая задача, endpoint состояния, данные страниц

**Files:**
- Create: `src/lib/server/analysis-job.ts`
- Create: `src/routes/spaces/[slug]/analysis/+server.ts`
- Modify: `src/routes/spaces/[slug]/+page.server.ts` (load + action)
- Modify: `src/routes/[slug]/+page.server.ts` (load: `analysis`)

**Interfaces:**
- Consumes: Task 2 (`spaceAnalyses`, функции состояний), Task 3 (`emitSpace`).
- Produces: action `analyze` отвечает `{ analysis: 'started' }` | `{ analysis: 'cached', boardSlug }` | `fail(status, { analysis: kind, retryInHours? })`, `kind ∈ not_configured | running | limit | no_cards`. `GET /spaces/{slug}/analysis` → `AnalysisState`. В данных страниц пространства и доски: `analysis: AnalysisState | null`.

- [ ] **Step 1: Фоновая задача `src/lib/server/analysis-job.ts`**

```ts
// Фоновая часть анализа: DeepSeek → доска с карточками → запись ready, или
// запись failed. Запускается из action без ожидания; о результате всем в
// пространстве сообщает шина. Ключ и текст карточек в логи не попадают.
import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { boards, cards, spaceAnalyses } from './db/schema.js';
import { ANALYSIS_FORMAT } from '$lib/formats.js';
import { encrypt } from './crypto.js';
import { metric } from './statsd.js';
import { emitSpace } from './bus.js';
import { chatCompletion, DeepSeekError } from './deepseek.js';
import {
	ANALYSIS_COLUMNS,
	AnalysisFailure,
	analysisAuthor,
	buildPrompt,
	cardText,
	isEmptyAnalysis,
	parseAnalysis,
	rowToState,
	type AnalysisEntry,
	type AnalysisLocale,
	type AnalysisRow
} from './analysis.js';

export interface AnalysisJobInput {
	row: AnalysisRow & { spaceId: string; creatorToken: string };
	spaceSlug: string;
	entries: AnalysisEntry[];
	locale: AnalysisLocale;
	apiKey: string;
	apiBase?: string;
}

function failureKind(err: unknown): string {
	if (err instanceof DeepSeekError) return err.kind === 'shape' ? 'bad_response' : err.kind;
	if (err instanceof AnalysisFailure) return err.kind;
	return 'network';
}

export async function runAnalysisJob(input: AnalysisJobInput): Promise<void> {
	const { row, spaceSlug, entries, locale } = input;
	const started = Date.now();
	try {
		const raw = await chatCompletion(buildPrompt(entries, locale), { apiKey: input.apiKey, apiBase: input.apiBase });
		const result = parseAnalysis(raw);
		if (!result) throw new AnalysisFailure('bad_response');
		if (isEmptyAnalysis(result)) throw new AnalysisFailure('empty');

		const author = encrypt(analysisAuthor(locale));
		const finishedAt = new Date();
		let boardId = '';
		await db.transaction(async (tx) => {
			const [created] = await tx
				.insert(boards)
				.values({ title: row.title, slug: row.boardSlug, creatorToken: row.creatorToken, spaceId: row.spaceId, format: ANALYSIS_FORMAT })
				.returning({ id: boards.id });
			boardId = created.id;
			const rows = (['well', 'bad', 'improve'] as const).flatMap((key) =>
				result[key].map((item) => ({
					boardId: created.id,
					columnType: ANALYSIS_COLUMNS[key],
					content: encrypt(cardText(item, locale)) ?? '',
					authorName: author
				}))
			);
			if (rows.length) await tx.insert(cards).values(rows);
			await tx.update(spaceAnalyses).set({ state: 'ready', boardId: created.id, finishedAt }).where(eq(spaceAnalyses.id, row.id));
		});

		const ms = Date.now() - started;
		metric('retro.analysis.created', 1);
		metric('retro.analysis.duration_ms', ms, 'ms');
		console.info(JSON.stringify({ event: 'analysis:created', space: spaceSlug, cards: entries.length, ms }));
		emitSpace(spaceSlug, 'analysis:state', rowToState({ ...row, state: 'ready', boardId }, finishedAt));
	} catch (err) {
		const kind = failureKind(err);
		metric(`retro.analysis.failed.${kind}`, 1);
		console.warn(JSON.stringify({ event: 'analysis:failed', space: spaceSlug, kind, status: (err as DeepSeekError)?.status ?? null }));
		const finishedAt = new Date();
		try {
			await db.update(spaceAnalyses).set({ state: 'failed', error: kind, finishedAt }).where(eq(spaceAnalyses.id, row.id));
		} catch (dbErr) {
			console.error(JSON.stringify({ event: 'analysis:failed', space: spaceSlug, kind: 'db', message: (dbErr as Error)?.message }));
		}
		emitSpace(spaceSlug, 'analysis:state', rowToState({ ...row, state: 'failed', error: kind }, finishedAt));
	}
}
```

- [ ] **Step 2: Общий доступ и endpoint состояния**

В `src/routes/spaces/[slug]/+page.server.ts` рядом с импортами добавить и экспортировать хелпер (его использует и endpoint):

Создать `src/lib/server/space-access.ts`:

```ts
import type { Cookies } from '@sveltejs/kit';

/** Кто может смотреть пространство: пароля нет, пароль введён или это создатель */
export function canViewSpace(
	space: { slug: string; passwordHash: string | null; creatorToken: string },
	cookies: Cookies
): boolean {
	const creatorCookie = cookies.get(`retro_space_creator_${space.slug}`) ?? '';
	const isCreator = !!space.creatorToken && creatorCookie === space.creatorToken;
	if (!space.passwordHash) return true;
	return isCreator || !!cookies.get(`retro_space_${space.slug}`);
}
```

`src/routes/spaces/[slug]/analysis/+server.ts`:

```ts
import { json, error } from '@sveltejs/kit';
import { eq, desc } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { spaces, spaceAnalyses } from '$lib/server/db/schema.js';
import { statePayload } from '$lib/server/analysis.js';
import { canViewSpace } from '$lib/server/space-access.js';
import type { RequestHandler } from './$types.js';

// Текущее состояние AI-анализа: клиент дёргает после space:join и реконнекта,
// чтобы не проиграть гонку «задача закончилась, пока сокет подключался»
export const GET: RequestHandler = async ({ params, cookies }) => {
	const space = await db.query.spaces.findFirst({ where: eq(spaces.slug, params.slug) });
	if (!space) throw error(404, 'Space not found');
	if (!canViewSpace(space, cookies)) throw error(403, 'Forbidden');

	const rows = await db
		.select()
		.from(spaceAnalyses)
		.where(eq(spaceAnalyses.spaceId, space.id))
		.orderBy(desc(spaceAnalyses.createdAt));
	return json(statePayload(rows, new Date()), { headers: { 'cache-control': 'no-store' } });
};
```

- [ ] **Step 3: Load пространства и доски**

`src/routes/spaces/[slug]/+page.server.ts`, load: после запроса `spaceBoards` добавить

```ts
	const analysisRows = await db
		.select()
		.from(spaceAnalyses)
		.where(eq(spaceAnalyses.spaceId, space.id))
		.orderBy(desc(spaceAnalyses.createdAt));
```

и в основной `return` — `analysis: statePayload(analysisRows, new Date()),`; в ранний return (пароль) — `analysis: null,`. Импорт `spaceAnalyses` добавить в импорт схемы, `statePayload` — в импорт из `analysis.js`.

`src/routes/[slug]/+page.server.ts`: импорт `spaceAnalyses` в схему, `import { statePayload } from '$lib/server/analysis.js';`, `import { desc } from 'drizzle-orm'` (добавить к `eq, inArray`). В блоке, где найдено пространство `s`, после вычисления `spaceCreator`:

```ts
			const rows = await db
				.select()
				.from(spaceAnalyses)
				.where(eq(spaceAnalyses.spaceId, s.id))
				.orderBy(desc(spaceAnalyses.createdAt));
			analysis = statePayload(rows, new Date());
```

с объявлением `let analysis: AnalysisState | null = null;` рядом с `let space` (импорт типа `import type { AnalysisState } from '$lib/analysis-state.js';`) и `analysis,` в возвращаемом объекте.

- [ ] **Step 4: Action `analyze`**

Заменить целиком action `analyze` в `src/routes/spaces/[slug]/+page.server.ts`:

```ts
	// AI-анализ пространства: только запускает фоновую задачу и сразу отвечает.
	// О ходе дела всем в пространстве сообщает сокет (см. analysis-job.ts и bus.ts).
	analyze: async ({ request, params, cookies }) => {
		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404);
		if (!canViewSpace(space, cookies)) throw error(403, 'Not authenticated');

		metric('retro.analysis.requested', 1);
		const failWith = (status: number, kind: string, extra: Record<string, unknown> = {}) => {
			metric(`retro.analysis.failed.${kind}`, 1);
			return fail(status, { analysis: kind, ...extra });
		};

		const apiKey = env.DEEPSEEK_API_KEY || '';
		if (!apiKey) return failWith(503, 'not_configured');

		const formData = await request.formData();
		const locale: AnalysisLocale = formData.get('locale') === 'ru' ? 'ru' : 'en';
		const now = new Date();

		const rows = await db
			.select()
			.from(spaceAnalyses)
			.where(eq(spaceAnalyses.spaceId, space.id))
			.orderBy(desc(spaceAnalyses.createdAt));
		if (livePending(rows, now)) return failWith(409, 'running');

		const regular = (
			await db
				.select({ id: boards.id, slug: boards.slug, title: boards.title, format: boards.format, createdAt: boards.createdAt })
				.from(boards)
				.where(eq(boards.spaceId, space.id))
				.orderBy(desc(boards.createdAt))
		).filter((b) => !isAnalysisBoard(b));

		const ready = latestReady(rows);
		if (ready && cacheState(regular[0]?.createdAt ?? null, ready.createdAt) === 'fresh') {
			metric('retro.analysis.cached', 1);
			return { analysis: 'cached' as const, boardSlug: ready.boardSlug };
		}

		const window = analysesInWindow(limitRows(rows, now), now);
		if (window.count >= ANALYSIS_DAILY_LIMIT && window.oldestAt) {
			return failWith(429, 'limit', { retryInHours: retryInHours(window.oldestAt, now) });
		}

		const regularIds = regular.map((b) => b.id);
		const spaceCards = regularIds.length
			? await db
					.select({ id: cards.id, boardId: cards.boardId, columnType: cards.columnType, content: cards.content, createdAt: cards.createdAt })
					.from(cards)
					.where(inArray(cards.boardId, regularIds))
			: [];
		const cardIds = spaceCards.map((c) => c.id);
		const spaceVotes = cardIds.length
			? await db.select({ cardId: votes.cardId, type: votes.type }).from(votes).where(inArray(votes.cardId, cardIds))
			: [];
		const entries = collectCards(
			regular,
			spaceCards.map((c) => ({ ...c, content: decrypt(c.content) ?? '' })),
			spaceVotes
		);
		if (entries.length === 0) return failWith(400, 'no_cards');

		// Упавшие и брошенные попытки убираем: показывается только текущая
		await db
			.delete(spaceAnalyses)
			.where(and(eq(spaceAnalyses.spaceId, space.id), or(eq(spaceAnalyses.state, 'failed'), eq(spaceAnalyses.state, 'pending'))));

		const boardSlug = nanoid(21);
		const creatorToken = nanoid(32);
		const [row] = await db
			.insert(spaceAnalyses)
			.values({ spaceId: space.id, state: 'pending', title: analysisTitle(now, locale), locale, boardSlug, creatorToken })
			.returning();

		// Нажавший — создатель будущей доски, cookie ставим сразу
		cookies.set(`retro_creator_${boardSlug}`, creatorToken, {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		metric('retro.analysis.started', 1);
		emitSpace(params.slug, 'analysis:state', rowToState(row, now));

		void runAnalysisJob({
			row: { ...row, spaceId: space.id },
			spaceSlug: params.slug,
			entries,
			locale,
			apiKey,
			apiBase: env.DEEPSEEK_API_BASE || undefined
		});

		return { analysis: 'started' as const };
	}
```

Заметка: удаление pending здесь безопасно — живого pending нет (проверено выше), значит остались только устаревшие.

Импорты в этом файле привести к виду:

```ts
import { spaces, boards, cards, votes, spaceAnalyses } from '$lib/server/db/schema.js';
import { eq, sql, desc, inArray, and, or } from 'drizzle-orm';
import { decrypt } from '$lib/server/crypto.js';
import {
	ANALYSIS_DAILY_LIMIT,
	analysesInWindow,
	analysisTitle,
	cacheState,
	collectCards,
	isAnalysisBoard,
	latestReady,
	limitRows,
	livePending,
	retryInHours,
	rowToState,
	statePayload,
	type AnalysisLocale
} from '$lib/server/analysis.js';
import { emitSpace } from '$lib/server/bus.js';
import { runAnalysisJob } from '$lib/server/analysis-job.js';
import { canViewSpace } from '$lib/server/space-access.js';
```

(убрать `encrypt`, `ANALYSIS_FORMAT`, `ANALYSIS_COLUMNS`, `AnalysisFailure`, `analysisAuthor`, `buildPrompt`, `cardText`, `isEmptyAnalysis`, `parseAnalysis`, `chatCompletion`, `DeepSeekError` — они теперь в analysis-job.ts; `ANALYSIS_FORMAT` не нужен, если больше нигде в файле не используется — проверить `grep`).

- [ ] **Step 5: Проверить и закоммитить**

Run: `npm run check && npm test`

```bash
git add src/lib/server/analysis-job.ts src/lib/server/space-access.ts src/routes/spaces/[slug]/analysis/+server.ts src/routes/spaces/[slug]/+page.server.ts src/routes/[slug]/+page.server.ts
git commit -m "Асинхронный анализ: action запускает фоновую задачу, endpoint состояния

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Интерфейс — кнопка, плитки, страницы

**Files:**
- Modify: `src/lib/components/AnalyzeButton.svelte` (переписать)
- Modify: `src/lib/components/SpaceBoardGrid.svelte`
- Modify: `src/routes/spaces/[slug]/+page.svelte`
- Modify: `src/routes/[slug]/+page.svelte`

**Interfaces:**
- Consumes: `socketStore.analysis/joinSpace/seedAnalysis`, `toastStore`, данные `analysis` из Task 4.
- Produces: `<AnalyzeButton spaceSlug compact? variant='header'|'retry' />`; `<SpaceBoardGrid boards analysis spaceSlug onNewBoard />`; плитки `data-testid="analysis-pending"` и `data-testid="analysis-failed"`.

- [ ] **Step 1: AnalyzeButton**

Заменить файл целиком:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { toastStore } from '$lib/stores/toast.svelte.js';
	import { t } from '$lib/i18n/index.js';

	// header: кнопка в шапке (compact — на узких экранах только иконка);
	// retry: маленькая кнопка «Повторить» в плитке упавшего анализа.
	// Сервер отвечает сразу: задача идёт в фоне, «запущен / готов / ошибка»
	// приходят всем по сокету. Здесь только локальные ответы action.
	let {
		spaceSlug,
		compact = false,
		variant = 'header'
	}: { spaceSlug: string; compact?: boolean; variant?: 'header' | 'retry' } = $props();

	let busy = $state(false);
</script>

<form
	method="POST"
	action="/spaces/{spaceSlug}?/analyze"
	class="contents"
	use:enhance={() => {
		busy = true;
		return async ({ result }) => {
			busy = false;
			if (result.type === 'success') {
				const data = (result.data ?? {}) as { analysis?: string; boardSlug?: string };
				if (data.analysis === 'cached' && data.boardSlug) {
					toastStore.push({
						kind: 'info',
						text: t('space.analysis.toast.cached'),
						action: { label: t('space.analysis.toast.open'), href: `/${data.boardSlug}` }
					});
				}
			} else if (result.type === 'failure') {
				const data = (result.data ?? {}) as { analysis?: string; retryInHours?: number };
				toastStore.push({ kind: 'error', text: t(`space.analysis.error.${data.analysis ?? 'network'}`, { n: data.retryInHours ?? 0 }) });
			} else if (result.type === 'error') {
				toastStore.push({ kind: 'error', text: t('space.analysis.error.network') });
			}
		};
	}}
>
	<input type="hidden" name="locale" value={localeStore.locale} />
	{#if variant === 'retry'}
		<button type="submit" disabled={busy} class="btn btn-secondary btn-sm" data-testid="analyze-retry">
			{t('space.analysis.tile.retry')}
		</button>
	{:else}
		<button
			type="submit"
			disabled={busy}
			class="btn btn-ai btn-md"
			title={t('space.analysis.button')}
			aria-label={t('space.analysis.button')}
			data-testid="analyze-button"
		>
			<svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/></svg>
			<span class={compact ? 'hidden sm:inline' : ''}>{t('space.analysis.button')}</span>
		</button>
	{/if}
</form>
```

- [ ] **Step 2: Плитки в SpaceBoardGrid**

Импорты: `import AnalyzeButton from './AnalyzeButton.svelte';`, `import type { AnalysisState } from '$lib/analysis-state.js';`.

Props:

```ts
	let {
		boards,
		onNewBoard,
		analysis = null,
		spaceSlug
	}: { boards: SpaceBoard[]; onNewBoard: () => void; analysis?: AnalysisState | null; spaceSlug: string } = $props();

	// Заглушка держится и после ready, пока invalidateAll не принесёт доску в список
	let showPending = $derived(
		analysis?.state === 'pending' ||
			(analysis?.state === 'ready' && !boards.some((b) => b.slug === analysis.board.slug))
	);
	let showFailed = $derived(analysis?.state === 'failed');
```

В сетке сразу после плитки «New board» (внутри того же `{#if !search.trim()}`, после `</button>`):

```svelte
			{#if showPending && analysis && analysis.state !== 'idle'}
				<div
					class="tile-enter ai-frame flex min-h-[150px] flex-col gap-3.5 rounded-2xl bg-surface-card p-5 [--ai-frame-bg:var(--color-surface-card)]"
					aria-busy="true"
					data-testid="analysis-pending"
				>
					<div class="flex items-start justify-between gap-2">
						<span class="font-heading min-w-0 truncate text-base font-bold text-text-primary">{analysis.title}</span>
						<span class="badge-sm badge-ai shrink-0">{t('analysis.badge')}</span>
					</div>
					<div class="mt-auto flex items-center gap-2 text-[13px] font-semibold text-text-secondary">
						<svg class="h-4 w-4 animate-spin text-ai-from" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
						{t('space.analysis.tile.pending')}
					</div>
				</div>
			{:else if showFailed && analysis?.state === 'failed'}
				<div
					class="tile-enter ai-frame flex min-h-[150px] flex-col gap-3 rounded-2xl bg-surface-card p-5 opacity-90 [--ai-frame-bg:var(--color-surface-card)]"
					data-testid="analysis-failed"
				>
					<div class="flex items-start justify-between gap-2">
						<span class="font-heading min-w-0 truncate text-base font-bold text-text-primary">{analysis.title}</span>
						<span class="badge-sm badge-ai shrink-0">{t('analysis.badge')}</span>
					</div>
					<p class="text-[13px] leading-snug text-bad">
						{t('space.analysis.tile.failed')}: {t(`space.analysis.error.${analysis.error}`)}
					</p>
					<div class="mt-auto">
						<AnalyzeButton {spaceSlug} variant="retry" />
					</div>
				</div>
			{/if}
```

- [ ] **Step 3: Страница пространства**

В `src/routes/spaces/[slug]/+page.svelte`:

```ts
	import { onMount, onDestroy } from 'svelte';
	import { socketStore } from '$lib/stores/socket.svelte.js';
```

После `boardStore.board = null;`:

```ts
	// Комната пространства: статус AI-анализа для всех, кто здесь
	onMount(() => {
		socketStore.connect();
		socketStore.joinSpace(data.space.slug);
	});
	onDestroy(() => socketStore.disconnect());

	$effect(() => {
		socketStore.seedAnalysis(data.analysis);
	});

	// Готовая доска должна появиться в списке со счётчиками — перечитываем данные
	let refreshedFor = '';
	$effect(() => {
		const a = socketStore.analysis;
		if (a?.state === 'ready' && refreshedFor !== a.id) {
			refreshedFor = a.id;
			if (!data.boards.some((b) => b.slug === a.board.slug)) invalidateAll();
		}
	});
```

Сетку заменить на:

```svelte
				<SpaceBoardGrid
					boards={data.boards}
					analysis={socketStore.analysis ?? data.analysis}
					spaceSlug={data.space.slug}
					onNewBoard={() => (creating = true)}
				/>
```

- [ ] **Step 4: Страница доски**

В `src/routes/[slug]/+page.svelte` в `onMount` после `joinBoard`:

```ts
		if (data.space) socketStore.joinSpace(data.space.slug);
```

и рядом с существующим `$effect`:

```ts
	$effect(() => {
		socketStore.seedAnalysis(data.analysis);
	});
```

- [ ] **Step 5: Проверить и закоммитить**

Run: `npm run check && npm test`

```bash
git add src/lib/components/AnalyzeButton.svelte src/lib/components/SpaceBoardGrid.svelte src/routes/spaces/[slug]/+page.svelte src/routes/[slug]/+page.svelte
git commit -m "Асинхронный анализ: плитка с лоадером, уведомления вместо редиректа

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: E2e — мок с задержкой, новая спека

**Files:**
- Modify: `e2e/mock-deepseek.mjs`
- Modify: `e2e/analysis.spec.ts` (переписать)

- [ ] **Step 1: Задержка в моке**

В `e2e/mock-deepseek.mjs`: `let delayMs = 0;`; в обработчике `/__mode`: `delayMs = Number(body.delayMs) || 0;` после установки `mode`; в `/chat/completions` перед проверкой `mode`: `if (delayMs) await new Promise((r) => setTimeout(r, delayMs));`.

- [ ] **Step 2: Спека**

Заменить `e2e/analysis.spec.ts` целиком:

```ts
import { test, expect, type Page } from '@playwright/test';
import { addCard, createBoard, createBoardInSpace, createSpace, initStorage } from './helpers';

const MOCK = 'http://localhost:4778';

async function setMock(page: Page, mode: 'ok' | 'error', delayMs = 0) {
	await page.request.post(`${MOCK}/__mode`, { data: { mode, delayMs } });
}

test.afterEach(async ({ page }) => {
	await setMock(page, 'ok', 0);
});

const toast = (page: Page, kind: 'info' | 'success' | 'error') => page.getByTestId('toast').filter({ has: page.locator(`[data-kind="${kind}"]`) }).or(page.locator(`[data-testid="toast"][data-kind="${kind}"]`));

// Жмёт кнопку, ждёт «готов», возвращает pathname доски из кнопки «Открыть»
async function runAnalysis(page: Page): Promise<string> {
	await page.getByTestId('analyze-button').click();
	const ready = page.locator('[data-testid="toast"][data-kind="success"]').last();
	await expect(ready).toContainText('AI analysis is ready', { timeout: 20_000 });
	const href = await ready.getByRole('link', { name: /Open/ }).getAttribute('href');
	expect(href).toMatch(/^\/[A-Za-z0-9_-]{21}$/);
	return href!;
}

async function seedSpace(page: Page, name: string) {
	const space = await createSpace(page, name);
	const b1 = await createBoardInSpace(page, space.slug, 'Sprint 1');
	await addCard(page, "Didn't Go Well", 'flaky tests');
	await addCard(page, 'Went Well', 'deploys are smooth');
	const b2 = await createBoardInSpace(page, space.slug, 'Sprint 2');
	await addCard(page, "Didn't Go Well", 'flaky tests again');
	return { ...space, boards: [b1, b2] };
}

test('everyone in the space sees the loader tile, then the ready toast; nobody is redirected', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const ctxB = await browser.newContext();
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const space = await seedSpace(pageA, 'Live team');
	await initStorage(pageB);
	await pageB.goto(`/spaces/${space.slug}`);
	await pageA.goto(`/spaces/${space.slug}`);
	await setMock(pageA, 'ok', 2_500);

	await pageA.getByTestId('analyze-button').click();
	for (const p of [pageA, pageB]) {
		await expect(p.locator('[data-testid="toast"][data-kind="info"]')).toContainText('Space analysis started', { timeout: 10_000 });
		await expect(p.getByTestId('analysis-pending')).toBeVisible();
		await expect(p.getByTestId('analysis-pending')).toContainText(/^Space analysis for/);
	}

	for (const p of [pageA, pageB]) {
		await expect(p.locator('[data-testid="toast"][data-kind="success"]')).toContainText('AI analysis is ready', { timeout: 20_000 });
		await expect(p.getByTestId('analysis-pending')).toHaveCount(0);
		const tile = p.getByTestId('space-tile').filter({ has: p.getByText(/^Space analysis for/) });
		await expect(tile).toHaveAttribute('data-format', 'analysis');
		expect(new URL(p.url()).pathname).toBe(`/spaces/${space.slug}`);
	}

	// Переход только по кнопке «Открыть»
	await pageA.locator('[data-testid="toast"][data-kind="success"]').getByRole('link', { name: /Open/ }).click();
	await expect(pageA).toHaveTitle(/^Space analysis for/);
	for (const name of ['Still good', 'Still bad', 'Still to improve']) {
		await expect(pageA.getByRole('heading', { name })).toBeVisible();
	}
	await expect(pageA.locator('.card-board', { hasText: 'Flaky tests block merges again (in 3 boards)' })).toBeVisible();

	await ctxA.close();
	await ctxB.close();
});

test('the ready toast reaches a board page inside the space', async ({ page }) => {
	const space = await seedSpace(page, 'Roaming team');
	await page.goto(`/spaces/${space.slug}`);
	await setMock(page, 'ok', 2_500);
	await page.getByTestId('analyze-button').click();
	await expect(page.getByTestId('analysis-pending')).toBeVisible();

	await page.goto(`/${space.boards[1]}`);
	await expect(page.locator('[data-testid="toast"][data-kind="success"]')).toContainText('AI analysis is ready', { timeout: 20_000 });
	expect(new URL(page.url()).pathname).toBe(`/${space.boards[1]}`);
});

test('a reload during the analysis shows the loader again', async ({ page }) => {
	const space = await seedSpace(page, 'Reload team');
	await page.goto(`/spaces/${space.slug}`);
	await setMock(page, 'ok', 4_000);
	await page.getByTestId('analyze-button').click();
	await expect(page.getByTestId('analysis-pending')).toBeVisible();
	await page.reload();
	await expect(page.getByTestId('analysis-pending')).toBeVisible();
	await expect(page.locator('[data-testid="toast"][data-kind="success"]')).toContainText('AI analysis is ready', { timeout: 20_000 });
});

test('a failure shows the failed tile with retry for everyone, and retry works', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const ctxB = await browser.newContext();
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const space = await seedSpace(pageA, 'Unlucky team');
	await initStorage(pageB);
	await pageB.goto(`/spaces/${space.slug}`);
	await pageA.goto(`/spaces/${space.slug}`);
	await setMock(pageA, 'error');
	await pageA.getByTestId('analyze-button').click();
	for (const p of [pageA, pageB]) {
		await expect(p.locator('[data-testid="toast"][data-kind="error"]')).toContainText('The AI service returned an error', { timeout: 10_000 });
		await expect(p.getByTestId('analysis-failed')).toContainText('Analysis failed');
	}
	await expect(pageA.getByTestId('space-tile')).toHaveCount(2);

	await setMock(pageA, 'ok');
	await pageA.getByTestId('analyze-retry').click();
	for (const p of [pageA, pageB]) {
		await expect(p.locator('[data-testid="toast"][data-kind="success"]')).toContainText('AI analysis is ready', { timeout: 20_000 });
		await expect(p.getByTestId('analysis-failed')).toHaveCount(0);
	}

	await ctxA.close();
	await ctxB.close();
});

test('cache: without new boards the button reports the analysis is up to date', async ({ page }) => {
	const space = await seedSpace(page, 'Cached team');
	await page.goto(`/spaces/${space.slug}`);
	const first = await runAnalysis(page);

	await page.getByTestId('analyze-button').click();
	const cached = page.locator('[data-testid="toast"][data-kind="info"]').last();
	await expect(cached).toContainText('up to date');
	expect(await cached.getByRole('link', { name: /Open/ }).getAttribute('href')).toBe(first);
	await expect(page.getByTestId('analysis-pending')).toHaveCount(0);

	await createBoardInSpace(page, space.slug, 'Sprint 3');
	await page.goto(`/spaces/${space.slug}`);
	expect(await runAnalysis(page)).not.toBe(first);
});

test('limit: the fourth analysis in a day is refused', async ({ page }) => {
	test.setTimeout(120_000);
	const space = await seedSpace(page, 'Busy team');
	for (let i = 0; i < 3; i++) {
		await createBoardInSpace(page, space.slug, `Sprint ${10 + i}`);
		await page.goto(`/spaces/${space.slug}`);
		await runAnalysis(page);
	}
	await createBoardInSpace(page, space.slug, 'Sprint 20');
	await page.goto(`/spaces/${space.slug}`);
	await page.getByTestId('analyze-button').click();
	await expect(page.locator('[data-testid="toast"][data-kind="error"]')).toContainText('Limit reached: 3 analyses a day');
	await expect(page.getByTestId('analysis-pending')).toHaveCount(0);
});

test('an empty space explains there is nothing to analyse', async ({ page }) => {
	const space = await createSpace(page, 'Empty team');
	await page.goto(`/spaces/${space.slug}`);
	await page.getByTestId('analyze-button').click();
	await expect(page.locator('[data-testid="toast"][data-kind="error"]')).toContainText('Nothing to analyse yet');
});

test('the space creator has creator rights on the analysis board', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const ctxB = await browser.newContext();
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const space = await seedSpace(pageA, 'Admin team');
	await initStorage(pageB);
	await pageB.goto(space.adminUrl);
	await pageB.getByRole('button', { name: 'Close' }).click();

	await pageA.goto(`/spaces/${space.slug}`);
	const analysisPath = await runAnalysis(pageA);

	await pageB.goto(analysisPath);
	await expect(pageB).toHaveTitle(/^Space analysis for/);
	await pageB.getByRole('button', { name: 'Menu' }).click();
	await expect(pageB.getByRole('button', { name: 'Rename board' })).toBeVisible();

	await ctxA.close();
	await ctxB.close();
});

test('a standalone board has no analysis button', async ({ page }) => {
	await createBoard(page, 'Lonely board');
	await expect(page.getByTestId('analyze-button')).toHaveCount(0);
});

test('on a phone the analysis board opens on its first column', async ({ page }) => {
	const space = await seedSpace(page, 'Mobile team');
	await page.goto(`/spaces/${space.slug}`);
	const path = await runAnalysis(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(path);
	await expect(page.getByRole('button', { name: /^Good · 1$/ })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.card-board', { hasText: 'Deploys keep going smoothly' })).toBeVisible();
});
```

Заметка: вспомогательная константа `toast` выше не нужна — удалить её, в тестах используются прямые локаторы `[data-testid="toast"][data-kind="…"]`.

- [ ] **Step 3: Прогнать всё**

```bash
lsof -ti tcp:4777 | xargs -r kill; lsof -ti tcp:4778 | xargs -r kill
npm run check && npm test && npm run build && npx playwright test
```

Expected: всё зелёное. Типичные причины падений: таймаут `space:join` (сервер не ретранслирует — проверить `bus.on('space')` в server.js стоит после создания `io`); уведомление не появляется у второго браузера (страница пространства не вызвала `socketStore.connect()`); плитка не пропадает после ready (`invalidateAll` не вызван — проверить `$effect` на странице пространства).

- [ ] **Step 4: Коммит**

```bash
git add e2e/mock-deepseek.mjs e2e/analysis.spec.ts
git commit -m "Асинхронный анализ: e2e — лоадер у всех, уведомления, перезагрузка, ошибка и повтор

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Документация и финальная проверка

**Files:**
- Modify: `CLAUDE.md` (абзац **Space analysis (AI)**), `src/routes/changelog/+page.svelte` (запись 1.12)

- [ ] **Step 1: CLAUDE.md**

Заменить абзац **Space analysis (AI)** на:

```
- **Space analysis (AI)**: button «Анализ пространства» on a space page and on every board inside a space (only if `DEEPSEEK_API_KEY` is set). Form action `analyze` in `src/routes/spaces/[slug]/+page.server.ts` inserts a `space_analyses` row (pending) and starts `runAnalysisJob` (`src/lib/server/analysis-job.ts`) in the background: the last 150 cards of all regular boards (newest first, 60k-char budget, no comments) go to DeepSeek and a board with `format = 'analysis'` (hidden format in `board-formats.js`) is created on success; the row becomes `ready` (or `failed` with an error kind). `space_analyses` is also the cache (fresh while no regular board is newer than the latest ready row) and the rate limit (3 ready+pending rows per space per 24h; pending older than 5 min counts as failed/timeout). Status reaches everyone in the space live: SvelteKit emits into `globalThis.__retroBus` (`src/lib/server/bus.ts`), `server.js` relays to the Socket.IO room `space:{slug}` (`space:join`), the client keeps it in `socketStore.analysis` and shows toasts (`toastStore`, top-right, in the layout); `GET /spaces/{slug}/analysis` returns the current state after join/reconnect. No redirects: the space list shows a loader tile while pending, a failed tile with retry, and a normal analysis tile when ready. Pure logic in `src/lib/server/analysis.ts` and `src/lib/analysis-state.ts`. Space creator (cookie `retro_space_creator_*`) is treated as creator of every board in the space. E2e runs against `e2e/mock-deepseek.mjs` via `DEEPSEEK_API_BASE`
```

- [ ] **Step 2: Changelog 1.12**

Заменить пункты записи 1.12 на:

```ts
				{ en: 'A «Space analysis» button on a space and on its boards: AI reads the recent cards from all retros of the space and shows what keeps going well, what keeps going badly and what the team keeps wanting to improve', ru: 'Кнопка «Анализ пространства» в пространстве и на его досках: AI читает последние карточки всех ретро пространства и показывает, что снова хорошо, что снова плохо и что команда снова хочет улучшить' },
				{ en: 'The analysis runs in the background: everyone in the space sees a loading tile, and a notification with an «Open» button arrives when it is ready — keep working meanwhile', ru: 'Анализ идёт в фоне: все в пространстве видят плитку с лоадером, а по готовности приходит уведомление с кнопкой «Открыть» — можно продолжать работать' },
				{ en: 'The result is a regular board with a purple frame — walk through it with the team, vote and comment as usual', ru: 'Результат — обычная доска с фиолетовой рамкой: по ней можно пройтись с командой, голосовать и комментировать как обычно' },
				{ en: 'The analysis is rerun only after a new board appears in the space, and no more than three times a day', ru: 'Анализ пересчитывается только после появления новой доски в пространстве и не чаще трёх раз в сутки' },
				{ en: 'The space creator now has creator rights on every board in the space', ru: 'Создатель пространства теперь имеет права создателя на всех досках пространства' }
```

- [ ] **Step 3: Финальная проверка и коммит**

```bash
npm run check && npm test && npm run build && npx playwright test
git add CLAUDE.md src/routes/changelog/+page.svelte
git commit -m "Асинхронный анализ: документация и changelog

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Пуш — решение пользователя (деплой прода). После деплоя миграция 0006 применится сама (`migrate.js` в entrypoint).
