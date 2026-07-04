# Feedback Iteration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать итерацию по фидбеку: заметный индикатор комментариев + комментарии в Summary, API экспорта `/api/v1/boards/{slug}/export.md|.json` с докой `/api`, фиксы утечки `creatorToken` и реконнекта, и 8 S-улучшений (перенос карточек, confirm удаления, тач-кнопки, один vote-emit, сортировка колонки, UX таймера, локализация).

**Architecture:** Общий сборщик экспорта выносится в чистые функции `src/lib/server/export.ts` (тестируемо без БД), rate-limiting — в общий `src/lib/server/ratelimit.ts` (мигрируются upload/feedback). Новые REST-маршруты — обычные SvelteKit `+server.ts`. UI-правки — точечные изменения Svelte 5 компонентов с переиспользованием классов дизайн-системы из `app.css`. Realtime-логика (перенос карточки) — расширение существующего `card:update` в `server.js`. Спека: `docs/superpowers/specs/2026-07-04-feedback-iteration-design.md`.

**Tech Stack:** SvelteKit (Svelte 5 runes), Socket.IO, Drizzle ORM + PostgreSQL, Tailwind CSS 4, Vitest.

## Global Constraints

- Svelte 5 runes only (`$state`/`$derived`/`$effect`); stores в `.svelte.ts` файлах.
- Каждая новая пользовательская строка — ключ в ОБОИХ `src/lib/i18n/en.json` и `src/lib/i18n/ru.json`; русские счётчики — 3 формы множественного числа через `|` (тест целостности словарей упадёт иначе).
- НЕ запускать полный тест-сьют локально — только целевые файлы: `npm test -- <путь до файла>`. Полный прогон делает CI при пуше (workflow проекта).
- Никаких изменений схемы БД и миграций в этой итерации.
- `server.js` — plain JavaScript (не TS), правки без type-аннотаций.
- Работаем прямо на `main`; коммит после каждой задачи, `git push` ТОЛЬКО в финальной задаче 15 (пуш в main = деплой в прод).
- Каждое сообщение коммита заканчивается строкой: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- В корне репо лежат untracked `concept.html`, `redesign-prototype.html`, `timer-concepts.html` — НЕ добавлять их в коммиты (`git add` только конкретных файлов задачи).

---

### Task 1: Общий rate limiter `src/lib/server/ratelimit.ts`

**Files:**
- Create: `src/lib/server/ratelimit.ts`
- Test: `src/lib/server/ratelimit.test.ts`
- Modify: `src/routes/api/upload/+server.ts:9-26`
- Modify: `src/routes/api/feedback/+server.ts:7-25`

**Interfaces:**
- Consumes: ничего (первая задача).
- Produces: `createRateLimiter(opts: { max: number; windowMs: number }): { check(ip: string): boolean }` — `check` возвращает `true`, если запрос разрешён. Task 3 импортирует `createRateLimiter` отсюда.

- [ ] **Step 1: Написать падающий тест**

Создать `src/lib/server/ratelimit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from './ratelimit.js';

describe('createRateLimiter', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('allows up to max requests within the window', () => {
		const limiter = createRateLimiter({ max: 3, windowMs: 60_000 });
		expect(limiter.check('1.1.1.1')).toBe(true);
		expect(limiter.check('1.1.1.1')).toBe(true);
		expect(limiter.check('1.1.1.1')).toBe(true);
		expect(limiter.check('1.1.1.1')).toBe(false);
	});

	it('tracks IPs independently', () => {
		const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
		expect(limiter.check('1.1.1.1')).toBe(true);
		expect(limiter.check('2.2.2.2')).toBe(true);
		expect(limiter.check('1.1.1.1')).toBe(false);
	});

	it('resets after the window passes', () => {
		const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
		expect(limiter.check('1.1.1.1')).toBe(true);
		expect(limiter.check('1.1.1.1')).toBe(false);
		vi.advanceTimersByTime(60_001);
		expect(limiter.check('1.1.1.1')).toBe(true);
	});

	it('prunes stale entries so the map does not grow unbounded', () => {
		const limiter = createRateLimiter({ max: 1, windowMs: 1_000 });
		for (let i = 0; i < 100; i++) limiter.check(`ip-${i}`);
		vi.advanceTimersByTime(2_000);
		limiter.check('fresh-ip');
		expect(limiter.size()).toBeLessThanOrEqual(1);
	});
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- src/lib/server/ratelimit.test.ts`
Expected: FAIL — `Cannot find module './ratelimit.js'` (или аналогичная ошибка импорта).

- [ ] **Step 3: Реализация**

Создать `src/lib/server/ratelimit.ts`:

```ts
// Shared in-memory per-IP rate limiter (single-process app, no external store needed)

export interface RateLimiter {
	check(ip: string): boolean;
	size(): number;
}

export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }): RateLimiter {
	const counts = new Map<string, { count: number; resetAt: number }>();
	let lastPrune = Date.now();

	return {
		check(ip: string): boolean {
			const now = Date.now();
			if (now - lastPrune > windowMs) {
				for (const [key, entry] of counts) {
					if (now > entry.resetAt) counts.delete(key);
				}
				lastPrune = now;
			}
			const entry = counts.get(ip);
			if (!entry || now > entry.resetAt) {
				counts.set(ip, { count: 1, resetAt: now + windowMs });
				return true;
			}
			if (entry.count >= max) return false;
			entry.count++;
			return true;
		},
		size(): number {
			return counts.size;
		}
	};
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test -- src/lib/server/ratelimit.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Мигрировать upload endpoint**

В `src/routes/api/upload/+server.ts` удалить строки 9-22 (комментарий `// Simple rate limit...`, `const uploadCounts`, функцию `checkRateLimit`) и заменить на импорт + инстанс. Итоговое начало файла:

```ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index.js';
import { images } from '$lib/server/db/schema.js';
import { validateMimeType, compressImage } from '$lib/server/image.js';
import { createRateLimiter } from '$lib/server/ratelimit.js';

const MAX_RAW_SIZE = 20 * 1024 * 1024; // 20MB

// Rate limit: max 10 uploads per IP per minute
const uploadLimiter = createRateLimiter({ max: 10, windowMs: 60_000 });
```

И в обработчике заменить `if (!checkRateLimit(getClientAddress()))` на:

```ts
	if (!uploadLimiter.check(getClientAddress())) {
```

- [ ] **Step 6: Мигрировать feedback endpoint**

В `src/routes/api/feedback/+server.ts` удалить строки 7-20 (`const feedbackCounts`, `checkRateLimit`) и заменить на:

```ts
import { createRateLimiter } from '$lib/server/ratelimit.js';

// Rate limit: 3 per IP per 10 minutes
const feedbackLimiter = createRateLimiter({ max: 3, windowMs: 600_000 });
```

В обработчике заменить `if (!checkRateLimit(getClientAddress()))` на `if (!feedbackLimiter.check(getClientAddress()))`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/ratelimit.ts src/lib/server/ratelimit.test.ts src/routes/api/upload/+server.ts src/routes/api/feedback/+server.ts
git commit -m "Add shared per-IP rate limiter, migrate upload and feedback endpoints

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `translate()` с явной локалью + словарные ключи экспорта

**Files:**
- Modify: `src/lib/i18n/index.ts:24-40`
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/ru.json`
- Test: `src/lib/i18n/translate.test.ts` (новый файл)

**Interfaces:**
- Consumes: существующие `LOCALES`, `PLURAL_RULES` в `index.ts`.
- Produces: `translate(locale: Locale, key: string, params?: Record<string, string | number>): string` — экспорт из `$lib/i18n/index.js`, работает без стора (для сервера). Task 3 использует его и ключи `apiExport.*` + существующие `column.went_well|didnt_go_well|improve`.

- [ ] **Step 1: Написать падающий тест**

Создать `src/lib/i18n/translate.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

import { translate } from './index.js';

describe('translate', () => {
	it('uses the explicit locale, not the store', () => {
		expect(translate('en', 'column.went_well')).toBe('Went Well');
		expect(translate('ru', 'column.went_well')).toBe('Что прошло хорошо');
	});

	it('applies russian plural forms', () => {
		expect(translate('ru', 'apiExport.likes', { n: 1 })).toBe('1 лайк');
		expect(translate('ru', 'apiExport.likes', { n: 2 })).toBe('2 лайка');
		expect(translate('ru', 'apiExport.likes', { n: 5 })).toBe('5 лайков');
	});

	it('applies english plural forms', () => {
		expect(translate('en', 'apiExport.dislikes', { n: 1 })).toBe('1 dislike');
		expect(translate('en', 'apiExport.dislikes', { n: 3 })).toBe('3 dislikes');
	});
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- src/lib/i18n/translate.test.ts`
Expected: FAIL — `translate` не экспортируется / ключи `apiExport.*` отсутствуют.

- [ ] **Step 3: Реализация**

В `src/lib/i18n/index.ts` заменить текущую функцию `t` (строки 24-40) на:

```ts
export function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
	const dict = LOCALES[locale]?.dict ?? LOCALES.en.dict;
	let value = (dict as Record<string, string>)[key] ?? (LOCALES.en.dict as Record<string, string>)[key] ?? key;
	if (params && 'n' in params && value.includes('|')) {
		const n = Number(params.n);
		const forms = value.split('|');
		const idx = PLURAL_RULES[locale]?.(n) ?? (n === 1 ? 0 : 1);
		value = forms[Math.min(idx, forms.length - 1)];
	}
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			value = value.replaceAll(`{${k}}`, String(v));
		}
	}
	return value;
}

export function t(key: string, params?: Record<string, string | number>): string {
	return translate(localeStore.locale, key, params);
}
```

В `src/lib/i18n/en.json` после блока `"export.*"` (после строки `"export.markdown": "Markdown",`) добавить:

```json
	"apiExport.exported": "Exported",
	"apiExport.noCards": "No cards",
	"apiExport.likes": "{n} like|{n} likes",
	"apiExport.dislikes": "{n} dislike|{n} dislikes",
```

В `src/lib/i18n/ru.json` в том же месте:

```json
	"apiExport.exported": "Экспортировано",
	"apiExport.noCards": "Нет карточек",
	"apiExport.likes": "{n} лайк|{n} лайка|{n} лайков",
	"apiExport.dislikes": "{n} дизлайк|{n} дизлайка|{n} дизлайков",
```

- [ ] **Step 4: Убедиться, что тесты проходят (включая целостность словарей)**

Run: `npm test -- src/lib/i18n`
Expected: PASS — translate.test.ts, index.test.ts, dictionaries.test.ts все зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/index.ts src/lib/i18n/translate.test.ts src/lib/i18n/en.json src/lib/i18n/ru.json
git commit -m "i18n: extract translate() with explicit locale for server-side use

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Модуль экспорта `src/lib/server/export.ts`

**Files:**
- Create: `src/lib/server/export.ts`
- Test: `src/lib/server/export.test.ts`

**Interfaces:**
- Consumes: `createRateLimiter` (Task 1), `translate` + ключи `apiExport.*` (Task 2), `decrypt` из `$lib/server/crypto.js`, `db` и таблицы из `$lib/server/db/*`.
- Produces (используется Task 4):
  - `assembleExport(board, cards, votes, comments, origin: string): BoardExport` — чистая сборка (decrypt без ENCRYPTION_KEY — passthrough, тестируемо);
  - `loadBoardExport(slug: string, origin: string): Promise<BoardExport | null>` — null если доска не найдена;
  - `toMarkdown(data: BoardExport, lang?: Locale): string`;
  - `exportRateLimiter` — общий инстанс `{ max: 30, windowMs: 60_000 }` на оба маршрута;
  - тип `BoardExport = { board: { title; slug; createdAt }; columns: Record<string, ExportCard[]> }`, `ExportCard = { content; authorName; likes; dislikes; imageUrl; createdAt; comments: ExportComment[] }`, `ExportComment = { content; authorName; imageUrl; createdAt }`.

- [ ] **Step 1: Написать падающий тест**

Создать `src/lib/server/export.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

import { assembleExport, toMarkdown } from './export.js';

const ORIGIN = 'https://x.test';

const board = { title: 'Sprint 42', slug: 'abc123', createdAt: new Date('2026-07-01T00:00:00Z') };

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

const voteRows = [
	{ cardId: 'c1', type: 'like' },
	{ cardId: 'c1', type: 'like' },
	{ cardId: 'c1', type: 'dislike' }
];

const commentRows = [
	{
		cardId: 'c1',
		content: 'Huge relief!',
		authorName: 'Peter',
		imageId: null,
		createdAt: new Date('2026-07-01T12:00:00Z')
	}
];

describe('assembleExport', () => {
	it('groups cards by column with likes, dislikes, image urls and dates', () => {
		const data = assembleExport(board, cardRows, voteRows, commentRows, ORIGIN);
		expect(data.board).toEqual({ title: 'Sprint 42', slug: 'abc123', createdAt: '2026-07-01T00:00:00.000Z' });
		const wentWell = data.columns.went_well;
		expect(wentWell).toHaveLength(1);
		expect(wentWell[0].likes).toBe(2);
		expect(wentWell[0].dislikes).toBe(1);
		expect(wentWell[0].imageUrl).toBe('https://x.test/api/image/img-1');
		expect(wentWell[0].createdAt).toBe('2026-07-01T10:00:00.000Z');
		expect(wentWell[0].comments).toEqual([
			{
				content: 'Huge relief!',
				authorName: 'Peter',
				imageUrl: null,
				createdAt: '2026-07-01T12:00:00.000Z'
			}
		]);
		expect(data.columns.didnt_go_well).toEqual([]);
		expect(data.columns.improve).toHaveLength(1);
		expect(data.columns.improve[0].imageUrl).toBeNull();
	});
});

describe('toMarkdown', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-04T12:00:00Z'));
	});
	afterEach(() => vi.useRealTimers());

	it('renders english markdown with votes, images and comments', () => {
		const md = toMarkdown(assembleExport(board, cardRows, voteRows, commentRows, ORIGIN), 'en');
		expect(md).toContain('# Sprint 42');
		expect(md).toContain('*Exported: 2026-07-04*');
		expect(md).toContain('## Went Well');
		expect(md).toContain('- CI is green — *Maria* [2 likes, 1 dislike]');
		expect(md).toContain('  ![image](https://x.test/api/image/img-1)');
		expect(md).toContain('  - Huge relief! — *Peter*');
		expect(md).toContain("## Didn't Go Well");
		expect(md).toContain('*No cards*');
	});

	it('renders russian headings and plurals with lang=ru', () => {
		const md = toMarkdown(assembleExport(board, cardRows, voteRows, commentRows, ORIGIN), 'ru');
		expect(md).toContain('## Что прошло хорошо');
		expect(md).toContain('[2 лайка, 1 дизлайк]');
		expect(md).toContain('*Нет карточек*');
	});

	it('omits the votes bracket when there are no votes', () => {
		const md = toMarkdown(assembleExport(board, cardRows, [], [], ORIGIN), 'en');
		expect(md).toContain('- CI is green — *Maria*\n');
		expect(md).not.toContain('[0');
	});
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- src/lib/server/export.test.ts`
Expected: FAIL — `Cannot find module './export.js'`.

- [ ] **Step 3: Реализация**

Создать `src/lib/server/export.ts`:

```ts
import { db } from '$lib/server/db/index.js';
import { boards, cards, votes, comments } from '$lib/server/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { decrypt } from '$lib/server/crypto.js';
import { translate, type Locale } from '$lib/i18n/index.js';
import { createRateLimiter } from '$lib/server/ratelimit.js';

export const COLUMN_TYPES = ['went_well', 'didnt_go_well', 'improve'] as const;

// Shared across export.md / export.json routes: 30 requests per IP per minute
export const exportRateLimiter = createRateLimiter({ max: 30, windowMs: 60_000 });

export interface ExportComment {
	content: string;
	authorName: string | null;
	imageUrl: string | null;
	createdAt: string;
}

export interface ExportCard {
	content: string;
	authorName: string | null;
	likes: number;
	dislikes: number;
	imageUrl: string | null;
	createdAt: string;
	comments: ExportComment[];
}

export interface BoardExport {
	board: { title: string; slug: string; createdAt: string };
	columns: Record<string, ExportCard[]>;
}

// Structural row types — compatible with Drizzle rows, keeps assembleExport testable without a DB
interface BoardRow {
	title: string;
	slug: string;
	createdAt: Date;
}
interface CardRow {
	id: string;
	columnType: string;
	content: string;
	authorName: string | null;
	imageId: string | null;
	createdAt: Date;
}
interface VoteRow {
	cardId: string;
	type: string;
}
interface CommentRow {
	cardId: string;
	content: string;
	authorName: string | null;
	imageId: string | null;
	createdAt: Date;
}

export function assembleExport(
	board: BoardRow,
	boardCards: CardRow[],
	boardVotes: VoteRow[],
	boardComments: CommentRow[],
	origin: string
): BoardExport {
	const imageUrl = (id: string | null) => (id ? `${origin}/api/image/${id}` : null);
	const columns: Record<string, ExportCard[]> = {};
	for (const col of COLUMN_TYPES) {
		columns[col] = boardCards
			.filter((c) => c.columnType === col)
			.map((card) => ({
				content: decrypt(card.content) ?? card.content,
				authorName: decrypt(card.authorName),
				likes: boardVotes.filter((v) => v.cardId === card.id && v.type === 'like').length,
				dislikes: boardVotes.filter((v) => v.cardId === card.id && v.type === 'dislike').length,
				imageUrl: imageUrl(card.imageId),
				createdAt: card.createdAt.toISOString(),
				comments: boardComments
					.filter((c) => c.cardId === card.id)
					.map((c) => ({
						content: decrypt(c.content) ?? c.content,
						authorName: decrypt(c.authorName),
						imageUrl: imageUrl(c.imageId),
						createdAt: c.createdAt.toISOString()
					}))
			}));
	}
	return {
		board: { title: board.title, slug: board.slug, createdAt: board.createdAt.toISOString() },
		columns
	};
}

export async function loadBoardExport(slug: string, origin: string): Promise<BoardExport | null> {
	const board = await db.query.boards.findFirst({ where: eq(boards.slug, slug) });
	if (!board) return null;

	const boardCards = await db.query.cards.findMany({ where: eq(cards.boardId, board.id) });
	const cardIds = boardCards.map((c) => c.id);
	let boardVotes: (typeof votes.$inferSelect)[] = [];
	let boardComments: (typeof comments.$inferSelect)[] = [];

	if (cardIds.length > 0) {
		[boardVotes, boardComments] = await Promise.all([
			db.select().from(votes).where(inArray(votes.cardId, cardIds)),
			db.select().from(comments).where(inArray(comments.cardId, cardIds))
		]);
	}

	return assembleExport(board, boardCards, boardVotes, boardComments, origin);
}

export function toMarkdown(data: BoardExport, lang: Locale = 'en'): string {
	let md = `# ${data.board.title}\n\n`;
	md += `*${translate(lang, 'apiExport.exported')}: ${new Date().toISOString().slice(0, 10)}*\n\n`;
	md += `---\n\n`;

	for (const col of COLUMN_TYPES) {
		const items = data.columns[col] ?? [];
		md += `## ${translate(lang, `column.${col}`)}\n\n`;

		if (items.length === 0) {
			md += `*${translate(lang, 'apiExport.noCards')}*\n\n`;
			continue;
		}

		for (const card of items) {
			const author = card.authorName ? ` — *${card.authorName}*` : '';
			const voteParts: string[] = [];
			if (card.likes > 0) voteParts.push(translate(lang, 'apiExport.likes', { n: card.likes }));
			if (card.dislikes > 0) voteParts.push(translate(lang, 'apiExport.dislikes', { n: card.dislikes }));
			const voteSuffix = voteParts.length > 0 ? ` [${voteParts.join(', ')}]` : '';
			md += `- ${card.content}${author}${voteSuffix}\n`;

			if (card.imageUrl) {
				md += `  ![image](${card.imageUrl})\n`;
			}

			for (const comment of card.comments) {
				const commentAuthor = comment.authorName ? ` — *${comment.authorName}*` : '';
				const commentImage = comment.imageUrl ? ` ![image](${comment.imageUrl})` : '';
				md += `  - ${comment.content}${commentAuthor}${commentImage}\n`;
			}
		}

		md += `\n`;
	}

	return md;
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test -- src/lib/server/export.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/export.ts src/lib/server/export.test.ts
git commit -m "Add shared board export builder: dislikes, image urls, dates, localized markdown

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: API-маршруты `/api/v1/boards/{slug}/export.md|.json` + делегация старого маршрута

**Files:**
- Create: `src/routes/api/v1/boards/[slug]/export.md/+server.ts`
- Create: `src/routes/api/v1/boards/[slug]/export.json/+server.ts`
- Modify: `src/routes/[slug]/export/+server.ts` (полная замена файла)

**Interfaces:**
- Consumes: `loadBoardExport`, `toMarkdown`, `exportRateLimiter` (Task 3), `metric` из `$lib/server/statsd.js`.
- Produces: публичные endpoints `GET /api/v1/boards/{slug}/export.md?lang=en|ru` (text/markdown inline) и `GET /api/v1/boards/{slug}/export.json`; старый `GET /{slug}/export?format=md|json` сохраняет поведение attachment. Task 5 документирует эти URL.

- [ ] **Step 1: Маршрут export.md**

Создать `src/routes/api/v1/boards/[slug]/export.md/+server.ts`:

```ts
import { error } from '@sveltejs/kit';
import { loadBoardExport, toMarkdown, exportRateLimiter } from '$lib/server/export.js';
import { metric } from '$lib/server/statsd.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params, url, getClientAddress }) => {
	if (!exportRateLimiter.check(getClientAddress())) {
		throw error(429, 'Too many requests');
	}

	const lang = url.searchParams.get('lang') === 'ru' ? 'ru' : 'en';
	const data = await loadBoardExport(params.slug, url.origin);
	if (!data) {
		throw error(404, 'Board not found');
	}

	metric('retro.export.api', 1);

	return new Response(toMarkdown(data, lang), {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Cache-Control': 'no-cache'
		}
	});
};
```

- [ ] **Step 2: Маршрут export.json**

Создать `src/routes/api/v1/boards/[slug]/export.json/+server.ts`:

```ts
import { error } from '@sveltejs/kit';
import { loadBoardExport, exportRateLimiter } from '$lib/server/export.js';
import { metric } from '$lib/server/statsd.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params, url, getClientAddress }) => {
	if (!exportRateLimiter.check(getClientAddress())) {
		throw error(429, 'Too many requests');
	}

	const data = await loadBoardExport(params.slug, url.origin);
	if (!data) {
		throw error(404, 'Board not found');
	}

	metric('retro.export.api', 1);

	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-cache'
		}
	});
};
```

- [ ] **Step 3: Переписать старый маршрут на общий модуль**

Полностью заменить содержимое `src/routes/[slug]/export/+server.ts` на:

```ts
import { error } from '@sveltejs/kit';
import { loadBoardExport, toMarkdown } from '$lib/server/export.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params, url }) => {
	const format = url.searchParams.get('format') || 'json';
	const lang = url.searchParams.get('lang') === 'ru' ? 'ru' : 'en';

	const data = await loadBoardExport(params.slug, url.origin);
	if (!data) {
		throw error(404, 'Board not found');
	}

	const safeTitle = data.board.title.replace(/[^a-zA-Z0-9_-]/g, '_');

	if (format === 'md') {
		return new Response(toMarkdown(data, lang), {
			headers: {
				'Content-Type': 'text/markdown; charset=utf-8',
				'Content-Disposition': `attachment; filename="board-${safeTitle}.md"`
			}
		});
	}

	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="board-${safeTitle}.json"`
		}
	});
};
```

- [ ] **Step 4: Проверить, что маршруты с точкой в сегменте собираются**

Run: `npm run build`
Expected: сборка завершается без ошибок (риск из спеки: директория `export.md` — валидный сегмент SvelteKit; если build падает на роутинге — остановиться и разбираться, не обходить).

- [ ] **Step 5: Commit**

```bash
git add "src/routes/api/v1/boards/[slug]/export.md/+server.ts" "src/routes/api/v1/boards/[slug]/export.json/+server.ts" "src/routes/[slug]/export/+server.ts"
git commit -m "Add public API v1: board export as inline markdown/json by URL

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Страница документации `/api` + ссылки на неё

**Files:**
- Create: `src/routes/api/+page.svelte`
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/ru.json`
- Modify: `src/lib/components/Header.svelte:138-144` (пункт меню после MD-экспорта)
- Modify: `src/routes/+page.svelte:200-205` (ссылка в футере лендинга)

**Interfaces:**
- Consumes: endpoints из Task 4 (документируемые URL), `Header.svelte`, ключи i18n.
- Produces: страница `GET /api` (коэкзистирует с `/api/*` server-маршрутами — у них нет `+page.svelte`), ключи `apiDocs.*` и `export.api`.

- [ ] **Step 1: Добавить i18n-ключи**

В `src/lib/i18n/en.json` после ключей `apiExport.*` (Task 2) добавить:

```json
	"export.api": "API for agents",

	"apiDocs.title": "API",
	"apiDocs.subtitle": "Read-only access to boards for scripts and AI agents",
	"apiDocs.intro": "Every board is addressable by its board code — the same code that is in the link you share with your team. No API keys, no signup: the board code is the access key.",
	"apiDocs.security.title": "Link = access",
	"apiDocs.security.desc": "Anyone who knows a board code can read the board through the API — exactly like the board page itself. Share links deliberately.",
	"apiDocs.endpoints.title": "Endpoints",
	"apiDocs.md.desc": "Board as Markdown. Give this URL to an AI agent to turn your retro into a list of action items.",
	"apiDocs.json.desc": "Board as JSON: columns, cards, votes, comments, image links and timestamps.",
	"apiDocs.params.title": "Parameters",
	"apiDocs.params.lang": "language of section headings in Markdown: en (default) or ru",
	"apiDocs.example.title": "Example",
	"apiDocs.limits.title": "Limits and errors",
	"apiDocs.limits.rate": "30 requests per minute per IP — 429 when exceeded",
	"apiDocs.limits.notfound": "Unknown board code — 404",
	"apiDocs.back": "← Back",
```

В `src/lib/i18n/ru.json` в том же месте:

```json
	"export.api": "API для агентов",

	"apiDocs.title": "API",
	"apiDocs.subtitle": "Доступ к доскам на чтение для скриптов и AI-агентов",
	"apiDocs.intro": "Каждая доска адресуется своим кодом — тем же, что в ссылке, которой вы делитесь с командой. Без API-ключей и регистрации: код доски и есть ключ доступа.",
	"apiDocs.security.title": "Ссылка = доступ",
	"apiDocs.security.desc": "Любой, кто знает код доски, может прочитать её через API — так же, как саму страницу доски. Делитесь ссылками осознанно.",
	"apiDocs.endpoints.title": "Эндпоинты",
	"apiDocs.md.desc": "Доска в Markdown. Дайте этот URL AI-агенту, чтобы превратить ретро в список задач.",
	"apiDocs.json.desc": "Доска в JSON: колонки, карточки, голоса, комментарии, ссылки на картинки и даты.",
	"apiDocs.params.title": "Параметры",
	"apiDocs.params.lang": "язык заголовков разделов в Markdown: en (по умолчанию) или ru",
	"apiDocs.example.title": "Пример",
	"apiDocs.limits.title": "Лимиты и ошибки",
	"apiDocs.limits.rate": "30 запросов в минуту с одного IP — при превышении 429",
	"apiDocs.limits.notfound": "Неизвестный код доски — 404",
	"apiDocs.back": "← Назад",
```

- [ ] **Step 2: Проверить целостность словарей**

Run: `npm test -- src/lib/i18n`
Expected: PASS.

- [ ] **Step 3: Создать страницу**

Создать `src/routes/api/+page.svelte`:

```svelte
<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { t } from '$lib/i18n/index.js';
</script>

<svelte:head>
	<title>{t('apiDocs.title')} — {t('header.brand')}</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header showCreate={true} />

	<main class="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
		<h1 class="font-heading text-3xl font-bold tracking-tight text-text-primary">{t('apiDocs.title')}</h1>
		<p class="mt-2 text-text-secondary">{t('apiDocs.subtitle')}</p>

		<p class="mt-6 text-sm leading-relaxed text-text-secondary">{t('apiDocs.intro')}</p>

		<div class="mt-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
			<strong>{t('apiDocs.security.title')}.</strong>
			{t('apiDocs.security.desc')}
		</div>

		<h2 class="font-heading mt-10 text-lg font-bold text-text-primary">{t('apiDocs.endpoints.title')}</h2>

		<div class="mt-4 space-y-6">
			<div>
				<div class="flex flex-wrap items-center gap-2">
					<span class="badge-sm badge-accent">GET</span>
					<code class="text-[13px] font-semibold text-text-primary">/api/v1/boards/&#123;boardId&#125;/export.md</code>
				</div>
				<p class="mt-1.5 text-sm text-text-secondary">{t('apiDocs.md.desc')}</p>
			</div>
			<div>
				<div class="flex flex-wrap items-center gap-2">
					<span class="badge-sm badge-accent">GET</span>
					<code class="text-[13px] font-semibold text-text-primary">/api/v1/boards/&#123;boardId&#125;/export.json</code>
				</div>
				<p class="mt-1.5 text-sm text-text-secondary">{t('apiDocs.json.desc')}</p>
			</div>
		</div>

		<h2 class="font-heading mt-10 text-lg font-bold text-text-primary">{t('apiDocs.params.title')}</h2>
		<p class="mt-2 text-sm text-text-secondary">
			<code class="rounded bg-surface-hover px-1.5 py-0.5 text-[12px]">?lang=en|ru</code>
			— {t('apiDocs.params.lang')}
		</p>

		<h2 class="font-heading mt-10 text-lg font-bold text-text-primary">{t('apiDocs.example.title')}</h2>
		<pre class="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-card p-4 text-[12px] leading-relaxed text-text-primary"><code>curl https://retrospectrix.ru/api/v1/boards/V1StGXR8_Z5jdHi6B-myT/export.md

# Sprint 42

## Went Well

- CI is finally green — *Maria* [3 likes]
  - Huge relief! — *Peter*</code></pre>

		<h2 class="font-heading mt-10 text-lg font-bold text-text-primary">{t('apiDocs.limits.title')}</h2>
		<ul class="mt-2 list-inside list-disc space-y-1 text-sm text-text-secondary">
			<li>{t('apiDocs.limits.rate')}</li>
			<li>{t('apiDocs.limits.notfound')}</li>
		</ul>

		<a href="/" class="mt-10 inline-block text-[13px] font-medium text-accent transition-colors hover:text-accent-hover">{t('apiDocs.back')}</a>
	</main>
</div>
```

- [ ] **Step 4: Пункт меню в Header**

В `src/lib/components/Header.svelte` сразу ПОСЛЕ кнопки MD-экспорта (после `</button>` строки 144, перед `{#if boardStore.isCreator}`) добавить:

```svelte
							<a
								href="/api"
								onclick={() => (menuOpen = false)}
								class="dropdown-item"
							>
								<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
								{t('export.api')}
							</a>
```

- [ ] **Step 5: Ссылка в футере лендинга**

В `src/routes/+page.svelte` в футере (строки 201-205) после ссылки на changelog добавить пару разделитель+ссылка. Итоговый блок:

```svelte
		<div class="mb-2 flex items-center justify-center gap-4">
			<a href="/changelog" class="transition-colors hover:text-text-secondary">{t('changelog.title')}</a>
			<span class="text-border">·</span>
			<a href="/api" class="transition-colors hover:text-text-secondary">API</a>
			<span class="text-border">·</span>
			<button onclick={() => feedbackStore.show()} class="transition-colors hover:text-text-secondary">{t('feedback.link')}</button>
		</div>
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/api/+page.svelte src/lib/i18n/en.json src/lib/i18n/ru.json src/lib/components/Header.svelte src/routes/+page.svelte
git commit -m "Add /api docs page, link it from board menu and landing footer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Security-фикс — не отдавать `creatorToken` в `board:state`

**Files:**
- Modify: `server.js:370-375`

**Interfaces:**
- Consumes: ничего нового.
- Produces: сокет-payload `board` = whitelist `{ id, slug, title, spaceId, createdAt }`. Клиентский тип `Board` (`src/lib/types.ts:4-9`) и так не содержит `creatorToken` — регрессий нет. Страница (`[slug]/+page.server.ts:61-67`) уже отдаёт whitelist — менять не надо.

- [ ] **Step 1: Заменить emit**

В `server.js` строки 370-375 заменить:

```js
			socket.emit('board:state', {
				board,
				cards: boardCards.map(c => decryptCard(c, c.imageId ? imageMetaMap[c.imageId] : null)),
				votes: boardVotes,
				comments: boardComments.map(c => decryptComment(c, c.imageId ? imageMetaMap[c.imageId] : null))
			});
```

на:

```js
			socket.emit('board:state', {
				// Whitelist board fields — never leak creatorToken to visitors
				board: {
					id: board.id,
					slug: board.slug,
					title: board.title,
					spaceId: board.spaceId,
					createdAt: board.createdAt
				},
				cards: boardCards.map(c => decryptCard(c, c.imageId ? imageMetaMap[c.imageId] : null)),
				votes: boardVotes,
				comments: boardComments.map(c => decryptComment(c, c.imageId ? imageMetaMap[c.imageId] : null))
			});
```

- [ ] **Step 2: Проверить, что других мест утечки нет**

Run: `grep -n "creatorToken" server.js`
Expected: вхождения только в `roomCreatorTokens` логике (строки ~308, 316, 339, 521-537, 548) и duplicated schema — ни одно не эмитит токен клиенту. Если найдено другое `emit` с токеном — исправить так же.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "Security: stop leaking board creatorToken in socket board:state payload

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Re-join комнаты после реконнекта сокета

**Files:**
- Modify: `src/lib/stores/socket.svelte.ts:11-60, 58-60, 90-94`

**Interfaces:**
- Consumes: существующий `SocketStore`.
- Produces: `joinBoard` запоминает slug/token; обработчик `connect` повторно эмитит `board:join` при реконнекте (не при первом подключении — иначе двойной join, т.к. socket.io буферизует первый emit).

- [ ] **Step 1: Изменить SocketStore**

В `src/lib/stores/socket.svelte.ts`:

1. После полей класса (после строки 9 `timerDuration = ...`) добавить:

```ts
	private currentSlug: string | null = null;
	private currentCreatorToken = '';
	private everConnected = false;
```

2. Заменить обработчик `connect` (строки 16-18):

```ts
		this.socket.on('connect', () => {
			this.connected = true;
			// Re-join the room after a reconnect (deploy, network blip) — the first
			// join is emitted by joinBoard() and buffered by socket.io, so skip it here.
			if (this.everConnected && this.currentSlug) {
				this.socket?.emit('board:join', {
					slug: this.currentSlug,
					creatorToken: this.currentCreatorToken
				});
			}
			this.everConnected = true;
		});
```

3. Заменить `joinBoard` (строки 58-60):

```ts
	joinBoard(slug: string, creatorToken?: string | null) {
		this.currentSlug = slug;
		this.currentCreatorToken = creatorToken ?? '';
		this.socket?.emit('board:join', { slug, creatorToken: creatorToken ?? '' });
	}
```

4. Заменить `disconnect` (строки 90-94):

```ts
	disconnect() {
		this.socket?.disconnect();
		this.socket = null;
		this.connected = false;
		this.currentSlug = null;
		this.currentCreatorToken = '';
		this.everConnected = false;
	}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/stores/socket.svelte.ts
git commit -m "Fix: re-join board room after socket reconnect so live updates resume

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Заметный индикатор комментариев (CommentList)

**Files:**
- Modify: `src/lib/components/CommentList.svelte` (полная замена)
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/ru.json` (ключ `comment.add`)

**Interfaces:**
- Consumes: `.badge-pop`, `.collapsible/.open` из `app.css`, `boardStore.getCardComments`.
- Produces: тот же компонент `<CommentList cardId={string} />` — Task 9 вставляет его в Summary без изменений.

- [ ] **Step 1: Добавить i18n-ключ**

В `en.json` после `"comment.count"`: `"comment.add": "Comment",`
В `ru.json` после `"comment.count"`: `"comment.add": "Комментировать",`

- [ ] **Step 2: Переписать компонент**

Полностью заменить `src/lib/components/CommentList.svelte` на:

```svelte
<script lang="ts">
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { lightboxStore } from '$lib/stores/lightbox.svelte.js';
	import CommentForm from './CommentForm.svelte';
	import type { Comment } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	let { cardId }: { cardId: string } = $props();

	let expanded = $state(false);
	let cardComments = $derived(
		boardStore.getCardComments(cardId).sort(
			(a: Comment, b: Comment) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		)
	);
	let count = $derived(cardComments.length);
</script>

<div class="mt-2 border-t border-border pt-2">
	<button
		onclick={() => (expanded = !expanded)}
		aria-expanded={expanded}
		class="flex items-center text-[11px] transition-colors {count > 0
			? 'rounded-md bg-accent/10 px-2 py-0.5 font-medium text-accent hover:bg-accent/20'
			: 'text-text-muted hover:text-text-secondary'}"
	>
		{#key count}
			<span class="flex items-center gap-1 {count > 0 ? 'badge-pop' : ''}">
				{#if count > 0}
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
					{t('comment.count', { n: count })}
				{:else}
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
					{t('comment.add')}
				{/if}
			</span>
		{/key}
	</button>

	<div class="collapsible {expanded ? 'open' : ''}">
		<div>
			<div class="mt-2 space-y-2">
				{#each cardComments as comment (comment.id)}
					<div class="rounded-md bg-surface px-2.5 py-1.5 text-xs">
						{#if comment.authorName}
							<span class="font-medium text-text-secondary">{comment.authorName}</span>
							<span class="text-text-muted mx-1">&middot;</span>
						{/if}
						{#if comment.content}
							<span class="text-text-primary">{comment.content}</span>
						{/if}
						{#if comment.imageId}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
							<img
								src="/api/image/{comment.imageId}"
								alt=""
								class="mt-1 max-h-32 cursor-zoom-in rounded border border-border object-contain transition-transform hover:scale-[1.02]"
								onclick={() => lightboxStore.open(comment.imageId!)}
							/>
						{/if}
					</div>
				{/each}
				<CommentForm {cardId} />
			</div>
		</div>
	</div>
</div>
```

Ключевые отличия от старой версии: при `count > 0` — акцентная пилюля (`bg-accent/10 text-accent`) с залитой иконкой; при `0` — тусклая надпись «Комментировать» (точка входа для добавления); `{#key count}` перезапускает `badge-pop` при каждом новом комментарии; раскрытие через `.collapsible` вместо `{#if}`; `aria-expanded`.

- [ ] **Step 3: Проверить словари**

Run: `npm test -- src/lib/i18n`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/CommentList.svelte src/lib/i18n/en.json src/lib/i18n/ru.json
git commit -m "Make comment indicator visible: accent badge when comments exist, smooth expand

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Комментарии в итоговом списке (Summary)

**Files:**
- Modify: `src/lib/components/Summary.svelte` (полная замена)
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/ru.json` (ключ `summary.photo`)

**Interfaces:**
- Consumes: `<CommentList cardId />` (Task 8), `boardStore.getSummaryCards/getCardLikes`.
- Produces: ничего нового для других задач.

- [ ] **Step 1: Добавить i18n-ключ**

В `en.json` после `"summary.empty"`: `"summary.photo": "Photo",`
В `ru.json` после `"summary.empty"`: `"summary.photo": "Фото",`

- [ ] **Step 2: Переписать компонент**

Полностью заменить `src/lib/components/Summary.svelte` на:

```svelte
<script lang="ts">
	import { boardStore } from '$lib/stores/board.svelte.js';
	import CommentList from './CommentList.svelte';
	import type { ColumnType } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	let summaryCards = $derived(boardStore.getSummaryCards());

	const tagColors: Record<ColumnType, string> = {
		went_well: 'bg-well-bg text-well',
		didnt_go_well: 'bg-bad-bg text-bad',
		improve: 'bg-improve-bg text-improve'
	};
</script>

<div class="border-t border-border bg-surface-card/50 p-4 sm:p-6 lg:p-8">
	<h2 class="font-heading mb-4 text-lg font-bold text-text-primary">{t('summary.title')}</h2>

	{#if summaryCards.length === 0}
		<div class="flex flex-col items-center gap-2 py-6 text-center">
			<svg class="h-8 w-8 text-text-muted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/></svg>
			<p class="text-[13px] text-text-muted">{t('summary.empty')}</p>
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			{#each summaryCards as card, i (card.id)}
				{@const showHeader = card.columnType !== (i > 0 ? summaryCards[i - 1].columnType : '')}
				{#if showHeader}
					<div class="mt-2 first:mt-0">
						<span class="badge-sm {tagColors[card.columnType]}">
							{t(`column.${card.columnType}`)}
						</span>
					</div>
				{/if}
				<div class="rounded-[10px] border border-border bg-surface-card py-2 px-2.5 transition-colors hover:border-border-strong">
					<div class="flex items-center gap-2.5">
						<span class="shrink-0 min-w-6 text-center text-[11px] font-semibold tabular-nums text-text-muted">
							{boardStore.getCardLikes(card.id)} &uarr;
						</span>
						{#if card.content}
							<p class="flex-1 text-[13px] text-text-primary">{card.content}</p>
						{:else}
							<p class="flex-1 text-[13px] italic text-text-muted">{t('summary.photo')}</p>
						{/if}
						{#if card.imageId}
							<svg class="h-3.5 w-3.5 shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
						{/if}
					</div>
					<CommentList cardId={card.id} />
				</div>
			{/each}
		</div>
	{/if}
</div>
```

Отличия: строка стала контейнером (убран `hover:translate-x-0.5` — внутри теперь интерактив), под текстом — `<CommentList>`; карточки-фото получают иконку и метку вместо пустой строки; удалена мёртвая константа `accentColors`.

- [ ] **Step 3: Проверить словари**

Run: `npm test -- src/lib/i18n`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/Summary.svelte src/lib/i18n/en.json src/lib/i18n/ru.json
git commit -m "Summary: show comments per card, mark image-only cards

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Один `vote:toggle` вместо двух

**Files:**
- Modify: `src/lib/components/VoteButtons.svelte:19-27`

**Interfaces:**
- Consumes: серверный `vote:toggle` (`server.js:463-491`) — уже сам снимает противоположный голос перед вставкой и бродкастит полный список голосов карточки.
- Produces: ничего нового.

- [ ] **Step 1: Упростить vote()**

В `src/lib/components/VoteButtons.svelte` заменить функцию `vote` (строки 19-27) на:

```ts
	function vote(type: 'like' | 'dislike') {
		// Server removes the opposite vote itself and broadcasts the full vote list
		socketStore.toggleVote(cardId, type, sessionId);
		bouncing = type;
		setTimeout(() => (bouncing = null), 300);
	}
```

(Удаляются строки с `const opposite = ...` и условным вторым emit.)

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/VoteButtons.svelte
git commit -m "Fix: single vote:toggle emit when switching like/dislike

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Действия карточки — перенос между колонками, confirm удаления, тач-видимость

**Files:**
- Modify: `server.js:417-452` (card:update принимает `columnType`)
- Modify: `src/lib/stores/socket.svelte.ts` (метод `moveCard`)
- Modify: `src/app.css` (утилита `.hover-reveal`)
- Modify: `src/lib/components/Card.svelte` (полная замена)
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/ru.json` (ключи `card.move`, `card.delete.confirm`)

**Interfaces:**
- Consumes: `socketStore.updateCard/deleteCard`, классы `badge-sm` и цветовые пары `bg-well-bg text-well` и т.п.
- Produces: `socketStore.moveCard(cardId: string, columnType: string): void`; серверный `card:update` принимает опциональный `columnType` (валидация по enum); CSS-класс `.hover-reveal` (виден всегда, скрыт до hover только на hover-устройствах).

- [ ] **Step 1: i18n-ключи**

В `en.json` после `"card.delete"`:

```json
	"card.move": "Move to",
	"card.delete.confirm": "Tap again to delete",
```

В `ru.json` после `"card.delete"`:

```json
	"card.move": "Переместить в",
	"card.delete.confirm": "Нажмите ещё раз — удалить",
```

- [ ] **Step 2: server.js — columnType в card:update**

В `server.js` заменить начало обработчика `card:update` (строки 417-424, до блока `if (content !== undefined)`) на:

```js
	socket.on('card:update', async ({ cardId, content, imageId: imgId, columnType }) => {
		const hasContent = content && typeof content === 'string' && content.trim().length > 0;
		const hasImage = imgId && typeof imgId === 'string';
		const validColumns = ['went_well', 'didnt_go_well', 'improve'];
		const hasColumn = columnType !== undefined;
		if (hasColumn && !validColumns.includes(columnType)) return;
		if (!hasContent && imgId === undefined && !hasColumn) return; // must update something
		if (hasContent && content.length > 2000) return;

		let imageMeta = null;
		const updates = {};
		if (content !== undefined) updates.content = encrypt(content || '');
		if (hasColumn) updates.columnType = columnType;
```

Остальное тело обработчика (блок `if (imgId !== undefined)` и `try { ... }`) — без изменений.

- [ ] **Step 3: socketStore.moveCard**

В `src/lib/stores/socket.svelte.ts` после метода `updateCard` добавить:

```ts
	moveCard(cardId: string, columnType: string) {
		this.socket?.emit('card:update', { cardId, columnType });
	}
```

- [ ] **Step 4: CSS-утилита hover-reveal**

В `src/app.css` внутри блока `@layer components` (перед закрывающей `}` слоя, после `.error-box-sm`) добавить:

```css

	/* ---------- HOVER REVEAL ---------- */
	/* Always visible on touch devices; hidden-until-hover only where hover exists */
	@media (hover: hover) {
		.hover-reveal { opacity: 0; }
		.group:hover .hover-reveal,
		.hover-reveal:focus-visible { opacity: 1; }
	}
```

- [ ] **Step 5: Переписать Card.svelte**

Полностью заменить `src/lib/components/Card.svelte` на:

```svelte
<script lang="ts">
	import VoteButtons from './VoteButtons.svelte';
	import CommentList from './CommentList.svelte';
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { lightboxStore } from '$lib/stores/lightbox.svelte.js';
	import type { Card, ColumnType } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	let { card }: { card: Card } = $props();

	let editing = $state(false);
	let editContent = $state('');
	let moveOpen = $state(false);
	let deleteConfirming = $state(false);
	let confirmTimeout: ReturnType<typeof setTimeout> | null = null;

	const ALL_COLUMNS: ColumnType[] = ['went_well', 'didnt_go_well', 'improve'];
	let otherColumns = $derived(ALL_COLUMNS.filter((c) => c !== card.columnType));

	const tagColors: Record<ColumnType, string> = {
		went_well: 'bg-well-bg text-well',
		didnt_go_well: 'bg-bad-bg text-bad',
		improve: 'bg-improve-bg text-improve'
	};

	function startEdit() {
		editContent = card.content;
		editing = true;
	}

	function saveEdit() {
		const text = editContent.trim();
		if (text && text !== card.content) {
			socketStore.updateCard(card.id, text);
		}
		editing = false;
	}

	function cancelEdit() {
		editing = false;
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			saveEdit();
		}
		if (e.key === 'Escape') cancelEdit();
	}

	function moveTo(col: ColumnType) {
		socketStore.moveCard(card.id, col);
		moveOpen = false;
	}

	function requestDelete() {
		if (deleteConfirming) {
			if (confirmTimeout) clearTimeout(confirmTimeout);
			confirmTimeout = null;
			deleteConfirming = false;
			socketStore.deleteCard(card.id);
		} else {
			deleteConfirming = true;
			confirmTimeout = setTimeout(() => (deleteConfirming = false), 3000);
		}
	}
</script>

<div class="card-board card-interactive overflow-hidden hover:scale-[1.005]">
	<div class="flex items-start justify-between gap-2">
		{#if editing}
			<textarea
				bind:value={editContent}
				onkeydown={handleEditKeydown}
				onblur={saveEdit}
				maxlength="2000"
				class="flex-1 resize-none rounded border border-border bg-surface p-1.5 text-sm text-text-primary focus:border-border-strong focus:outline-none"
				rows="2"
			></textarea>
		{:else}
			{#if card.content}
				<p class="flex-1 text-[13px] leading-relaxed text-text-primary whitespace-pre-wrap break-words">{card.content}</p>
			{:else}
				<div class="flex-1"></div>
			{/if}
			<div class="flex shrink-0 gap-0.5">
				<button
					onclick={() => (moveOpen = !moveOpen)}
					class="hover-reveal rounded p-1 text-text-muted transition-all hover:bg-surface-hover hover:text-text-secondary {moveOpen ? 'bg-surface-hover text-text-secondary opacity-100' : ''}"
					aria-label={t('card.move')}
					aria-expanded={moveOpen}
					title={t('card.move')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="17 11 21 7 17 3"/>
						<line x1="21" y1="7" x2="9" y2="7"/>
						<polyline points="7 21 3 17 7 13"/>
						<line x1="15" y1="17" x2="3" y2="17"/>
					</svg>
				</button>
				<button
					onclick={startEdit}
					class="hover-reveal rounded p-1 text-text-muted transition-all hover:bg-surface-hover hover:text-text-secondary"
					aria-label={t('card.edit')}
					title={t('card.edit')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
					</svg>
				</button>
				<button
					onclick={requestDelete}
					class="hover-reveal rounded p-1 transition-all {deleteConfirming
						? 'bg-red-500 text-white opacity-100 hover:bg-red-600'
						: 'text-text-muted hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30'}"
					aria-label={deleteConfirming ? t('card.delete.confirm') : t('card.delete')}
					title={deleteConfirming ? t('card.delete.confirm') : t('card.delete')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>
		{/if}
	</div>

	{#if moveOpen}
		<div class="mt-2 flex flex-wrap items-center gap-1.5" style="animation: fadeUp 0.25s cubic-bezier(0.25, 1, 0.5, 1) both;">
			<span class="text-[11px] text-text-muted">{t('card.move')}:</span>
			{#each otherColumns as col (col)}
				<button onclick={() => moveTo(col)} class="badge-sm {tagColors[col]} transition-transform hover:scale-105">
					{t(`column.${col}`)}
				</button>
			{/each}
		</div>
	{/if}

	{#if card.imageId}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<img
			src="/api/image/{card.imageId}"
			alt=""
			width={card.imageWidth || undefined}
			height={card.imageHeight || undefined}
			style={card.imageWidth && card.imageHeight ? `aspect-ratio: ${card.imageWidth}/${card.imageHeight}` : ''}
			class="mt-2 max-h-48 w-full cursor-zoom-in rounded-lg object-contain transition-transform hover:scale-[1.02]"
			onclick={() => lightboxStore.open(card.imageId!)}
		/>
	{/if}

	{#if card.authorName}
		<p class="mt-1 text-[11px] text-text-muted">— {card.authorName}</p>
	{/if}

	<div class="mt-2 flex items-center justify-between">
		<VoteButtons cardId={card.id} />
	</div>

	<CommentList cardId={card.id} />
</div>
```

Важное: карточка имеет `overflow-hidden`, поэтому перенос сделан inline-панелью (появляется под текстом), а НЕ absolute-дропдауном — дропдаун обрезался бы.

- [ ] **Step 6: Проверить словари**

Run: `npm test -- src/lib/i18n`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server.js src/lib/stores/socket.svelte.ts src/app.css src/lib/components/Card.svelte src/lib/i18n/en.json src/lib/i18n/ru.json
git commit -m "Card actions: move between columns, delete confirmation, touch-visible buttons

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Сортировка колонки по голосам

**Files:**
- Modify: `src/lib/stores/board.svelte.ts:47-51`
- Modify: `src/lib/components/Column.svelte`
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/ru.json`
- Test: `src/lib/stores/board.test.ts` (добавить 2 теста)

**Interfaces:**
- Consumes: `boardStore.getCardLikes`.
- Produces: `boardStore.getColumnCards(columnType: string, sortBy?: 'newest' | 'votes')` — дефолт `'newest'` сохраняет поведение существующих вызовов.

- [ ] **Step 1: Написать падающие тесты**

В `src/lib/stores/board.test.ts` внутрь `describe('BoardStore', ...)` добавить:

```ts
	it('getColumnCards sorts by votes desc when sortBy=votes', () => {
		boardStore.setState({
			board,
			cards: [
				makeCard({ id: 'c1', createdAt: '2025-01-02T00:00:00Z' }),
				makeCard({ id: 'c2', createdAt: '2025-01-01T00:00:00Z' })
			],
			votes: [makeVote({ id: 'v1', cardId: 'c2' })],
			comments: []
		});
		expect(boardStore.getColumnCards('went_well', 'votes').map((c) => c.id)).toEqual(['c2', 'c1']);
	});

	it('getColumnCards falls back to newest-first among equal votes', () => {
		boardStore.setState({
			board,
			cards: [
				makeCard({ id: 'c1', createdAt: '2025-01-01T00:00:00Z' }),
				makeCard({ id: 'c2', createdAt: '2025-01-02T00:00:00Z' })
			],
			votes: [],
			comments: []
		});
		expect(boardStore.getColumnCards('went_well', 'votes').map((c) => c.id)).toEqual(['c2', 'c1']);
	});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test -- src/lib/stores/board.test.ts`
Expected: FAIL — второй аргумент игнорируется, порядок `['c1', 'c2']` в первом тесте.

- [ ] **Step 3: Реализация в сторе**

В `src/lib/stores/board.svelte.ts` заменить `getColumnCards` (строки 47-51) на:

```ts
	getColumnCards(columnType: string, sortBy: 'newest' | 'votes' = 'newest') {
		const filtered = this.cards.filter((c) => c.columnType === columnType);
		if (sortBy === 'votes') {
			return filtered.sort(
				(a, b) =>
					this.getCardLikes(b.id) - this.getCardLikes(a.id) ||
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);
		}
		return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test -- src/lib/stores/board.test.ts`
Expected: PASS (все, включая существующие).

- [ ] **Step 5: i18n-ключи**

В `en.json` после `"column.cards"`:

```json
	"column.sort.votes": "Sort by votes",
	"column.sort.newest": "Sort by newest",
```

В `ru.json` после `"column.cards"`:

```json
	"column.sort.votes": "Сортировать по голосам",
	"column.sort.newest": "Сначала новые",
```

- [ ] **Step 6: Тумблер в Column.svelte**

В `src/lib/components/Column.svelte`:

1. В `<script>` после `let config = ...` добавить:

```ts
	let sortBy = $state<'newest' | 'votes'>('newest');
```

2. Заменить `let columnCards = $derived(boardStore.getColumnCards(column));` на:

```ts
	let columnCards = $derived(boardStore.getColumnCards(column, sortBy));
```

3. В заголовке колонки заменить строку 35 (`<span class="ml-auto ...">{columnCards.length}</span>`) на:

```svelte
		<button
			onclick={() => (sortBy = sortBy === 'newest' ? 'votes' : 'newest')}
			class="btn-icon btn-icon-sm ml-auto {sortBy === 'votes' ? 'text-accent' : ''}"
			aria-label={sortBy === 'votes' ? t('column.sort.newest') : t('column.sort.votes')}
			title={sortBy === 'votes' ? t('column.sort.newest') : t('column.sort.votes')}
			aria-pressed={sortBy === 'votes'}
		>
			<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
		</button>
		<span class="text-[11px] tabular-nums text-text-muted">{columnCards.length}</span>
```

- [ ] **Step 7: Проверить словари**

Run: `npm test -- src/lib/i18n`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/stores/board.svelte.ts src/lib/stores/board.test.ts src/lib/components/Column.svelte src/lib/i18n/en.json src/lib/i18n/ru.json
git commit -m "Column header toggle: sort cards by votes for discussion phase

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: UX таймера — скрытый футер в простое, пульс и автоскрытие по истечении

**Files:**
- Modify: `src/lib/stores/socket.svelte.ts` (метод `clearTimerLocal`)
- Modify: `src/lib/components/Timer.svelte:14-45, 103`
- Modify: `src/routes/[slug]/+page.svelte:42-46`
- Modify: `src/app.css` (keyframes `timerPulse`)

**Interfaces:**
- Consumes: `socketStore.timerEnd/timerDuration`, `boardStore.isCreator`.
- Produces: `socketStore.clearTimerLocal(): void` — локально обнуляет `timerEnd`/`timerDuration` (не трогает сервер: у сервера таймер и так игнорируется после `endTime`).

- [ ] **Step 1: clearTimerLocal в сторе**

В `src/lib/stores/socket.svelte.ts` после обработчиков в `connect()` (после метода `joinBoard`) добавить метод:

```ts
	clearTimerLocal() {
		this.timerEnd = null;
		this.timerDuration = null;
	}
```

- [ ] **Step 2: Timer.svelte — авто-скрытие и пульс**

В `src/lib/components/Timer.svelte`:

1. После `let timer: ReturnType<typeof setInterval> | null = null;` (строка 12) добавить:

```ts
	let dismissTimer: ReturnType<typeof setTimeout> | null = null;
```

2. Заменить функцию `tick()` (строки 14-27) на:

```ts
	function tick() {
		if (!socketStore.timerEnd) {
			remaining = null;
			expired = false;
			return;
		}
		const left = Math.max(0, Math.ceil((socketStore.timerEnd - Date.now()) / 1000));
		remaining = left;
		if (left === 0 && !expired) {
			expired = true;
			if (timer) clearInterval(timer);
			timer = null;
			// Pulse for 5 seconds, then hide the bar automatically
			dismissTimer = setTimeout(() => socketStore.clearTimerLocal(), 5000);
		}
	}
```

3. Заменить `$effect` (строки 29-45) на:

```ts
	$effect(() => {
		if (socketStore.timerEnd) {
			expired = false;
			if (dismissTimer) {
				clearTimeout(dismissTimer);
				dismissTimer = null;
			}
			tick();
			if (timer) clearInterval(timer);
			timer = setInterval(tick, 250);
		} else {
			remaining = null;
			expired = false;
			if (timer) clearInterval(timer);
			timer = null;
			if (dismissTimer) {
				clearTimeout(dismissTimer);
				dismissTimer = null;
			}
		}
		return () => {
			if (timer) clearInterval(timer);
			timer = null;
			if (dismissTimer) clearTimeout(dismissTimer);
			dismissTimer = null;
		};
	});
```

4. В разметке заменить строку 103 (`<span class="text-lg font-bold ...`) — добавить пульс при истечении:

```svelte
		<span class="text-lg font-bold tabular-nums tracking-tight {expired ? 'text-red-500 timer-pulse' : timeColor}">
```

- [ ] **Step 3: keyframes в app.css**

В `src/app.css` после блока `.vote-bounce` (после строки 220) добавить:

```css

/* Timer expiry pulse — draws attention when time is up */
@keyframes timerPulse {
	0%, 100% { opacity: 1; transform: scale(1); }
	50% { opacity: 0.5; transform: scale(1.06); }
}
.timer-pulse {
	animation: timerPulse 0.7s ease-in-out infinite;
}
```

- [ ] **Step 4:條условный футер на странице доски**

В `src/routes/[slug]/+page.svelte` обернуть футер (строки 42-46):

```svelte
	{#if socketStore.timerEnd !== null || boardStore.isCreator}
		<footer class="sticky bottom-0 border-t border-border bg-surface px-4 py-2.5 transition-colors">
			<div class="mx-auto flex max-w-7xl items-center justify-center">
				<Timer creatorToken={data.creatorToken} />
			</div>
		</footer>
	{/if}
```

(`socketStore` уже импортирован в этом файле.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/socket.svelte.ts src/lib/components/Timer.svelte "src/routes/[slug]/+page.svelte" src/app.css
git commit -m "Timer UX: hide idle footer for participants, pulse and auto-dismiss on expiry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 14: Локализация — дефолтный заголовок доски, Menu/Name в Header

**Files:**
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/ru.json` (ключ `header.menu`)
- Modify: `src/lib/components/Header.svelte:91-92, 180`
- Modify: `src/routes/new/+page.svelte` (hidden locale input)
- Modify: `src/routes/new/+page.server.ts:17`
- Modify: `src/lib/components/SpaceBoardGrid.svelte:55-67` (hidden locale input)
- Modify: `src/routes/spaces/[slug]/+page.server.ts:155`

**Interfaces:**
- Consumes: `localeStore.locale`.
- Produces: формы создания доски передают `locale` hidden-полем; server actions выбирают «Ретро»/«Retro» по нему.

- [ ] **Step 1: i18n-ключ**

В `en.json` после `"header.brand"`: `"header.menu": "Menu",`
В `ru.json` после `"header.brand"`: `"header.menu": "Меню",`

- [ ] **Step 2: Header.svelte**

Строки 91-92: заменить `aria-label="Menu"` и `title="Menu"` на:

```svelte
						aria-label={t('header.menu')}
						title={t('header.menu')}
```

Строка 180: заменить `placeholder="Name"` на:

```svelte
								placeholder={t('name.placeholder')}
```

- [ ] **Step 3: Форма /new**

В `src/routes/new/+page.svelte`:

1. В `<script>` добавить импорт: `import { localeStore } from '$lib/stores/locale.svelte.js';`
2. Внутри формы `?/createBoard` (после строки 80 `<form method="POST" action="?/createBoard" ...>`) первой строкой добавить:

```svelte
					<input type="hidden" name="locale" value={localeStore.locale} />
```

- [ ] **Step 4: Action createBoard в /new**

В `src/routes/new/+page.server.ts` заменить строку 17:

```ts
		const locale = formData.get('locale') === 'ru' ? 'ru' : 'en';
		const title = (formData.get('title') as string)?.trim().slice(0, 100) || (locale === 'ru' ? 'Ретро' : 'Retro');
```

- [ ] **Step 5: Форма создания доски в пространстве**

В `src/lib/components/SpaceBoardGrid.svelte`:

1. В `<script>` добавить импорт: `import { localeStore } from '$lib/stores/locale.svelte.js';`
2. Внутри `<form method="POST" action="/spaces/{spaceSlug}?/createBoard" ...>` (строка 55) первой строкой перед `<div class="flex gap-3">` добавить:

```svelte
			<input type="hidden" name="locale" value={localeStore.locale} />
```

- [ ] **Step 6: Action createBoard в пространстве**

В `src/routes/spaces/[slug]/+page.server.ts` заменить строку 155:

```ts
		const locale = formData.get('locale') === 'ru' ? 'ru' : 'en';
		const title = (formData.get('title') as string)?.trim() || (locale === 'ru' ? 'Ретро' : 'Retro');
```

- [ ] **Step 7: Проверить словари**

Run: `npm test -- src/lib/i18n`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/i18n/en.json src/lib/i18n/ru.json src/lib/components/Header.svelte src/routes/new/+page.svelte src/routes/new/+page.server.ts src/lib/components/SpaceBoardGrid.svelte "src/routes/spaces/[slug]/+page.server.ts"
git commit -m "i18n: locale-aware default board title, localize Menu and Name strings

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 15: Changelog v1.6.0, финальная проверка и деплой

**Files:**
- Modify: `src/routes/changelog/+page.svelte:11` (новый релиз в начало массива)

**Interfaces:**
- Consumes: всё выше.
- Produces: пуш в main → CI (tests → build → deploy).

- [ ] **Step 1: Запись в changelog**

В `src/routes/changelog/+page.svelte` в начало массива `releases` (после строки 11 `const releases: Release[] = [`) вставить:

```ts
		{
			version: '1.6.0',
			date: '2026-07-04',
			changes: [
				{ tag: 'feature', text: { en: 'API for agents — fetch any board as Markdown or JSON by URL, docs at /api', ru: 'API для агентов — получайте доску в Markdown или JSON по ссылке, дока на /api' } },
				{ tag: 'feature', text: { en: 'Comments are now available in the Summary list', ru: 'Комментарии теперь доступны в итоговом списке' } },
				{ tag: 'feature', text: { en: 'Move cards between columns', ru: 'Переносите карточки между колонками' } },
				{ tag: 'feature', text: { en: 'Sort any column by votes with one tap', ru: 'Сортируйте колонку по голосам в один клик' } },
				{ tag: 'improvement', text: { en: 'Cards with comments now show a bright badge', ru: 'У карточек с комментариями теперь яркий индикатор' } },
				{ tag: 'improvement', text: { en: 'Exports now include dislikes, images and dates', ru: 'В экспорт добавлены дизлайки, картинки и даты' } },
				{ tag: 'improvement', text: { en: 'Card buttons are always visible on phones and tablets', ru: 'Кнопки карточек всегда видны на телефонах и планшетах' } },
				{ tag: 'improvement', text: { en: 'Deleting a card now asks for confirmation', ru: 'Удаление карточки теперь требует подтверждения' } },
				{ tag: 'improvement', text: { en: 'Timer pulses when time is up and tidies itself away', ru: 'Таймер мигает по истечении времени и сам скрывается' } },
				{ tag: 'fix', text: { en: 'Board reconnects automatically after a connection loss', ru: 'Доска автоматически переподключается после обрыва связи' } },
				{ tag: 'fix', text: { en: 'Boards are better protected from uninvited changes', ru: 'Доски лучше защищены от нежелательных изменений' } }
			]
		},
```

- [ ] **Step 2: Тип-проверка всего проекта**

Run: `npm run check`
Expected: 0 errors (warnings допустимы, если они были и до изменений). Это НЕ тест-сьют — тесты прогонит CI.

- [ ] **Step 3: Commit + push**

```bash
git add src/routes/changelog/+page.svelte
git commit -m "Add v1.6.0 changelog: comments visibility, agents API, card actions, fixes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 4: Проверить CI и деплой**

Run: `gh run watch --exit-status` (или `gh run list --limit 1` и повторять до завершения)
Expected: workflow зелёный (test → build → deploy).

- [ ] **Step 5: Smoke-проверка прода**

Run: `curl -s -o /dev/null -w "%{http_code}" https://retrospectrix.ru/api` и `curl -s "https://retrospectrix.ru/api/v1/boards/nonexistent/export.md" -o /dev/null -w "%{http_code}"`
Expected: `200` для страницы доки, `404` для несуществующей доски. Если есть реальный slug доски — проверить, что `.../export.md` отдаёт markdown inline.

---

## Self-Review (выполнен при написании)

- **Покрытие спеки:** секция 1a → Task 8; 1b → Task 9; endpoints/сборщик/полнота/lang → Tasks 2-4; ratelimit → Task 1; дока+ссылки → Task 5; creatorToken → Task 6; reconnect → Task 7; перенос/confirm/тач → Task 11; vote → Task 10; сортировка → Task 12; таймер → Task 13; локализация → Task 14; changelog/деплой → Task 15. Пробелов нет.
- **Плейсхолдеров нет:** весь код приведён полностью.
- **Консистентность типов:** `createRateLimiter` (T1) ← T3; `translate` (T2) ← T3; `loadBoardExport/toMarkdown/exportRateLimiter` (T3) ← T4; `moveCard` (T11 step 3) ← T11 step 5; `clearTimerLocal` (T13 step 1) ← T13 step 2; `getColumnCards(col, sortBy?)` (T12) — дефолт сохраняет старые вызовы.
