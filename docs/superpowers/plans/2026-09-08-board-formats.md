# Форматы досок — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Доска создаётся в одном из пяти пресетных форматов (classic, Start Stop Continue, Mad Sad Glad, 4L, Sailboat); формат фиксируется при создании, старые доски работают как раньше.

**Architecture:** Реестр форматов — plain-JS модуль `board-formats.js` в корне (как `seo-paths.js`), его читают `server.js`, SvelteKit-код через `src/lib/formats.ts` и экспорт. `cards.column_type` становится текстом, `boards.format` хранит id формата, `spaces.last_format` — память пространства. UI берёт названия, порядок и цвета колонок из реестра по `tone`.

**Tech Stack:** SvelteKit / Svelte 5 runes, Drizzle (ручные SQL-миграции в `drizzle/`, применяет `migrate.js`), Socket.IO в `server.js`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-board-formats-design.md`

## Global Constraints

- Старые доски не ломаем: существующие карточки хранят `went_well / didnt_go_well / improve`, формат таких досок — `classic`; экспорт для них байт-в-байт прежний.
- Формат доски задаётся только при создании; API смены формата нет.
- Id формата равен slug SEO-страницы: `classic`, `start-stop-continue`, `mad-sad-glad`, `4l`, `sailboat`.
- Id колонок: classic `went_well, didnt_go_well, improve`; ssc `start, stop, continue`; msg `mad, sad, glad`; 4l `liked, learned, lacked, longed`; sailboat `wind, anchors, rocks, island`.
- Тона колонок: `well | bad | improve | accent`; Tailwind-классы для тона — только полными строками (JIT).
- `board-formats.js` обязан попасть в `COPY` Dockerfile (`src/` в рантайм-образ не копируется).
- Все новые UI-строки — в обоих словарях `en.json` и `ru.json`.
- Дефолт и предвыбор — `classic` с бейджем «Рекомендуем для начала».
- Коммиты — на русском, в стиле репозитория; каждая задача — свой коммит.

---

### Task 1: Реестр форматов

**Files:**
- Create: `board-formats.js`
- Create: `src/lib/formats.ts`
- Test: `src/lib/formats.test.ts`
- Modify: `Dockerfile:21`

**Interfaces:**
- Produces (`board-formats.js`, ESM): `DEFAULT_FORMAT = 'classic'`; `BOARD_FORMATS: BoardFormat[]`; `findBoardFormat(id: string | null | undefined): BoardFormat` (неизвестный id → classic); `isValidFormat(id): boolean`; `isValidColumn(formatId, columnId): boolean`.
- Produces (`src/lib/formats.ts`): те же функции с типами `BoardFormat { id: string; columns: BoardColumn[] }`, `BoardColumn { id: string; tone: Tone; title: Localized; short: Localized }`, `Tone = 'well' | 'bad' | 'improve' | 'accent'`, плюс `TONE: Record<Tone, ToneClasses>` где `ToneClasses { border; text; badge; tab; outline; bar }` — строки Tailwind-классов.

- [ ] **Step 1: Написать падающий тест**

`src/lib/formats.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
	BOARD_FORMATS,
	DEFAULT_FORMAT,
	findBoardFormat,
	isValidFormat,
	isValidColumn,
	TONE
} from './formats.js';
import { FORMATS } from './content/formats.js';

describe('реестр форматов', () => {
	it('classic — дефолт и хранит прежние id колонок', () => {
		expect(DEFAULT_FORMAT).toBe('classic');
		expect(findBoardFormat('classic').columns.map((c) => c.id)).toEqual([
			'went_well',
			'didnt_go_well',
			'improve'
		]);
	});

	it('id форматов и колонок уникальны', () => {
		const ids = BOARD_FORMATS.map((f) => f.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const f of BOARD_FORMATS) {
			const cols = f.columns.map((c) => c.id);
			expect(new Set(cols).size).toBe(cols.length);
			expect(cols.length).toBeGreaterThanOrEqual(3);
		}
	});

	it('у каждой SEO-страницы формата есть доска-формат с тем же id', () => {
		for (const seo of FORMATS) {
			expect(isValidFormat(seo.slug)).toBe(true);
			expect(findBoardFormat(seo.slug).columns).toHaveLength(seo.columns.length);
		}
	});

	it('неизвестный формат падает в classic, неизвестная колонка — невалидна', () => {
		expect(findBoardFormat('nope').id).toBe('classic');
		expect(findBoardFormat(null).id).toBe('classic');
		expect(isValidFormat('nope')).toBe(false);
		expect(isValidColumn('sailboat', 'island')).toBe(true);
		expect(isValidColumn('sailboat', 'went_well')).toBe(false);
		expect(isValidColumn('classic', 'went_well')).toBe(true);
	});

	it('названия classic совпадают со словарём — экспорт и e2e на них завязаны', () => {
		const [well, bad, improve] = findBoardFormat('classic').columns;
		expect(well.title).toEqual({ en: 'Went Well', ru: 'Прошло хорошо' });
		expect(bad.title).toEqual({ en: "Didn't Go Well", ru: 'Не получилось' });
		expect(improve.title).toEqual({ en: 'To Improve', ru: 'Улучшить' });
	});

	it('у каждого тона есть полный набор классов', () => {
		for (const tone of ['well', 'bad', 'improve', 'accent'] as const) {
			expect(TONE[tone].border).toMatch(/^border-/);
			expect(TONE[tone].badge).toContain('bg-');
			expect(TONE[tone].tab).toContain('text-white');
		}
	});
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/lib/formats.test.ts`
Expected: FAIL — `Cannot find module './formats.js'`.

- [ ] **Step 3: Реестр в корне**

`board-formats.js`:

```js
/**
 * Пресеты форматов доски. Единственный источник правды о колонках.
 *
 * Лежит в корне рядом с seo-paths.js по той же причине: server.js работает
 * в рантайм-образе без src/, а колонки ему нужны, чтобы отсекать карточки
 * в несуществующей колонке. Отсюда реестр читают server.js, src/lib/formats.ts
 * и экспорт — разъехаться им негде.
 *
 * Id формата совпадает со slug страницы /formats/<slug>: ссылка «Создать
 * доску в этом формате» ведёт на /new?format=<slug> без таблицы соответствий.
 * Формат фиксируется при создании доски и не меняется.
 */

export const DEFAULT_FORMAT = 'classic';

/**
 * @typedef {{ en: string, ru: string }} Localized
 * @typedef {'well' | 'bad' | 'improve' | 'accent'} Tone
 * @typedef {{ id: string, tone: Tone, title: Localized, short: Localized }} BoardColumn
 * @typedef {{ id: string, columns: BoardColumn[] }} BoardFormat
 */

/** @type {BoardFormat[]} */
export const BOARD_FORMATS = [
	{
		id: 'classic',
		columns: [
			{ id: 'went_well', tone: 'well', title: { en: 'Went Well', ru: 'Прошло хорошо' }, short: { en: 'Good', ru: 'Хорошо' } },
			{ id: 'didnt_go_well', tone: 'bad', title: { en: "Didn't Go Well", ru: 'Не получилось' }, short: { en: 'Bad', ru: 'Плохо' } },
			{ id: 'improve', tone: 'improve', title: { en: 'To Improve', ru: 'Улучшить' }, short: { en: 'Improve', ru: 'Улучшить' } }
		]
	},
	{
		id: 'start-stop-continue',
		columns: [
			{ id: 'start', tone: 'improve', title: { en: 'Start', ru: 'Начать' }, short: { en: 'Start', ru: 'Начать' } },
			{ id: 'stop', tone: 'bad', title: { en: 'Stop', ru: 'Прекратить' }, short: { en: 'Stop', ru: 'Стоп' } },
			{ id: 'continue', tone: 'well', title: { en: 'Continue', ru: 'Продолжить' }, short: { en: 'Continue', ru: 'Дальше' } }
		]
	},
	{
		id: 'mad-sad-glad',
		columns: [
			{ id: 'mad', tone: 'bad', title: { en: 'Mad', ru: 'Злит' }, short: { en: 'Mad', ru: 'Злит' } },
			{ id: 'sad', tone: 'improve', title: { en: 'Sad', ru: 'Огорчает' }, short: { en: 'Sad', ru: 'Грустно' } },
			{ id: 'glad', tone: 'well', title: { en: 'Glad', ru: 'Радует' }, short: { en: 'Glad', ru: 'Радует' } }
		]
	},
	{
		id: '4l',
		columns: [
			{ id: 'liked', tone: 'well', title: { en: 'Liked', ru: 'Понравилось' }, short: { en: 'Liked', ru: 'Нравится' } },
			{ id: 'learned', tone: 'improve', title: { en: 'Learned', ru: 'Узнали' }, short: { en: 'Learned', ru: 'Узнали' } },
			{ id: 'lacked', tone: 'bad', title: { en: 'Lacked', ru: 'Не хватило' }, short: { en: 'Lacked', ru: 'Не хватило' } },
			{ id: 'longed', tone: 'accent', title: { en: 'Longed for', ru: 'Хотелось бы' }, short: { en: 'Longed', ru: 'Хотелось' } }
		]
	},
	{
		id: 'sailboat',
		columns: [
			{ id: 'wind', tone: 'well', title: { en: 'Wind', ru: 'Ветер' }, short: { en: 'Wind', ru: 'Ветер' } },
			{ id: 'anchors', tone: 'bad', title: { en: 'Anchors', ru: 'Якоря' }, short: { en: 'Anchors', ru: 'Якоря' } },
			{ id: 'rocks', tone: 'improve', title: { en: 'Rocks', ru: 'Рифы' }, short: { en: 'Rocks', ru: 'Рифы' } },
			{ id: 'island', tone: 'accent', title: { en: 'Island', ru: 'Остров' }, short: { en: 'Island', ru: 'Остров' } }
		]
	}
];

/**
 * Неизвестный или пустой id — classic: так старые доски и любой мусор
 * в запросе получают рабочую доску, а не пустой экран.
 * @param {string | null | undefined} id
 * @returns {BoardFormat}
 */
export function findBoardFormat(id) {
	return BOARD_FORMATS.find((f) => f.id === id) ?? BOARD_FORMATS[0];
}

/** @param {unknown} id */
export function isValidFormat(id) {
	return typeof id === 'string' && BOARD_FORMATS.some((f) => f.id === id);
}

/**
 * @param {string} formatId
 * @param {unknown} columnId
 */
export function isValidColumn(formatId, columnId) {
	return findBoardFormat(formatId).columns.some((c) => c.id === columnId);
}
```

- [ ] **Step 4: Типизированная обёртка и классы тонов**

`src/lib/formats.ts`:

```ts
// Типизированный вход в реестр board-formats.js (корень репо). Здесь же —
// Tailwind-классы по тону колонки: полными строками, иначе JIT их не соберёт.
import type { Localized } from './content/localized.js';
import {
	BOARD_FORMATS as RAW_FORMATS,
	DEFAULT_FORMAT,
	findBoardFormat as rawFind,
	isValidFormat,
	isValidColumn
} from '../../board-formats.js';

export type Tone = 'well' | 'bad' | 'improve' | 'accent';

export interface BoardColumn {
	id: string;
	tone: Tone;
	title: Localized;
	short: Localized;
}

export interface BoardFormat {
	id: string;
	columns: BoardColumn[];
}

export const BOARD_FORMATS = RAW_FORMATS as BoardFormat[];
export { DEFAULT_FORMAT, isValidFormat, isValidColumn };

export function findBoardFormat(id: string | null | undefined): BoardFormat {
	return rawFind(id) as BoardFormat;
}

export interface ToneClasses {
	border: string;
	text: string;
	badge: string;
	tab: string;
	outline: string;
	bar: string;
}

export const TONE: Record<Tone, ToneClasses> = {
	well: {
		border: 'border-well',
		text: 'text-well',
		badge: 'bg-well-bg text-well-strong',
		tab: 'bg-well text-white',
		outline: 'outline-well bg-well-bg',
		bar: 'bg-well-bg'
	},
	bad: {
		border: 'border-bad',
		text: 'text-bad',
		badge: 'bg-bad-bg text-bad-strong',
		tab: 'bg-bad text-white',
		outline: 'outline-bad bg-bad-bg',
		bar: 'bg-bad-bg'
	},
	improve: {
		border: 'border-improve',
		text: 'text-improve',
		badge: 'bg-improve-bg text-improve-strong',
		tab: 'bg-improve text-white',
		outline: 'outline-improve bg-improve-bg',
		bar: 'bg-improve-bg'
	},
	accent: {
		border: 'border-accent',
		text: 'text-accent',
		badge: 'bg-accent-bg text-accent',
		tab: 'bg-accent text-white',
		outline: 'outline-accent bg-accent-bg',
		bar: 'bg-accent-bg'
	}
};
```

- [ ] **Step 5: Dockerfile**

В `Dockerfile` строку `COPY server.js seo-paths.js migrate.js entrypoint.sh ./` заменить на `COPY server.js seo-paths.js board-formats.js migrate.js entrypoint.sh ./`.

- [ ] **Step 6: Тесты зелёные**

Run: `npx vitest run src/lib/formats.test.ts && npm run check`
Expected: 6 passed, svelte-check 0 errors.

- [ ] **Step 7: Commit**

```bash
git add board-formats.js src/lib/formats.ts src/lib/formats.test.ts Dockerfile
git commit -m "Форматы досок: реестр пресетов и классы тонов колонок"
```

---

### Task 2: Данные — миграция, схема, типы

**Files:**
- Create: `drizzle/0005_board_formats.sql`
- Modify: `src/lib/server/db/schema.ts:9,21-28,39-49`
- Modify: `server.js:42-43,54-61,73-80` (копия схемы)
- Modify: `src/lib/types.ts:1-9`
- Modify: `src/lib/stores/board.test.ts:8-13` (фикстура доски)

**Interfaces:**
- Produces: `boards.format: text NOT NULL DEFAULT 'classic'`, `spaces.lastFormat: text | null`, `cards.columnType: text`; тип `Board.format: string`; `ColumnType = string`.

- [ ] **Step 1: Миграция**

`drizzle/0005_board_formats.sql`:

```sql
ALTER TABLE "cards" ALTER COLUMN "column_type" TYPE text USING "column_type"::text;
--> statement-breakpoint
DROP TYPE IF EXISTS "column_type";
--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "format" text NOT NULL DEFAULT 'classic';
--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "last_format" text;
```

- [ ] **Step 2: Схема Drizzle**

В `src/lib/server/db/schema.ts` удалить строку `export const columnTypeEnum = pgEnum(...)` и импорт `pgEnum` оставить (нужен `voteTypeEnum`). Далее:

```ts
export const spaces = pgTable('spaces', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull(),
	passwordHash: text('password_hash'),
	creatorToken: text('creator_token').notNull().default(''),
	// Формат последней созданной здесь доски — предвыбор для следующей
	lastFormat: text('last_format'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const boards = pgTable('boards', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: text('slug').notNull().unique(),
	title: text('title').notNull(),
	creatorToken: text('creator_token').notNull().default(''),
	spaceId: uuid('space_id').references(() => spaces.id, { onDelete: 'set null' }),
	// Id из board-formats.js; фиксируется при создании
	format: text('format').notNull().default('classic'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
```

и в `cards`: `columnType: text('column_type').notNull(),`.

- [ ] **Step 3: Копия схемы в server.js**

В `server.js` удалить `const columnTypeEnum = pgEnum(...)` (строка 42); в `spaces` добавить `lastFormat: text('last_format'),`; в `boards` добавить `format: text('format').notNull().default('classic'),`; в `cards` заменить на `columnType: text('column_type').notNull(),`.

- [ ] **Step 4: Типы**

`src/lib/types.ts`, верх файла:

```ts
/** Id колонки внутри формата доски — см. board-formats.js */
export type ColumnType = string;
export type VoteType = 'like' | 'dislike';

export interface Board {
	id: string;
	slug: string;
	title: string;
	/** Id формата из board-formats.js; у досок до форматов — 'classic' */
	format: string;
	createdAt: string;
}
```

`COLUMN_CONFIG` и его тест оставить как есть — они описывают только classic.

- [ ] **Step 5: Фикстура в board.test.ts**

```ts
const board: Board = {
	id: 'b1',
	slug: 'test',
	title: 'Test Board',
	format: 'classic',
	createdAt: '2025-01-01T00:00:00Z'
};
```

- [ ] **Step 6: Проверка миграции на локальной БД**

Run: `docker compose up -d db && DATABASE_URL=postgresql://retro:retro@localhost:5433/retro node migrate.js`
Expected: `Applied: 0005_board_formats.sql` и `Migrations complete.`

Run: `npm test && npm run check`
Expected: все зелёные (типы `Board` требуют `format` только в фикстуре; `[slug]/+page.server.ts` пока не возвращает `format` — svelte-check это покажет, если `data.board` где-то присваивается в `Board`; тогда добавить `format: board.format` в Task 3, а здесь временно допустимо падение check — исправляется следующей задачей).

- [ ] **Step 7: Commit**

```bash
git add drizzle/0005_board_formats.sql src/lib/server/db/schema.ts server.js src/lib/types.ts src/lib/stores/board.test.ts
git commit -m "Форматы досок: колонка карточки — текст, у доски и пространства — формат"
```

---

### Task 3: Сервер — формат в состоянии доски и валидация колонок

**Files:**
- Modify: `server.js` (импорт реестра; `board:join` ~строка 415; `card:create` ~449; `card:update` ~480)
- Modify: `src/routes/[slug]/+page.server.ts:77-83`

**Interfaces:**
- Consumes: `isValidColumn(formatId, columnId)` из `board-formats.js`.
- Produces: `board:state.board.format`; данные страницы `board.format`.

- [ ] **Step 1: Импорт реестра в server.js**

Рядом с существующим `import { isIndexable } from './seo-paths.js';` добавить:

```js
import { isValidColumn } from './board-formats.js';
```

- [ ] **Step 2: Формат в board:state**

В `socket.emit('board:state', { board: { ... } })` добавить поле:

```js
				board: {
					id: board.id,
					slug: board.slug,
					title: board.title,
					format: board.format,
					spaceId: board.spaceId,
					createdAt: board.createdAt
				},
```

- [ ] **Step 3: Валидация в card:create**

Сразу после проверки `authorName` и до лукапа картинки:

```js
		// Колонка обязана существовать в формате этой доски — иначе карточка
		// исчезнет с экрана у всех, а в базе останется
		const [owner] = await db.select({ format: boards.format }).from(boards).where(eq(boards.id, boardId)).limit(1);
		if (!owner || !isValidColumn(owner.format, column)) return;
```

- [ ] **Step 4: Валидация в card:update**

Заменить

```js
		const validColumns = ['went_well', 'didnt_go_well', 'improve'];
		const hasColumn = columnType !== undefined;
		if (hasColumn && !validColumns.includes(columnType)) return;
```

на

```js
		const hasColumn = columnType !== undefined;
		if (hasColumn) {
			const [owner] = await db
				.select({ format: boards.format })
				.from(cards)
				.innerJoin(boards, eq(cards.boardId, boards.id))
				.where(eq(cards.id, cardId))
				.limit(1);
			if (!owner || !isValidColumn(owner.format, columnType)) return;
		}
```

- [ ] **Step 5: Формат в данных страницы доски**

`src/routes/[slug]/+page.server.ts`, объект `board` в `return`:

```ts
		board: {
			id: board.id,
			slug: board.slug,
			title: board.title,
			format: board.format,
			createdAt: board.createdAt.toISOString()
		},
```

- [ ] **Step 6: Проверка**

Run: `npm run check && npm run build`
Expected: 0 errors; сборка успешна.

- [ ] **Step 7: Commit**

```bash
git add server.js 'src/routes/[slug]/+page.server.ts'
git commit -m "Форматы досок: сервер отдаёт формат и отсекает чужие колонки"
```

---

### Task 4: Стор и экспорт по формату

**Files:**
- Modify: `src/lib/stores/board.svelte.ts`
- Modify: `src/lib/server/export.ts`
- Test: `src/lib/stores/board.test.ts`, `src/lib/server/export.test.ts`

**Interfaces:**
- Produces (`boardStore`): `get format(): BoardFormat`, `get columns(): BoardColumn[]`, `columnDef(id: string): BoardColumn`; `getSummaryCards()` — порядок колонок формата.
- Produces (`export.ts`): `BoardRow.format: string`; `BoardExport.board.format: string`; `assembleExport` и `toMarkdown` идут по колонкам формата.

- [ ] **Step 1: Падающие тесты стора**

В конец `describe('BoardStore')` в `board.test.ts`:

```ts
	it('columns и columnDef берутся из формата доски', () => {
		boardStore.setState({ board: { ...board, format: 'sailboat' }, cards: [], votes: [], comments: [] });
		expect(boardStore.format.id).toBe('sailboat');
		expect(boardStore.columns.map((c) => c.id)).toEqual(['wind', 'anchors', 'rocks', 'island']);
		expect(boardStore.columnDef('rocks').title.ru).toBe('Рифы');
	});

	it('неизвестная колонка не роняет рендер — отдаётся первая колонка формата', () => {
		expect(boardStore.columnDef('nope').id).toBe('went_well');
	});

	it('getSummaryCards идёт по порядку колонок формата, а не classic', () => {
		boardStore.setState({
			board: { ...board, format: 'sailboat' },
			cards: [
				makeCard({ id: 'i', columnType: 'island' }),
				makeCard({ id: 'w', columnType: 'wind' }),
				makeCard({ id: 'r', columnType: 'rocks' })
			],
			votes: [],
			comments: []
		});
		expect(boardStore.getSummaryCards().map((c) => c.id)).toEqual(['w', 'r', 'i']);
	});
```

- [ ] **Step 2: Падающие тесты экспорта**

В `export.test.ts` фикстуру `board` заменить на

```ts
const board = { title: 'Sprint 42', slug: 'abc123', format: 'classic', createdAt: new Date('2026-07-01T00:00:00Z') };
```

ожидание в первом тесте — на

```ts
		expect(data.board).toEqual({ title: 'Sprint 42', slug: 'abc123', format: 'classic', createdAt: '2026-07-01T00:00:00.000Z' });
```

и добавить в конец файла:

```ts
describe('экспорт не-классического формата', () => {
	const sailboat = { ...board, format: 'sailboat' };
	const rows = [
		{ id: 'c1', columnType: 'rocks', content: 'legacy auth expires', authorName: null, imageId: null, createdAt: new Date('2026-07-01T10:00:00Z') }
	];

	it('ключи JSON — колонки формата в его порядке', () => {
		const data = assembleExport(sailboat, rows, [], [], ORIGIN);
		expect(data.board.format).toBe('sailboat');
		expect(Object.keys(data.columns)).toEqual(['wind', 'anchors', 'rocks', 'island']);
		expect(data.columns.rocks[0].content).toBe('legacy auth expires');
	});

	it('заголовки Markdown — названия колонок формата на нужном языке', () => {
		const en = toMarkdown(assembleExport(sailboat, rows, [], [], ORIGIN), 'en');
		expect(en).toContain('## Wind');
		expect(en).toContain('## Island');
		expect(en).not.toContain('## Went Well');
		const ru = toMarkdown(assembleExport(sailboat, rows, [], [], ORIGIN), 'ru');
		expect(ru).toContain('## Рифы');
	});
});
```

- [ ] **Step 3: Убедиться, что падают**

Run: `npx vitest run src/lib/stores/board.test.ts src/lib/server/export.test.ts`
Expected: FAIL — `boardStore.format` undefined; `data.board` без `format`; в sailboat-экспорте ключи `went_well`.

- [ ] **Step 4: Стор**

`src/lib/stores/board.svelte.ts` — импорт и три члена класса, `getSummaryCards` через формат:

```ts
import type { Board, Card, Vote, Comment, BoardState } from '$lib/types.js';
import { findBoardFormat, type BoardColumn, type BoardFormat } from '$lib/formats.js';

class BoardStore {
	// ...существующие поля и методы без изменений...

	/** Формат текущей доски; до загрузки доски — classic */
	get format(): BoardFormat {
		return findBoardFormat(this.board?.format);
	}

	get columns(): BoardColumn[] {
		return this.format.columns;
	}

	/** Карточка с колонкой не из формата рендерится в первую — но не роняет доску */
	columnDef(id: string): BoardColumn {
		return this.columns.find((c) => c.id === id) ?? this.columns[0];
	}

	getSummaryCards() {
		const order = this.columns.map((c) => c.id);
		return [...this.cards].sort((a, b) => {
			const colDiff = order.indexOf(a.columnType) - order.indexOf(b.columnType);
			if (colDiff !== 0) return colDiff;
			return this.getCardScore(b.id) - this.getCardScore(a.id);
		});
	}
}
```

- [ ] **Step 5: Экспорт**

`src/lib/server/export.ts`: удалить `COLUMN_TYPES`; импорт `import { findBoardFormat } from '$lib/formats.js';`; типы и функции:

```ts
export interface BoardExport {
	board: { title: string; slug: string; format: string; createdAt: string };
	columns: Record<string, ExportCard[]>;
}

interface BoardRow {
	title: string;
	slug: string;
	format: string;
	createdAt: Date;
}

export function assembleExport(board, boardCards, boardVotes, boardComments, origin): BoardExport {
	const imageUrl = (id: string | null) => (id ? `${origin}/api/image/${id}` : null);
	const format = findBoardFormat(board.format);
	const columns: Record<string, ExportCard[]> = {};
	for (const col of format.columns) {
		columns[col.id] = boardCards
			.filter((c) => c.columnType === col.id)
			.map(/* ...тело без изменений... */);
	}
	return {
		board: { title: board.title, slug: board.slug, format: format.id, createdAt: board.createdAt.toISOString() },
		columns
	};
}

export function toMarkdown(data: BoardExport, lang: Locale = 'en'): string {
	// ...шапка без изменений...
	for (const col of findBoardFormat(data.board.format).columns) {
		const items = data.columns[col.id] ?? [];
		md += `## ${lang === 'ru' ? col.title.ru : col.title.en}\n\n`;
		// ...остальное без изменений...
	}
	return md;
}
```

Сигнатуру `assembleExport` оставить прежней (параметры те же, `board: BoardRow`).

- [ ] **Step 6: Зелёные**

Run: `npm test && npm run check`
Expected: все тесты зелёные (старые тесты classic-экспорта проходят без правок заголовков), 0 ошибок типов.

- [ ] **Step 7: Commit**

```bash
git add src/lib/stores/board.svelte.ts src/lib/stores/board.test.ts src/lib/server/export.ts src/lib/server/export.test.ts
git commit -m "Форматы досок: стор и экспорт идут по колонкам формата"
```

---

### Task 5: Доска рендерится из формата

**Files:**
- Modify: `src/lib/components/Board.svelte`
- Modify: `src/lib/components/Column.svelte`
- Modify: `src/lib/components/Card.svelte:19-28,137-146`
- Modify: `src/lib/components/Summary.svelte:6,27-31,80-84`

**Interfaces:**
- Consumes: `boardStore.columns`, `boardStore.columnDef(id)`, `TONE`, `txt()`.
- Пропсы компонентов не меняются: `Column` и `CardForm` по-прежнему получают `column: string` (id).

- [ ] **Step 1: Board.svelte**

```svelte
<script lang="ts">
	import Column from './Column.svelte';
	import CardForm from './CardForm.svelte';
	import Summary from './Summary.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { TONE } from '$lib/formats.js';
	import { txt } from '$lib/content/localized.js';

	let { creatorToken = null }: { creatorToken?: string | null } = $props();

	let columns = $derived(boardStore.columns);

	// Mobile: columns become segment tabs, one column visible at a time
	let active = $state(boardStore.columns[0].id);

	// Четыре колонки в один ряд помещаются только на широких экранах
	let gridCols = $derived(columns.length > 3 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3');
</script>

<!-- Mobile segment tabs -->
<div class="flex gap-1.5 px-4 pb-1 pt-3 md:hidden">
	{#each columns as column (column.id)}
		<button
			onclick={() => (active = column.id)}
			aria-pressed={active === column.id}
			class="min-h-11 flex-1 rounded-xl px-1 text-[13px] transition-colors {active === column.id
				? `${TONE[column.tone].tab} border-none font-bold`
				: 'border border-border bg-surface-card font-semibold text-text-secondary'}"
		>
			{txt(column.short)} · {boardStore.getColumnCards(column.id).length}
		</button>
	{/each}
</div>

<div class="mx-auto grid w-full max-w-[1360px] grid-cols-1 gap-5 p-4 pb-32 sm:p-6 md:pb-10 lg:px-7 {gridCols}">
	{#each columns as column (column.id)}
		<div class="min-w-0 {column.id === active ? '' : 'hidden md:block'}">
			<Column column={column.id} />
		</div>
	{/each}
</div>

<Summary {creatorToken} />

<!-- Mobile composer — pinned to the bottom, adds to the active column -->
<div class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-card px-4 pb-[max(env(safe-area-inset-bottom),0.875rem)] pt-3 md:hidden">
	<CardForm column={active} variant="composer" />
</div>
```

- [ ] **Step 2: Column.svelte — названия и цвета из реестра**

В `<script>` заменить импорт `ColumnType`, константы `borderColor/countColor/dropActive` и заголовок:

```ts
	import { TONE } from '$lib/formats.js';
	import { txt } from '$lib/content/localized.js';

	let { column }: { column: string } = $props();
	let def = $derived(boardStore.columnDef(column));
	let tone = $derived(TONE[def.tone]);
```

и в разметке: `border-b-[3px] pb-2.5 {tone.border}`, `<h2>…{txt(def.title)}</h2>`, счётчик `{tone.text}`, подсветка дропа `` `outline-solid ${tone.outline}` ``. Константы `borderColor`, `countColor`, `dropActive` удалить.

- [ ] **Step 3: Card.svelte — перенос по колонкам формата**

Заменить `ALL_COLUMNS`, `otherColumns` и `tagColors`:

```ts
	import { TONE } from '$lib/formats.js';
	import { txt } from '$lib/content/localized.js';

	let otherColumns = $derived(boardStore.columns.filter((c) => c.id !== card.columnType));
```

и в блоке `{#if moveOpen}`:

```svelte
				{#each otherColumns as col (col.id)}
					<button onclick={() => moveTo(col.id)} class="badge-sm {TONE[col.tone].badge} transition-transform hover:scale-105">
						{txt(col.title)}
					</button>
				{/each}
```

Импорт `ColumnType` из типов оставить только если используется в `moveTo(col: ColumnType)` — там `string`.

- [ ] **Step 4: Summary.svelte — бейджи колонок**

Удалить `tagColors` и импорт `ColumnType`; добавить `import { TONE } from '$lib/formats.js'; import { txt } from '$lib/content/localized.js';`; заголовок группы:

```svelte
					{#if showHeader}
						{@const def = boardStore.columnDef(card.columnType)}
						<div class="mt-2 transition-opacity duration-300 first:mt-0 {focusVisible && card.columnType !== focusedColumn ? 'opacity-45' : 'opacity-100'}">
							<span class="badge-sm {TONE[def.tone].badge}">{txt(def.title)}</span>
						</div>
					{/if}
```

- [ ] **Step 5: Проверка на классике**

Run: `npm run check && npm run build && npx playwright test`
Expected: 0 ошибок; все 12 e2e зелёные (классика рендерится теми же заголовками `Went Well` и т. д.).

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/Board.svelte src/lib/components/Column.svelte src/lib/components/Card.svelte src/lib/components/Summary.svelte
git commit -m "Форматы досок: колонки, вкладки и бейджи рендерятся из реестра"
```

---

### Task 6: Выбор формата при создании

**Files:**
- Create: `src/lib/components/FormatPicker.svelte`
- Modify: `src/routes/new/+page.server.ts`, `src/routes/new/+page.svelte`
- Modify: `src/routes/spaces/[slug]/+page.server.ts` (load: `lastFormat`; action `createBoard`)
- Modify: `src/lib/components/NewBoardModal.svelte`, `src/routes/spaces/[slug]/+page.svelte:87-90`
- Modify: `src/routes/formats/[format]/+page.svelte:123`, `src/routes/formats/+page.svelte:71`
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/ru.json`
- Test: `e2e/formats.spec.ts`

**Interfaces:**
- `FormatPicker` props: `value: string` (bindable), `compact?: boolean`. Рендерит радио `name="format"` — форма отправляет формат без скрытых полей.
- localStorage-ключ `retro_format`.

- [ ] **Step 1: Падающий e2e**

`e2e/formats.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { addCard, column, initStorage } from './helpers';

test('classic is preselected and marked as recommended', async ({ page }) => {
	await initStorage(page);
	await page.goto('/new');
	await expect(page.getByRole('radio', { name: /Classic/ })).toBeChecked();
	await expect(page.getByText('Recommended to start with')).toBeVisible();
});

test('a board created from a format link uses that format end to end', async ({ page }) => {
	await initStorage(page);
	await page.goto('/new?format=sailboat');
	await expect(page.getByRole('radio', { name: /Sailboat/ })).toBeChecked();
	await page.locator('form[action="?/createBoard"] button[type="submit"]').click();
	await page.waitForURL(/\/[A-Za-z0-9_-]{21}/);
	await page.getByRole('button', { name: 'Close' }).click();

	for (const name of ['Wind', 'Anchors', 'Rocks', 'Island']) {
		await expect(page.getByRole('heading', { name })).toBeVisible();
	}
	await expect(page.getByRole('heading', { name: 'Went Well' })).toHaveCount(0);

	await addCard(page, 'Rocks', 'legacy auth expires in Q4');
	await page.dragAndDrop(
		'.card-board:has-text("legacy auth")',
		'[data-testid="column"]:has(h2:has-text("Island"))'
	);
	await expect(column(page, 'Island').locator('.card-board', { hasText: 'legacy auth' })).toBeVisible();

	// Итоги показывают колонку формата
	await expect(page.getByTestId('summary-card').filter({ hasText: 'legacy auth' })).toBeVisible();

	// Экспорт знает формат и его колонки
	const slug = new URL(page.url()).pathname.slice(1);
	const data = await (await page.request.get(`/${slug}/export`)).json();
	expect(data.board.format).toBe('sailboat');
	expect(Object.keys(data.columns)).toEqual(['wind', 'anchors', 'rocks', 'island']);
	expect(data.columns.island[0].content).toBe('legacy auth expires in Q4');

	// Браузер запомнил выбор
	await page.goto('/new');
	await expect(page.getByRole('radio', { name: /Sailboat/ })).toBeChecked();
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npm run build && npx playwright test e2e/formats.spec.ts`
Expected: FAIL — радио не найдено.

- [ ] **Step 3: Словари**

`en.json` (рядом с `new.*`):

```json
	"new.board.desc": "One retrospective: cards, votes, a timer. Ready in a second.",
	"new.format.title": "Format",
	"new.format.more": "Learn more",
	"format.recommended": "Recommended to start with",
	"format.classic.name": "Classic",
	"format.classic.desc": "Went well, didn't go well, to improve. Not sure where to start? Take this one.",
	"formats.cta.create": "Create a board in this format",
```

`ru.json`:

```json
	"new.board.desc": "Одна ретроспектива: карточки, голоса, таймер. Готова за секунду.",
	"new.format.title": "Формат",
	"new.format.more": "Подробнее",
	"format.recommended": "Рекомендуем для начала",
	"format.classic.name": "Классическая",
	"format.classic.desc": "Что было хорошо, что нет, что улучшить. Если сомневаетесь, с чего начать, — берите её.",
	"formats.cta.create": "Создать доску в этом формате",
```

(`new.board.desc` — замена существующего значения, остальное — новые ключи.)

- [ ] **Step 4: FormatPicker.svelte**

```svelte
<script lang="ts">
	import { BOARD_FORMATS, TONE } from '$lib/formats.js';
	import { FORMATS } from '$lib/content/formats.js';
	import { txt } from '$lib/content/localized.js';
	import { t } from '$lib/i18n/index.js';

	let { value = $bindable('classic'), compact = false }: { value?: string; compact?: boolean } = $props();

	// Название и подпись: классика — из словаря, остальные — со страниц форматов
	function meta(id: string) {
		if (id === 'classic') return { name: t('format.classic.name'), desc: t('format.classic.desc'), page: null };
		const seo = FORMATS.find((f) => f.slug === id);
		return { name: seo ? txt(seo.name) : id, desc: seo ? txt(seo.tagline) : '', page: seo ? `/formats/${seo.slug}` : null };
	}
</script>

<fieldset class="flex flex-col gap-2">
	<legend class="mb-2 text-sm font-semibold text-text-primary">{t('new.format.title')}</legend>
	<div class="grid gap-2 {compact ? '' : 'sm:grid-cols-2'}">
		{#each BOARD_FORMATS as format (format.id)}
			{@const m = meta(format.id)}
			<label
				class="relative flex cursor-pointer flex-col gap-2 rounded-2xl bg-surface-card p-4 transition-all {value === format.id
					? 'outline outline-2 outline-accent'
					: 'border border-border hover:border-border-strong'}"
			>
				<input type="radio" name="format" value={format.id} bind:group={value} class="sr-only" />
				<div class="flex items-center gap-2">
					<div class="flex gap-1" aria-hidden="true">
						{#each format.columns as col (col.id)}
							<div class="h-5 w-2.5 rounded {TONE[col.tone].bar}"></div>
						{/each}
					</div>
					<span class="font-heading text-[15px] font-bold text-text-primary">{m.name}</span>
					{#if format.id === 'classic'}
						<span class="badge-sm bg-accent-bg text-accent">{t('format.recommended')}</span>
					{/if}
				</div>
				{#if !compact}
					<p class="text-[13px] leading-relaxed text-text-secondary">{m.desc}</p>
					{#if m.page}
						<a href={m.page} class="text-[13px] font-semibold text-accent hover:underline" onclick={(e) => e.stopPropagation()}>{t('new.format.more')}</a>
					{/if}
				{/if}
			</label>
		{/each}
	</div>
</fieldset>
```

- [ ] **Step 5: /new — сервер**

`src/routes/new/+page.server.ts`:

```ts
import { isValidFormat, DEFAULT_FORMAT } from '$lib/formats.js';

export const load: PageServerLoad = async ({ url }) => {
	const type = url.searchParams.get('type');
	const requested = url.searchParams.get('format');
	return {
		type: type === 'space' ? 'space' : 'board',
		// Ссылка со страницы формата предвыбирает его; мусор в параметре игнорируем
		format: isValidFormat(requested) ? requested : null
	};
};
```

и в `createBoard`:

```ts
		const requested = formData.get('format');
		const format = isValidFormat(requested) ? (requested as string) : DEFAULT_FORMAT;
		await db.insert(boards).values({ title, slug, creatorToken, format });
```

- [ ] **Step 6: /new — клиент**

В `src/routes/new/+page.svelte`:

```ts
	import FormatPicker from '$lib/components/FormatPicker.svelte';
	import { browser } from '$app/environment';
	import { isValidFormat } from '$lib/formats.js';

	// Приоритет: ссылка со страницы формата → то, что выбирали в прошлый раз → классика
	function remembered(): string {
		if (!browser) return 'classic';
		const saved = localStorage.getItem('retro_format');
		return isValidFormat(saved) ? (saved as string) : 'classic';
	}
	// svelte-ignore state_referenced_locally
	let format = $state(data.format ?? remembered());

	function rememberFormat() {
		if (browser) localStorage.setItem('retro_format', format);
	}
```

В форме `?/createBoard` после `<label>` названия: `<FormatPicker bind:value={format} />`, у формы `onsubmit={rememberFormat}`.

- [ ] **Step 7: Пространство**

`src/routes/spaces/[slug]/+page.server.ts` — в `load` в объект `space` добавить `lastFormat: space.lastFormat`; в `createBoard`:

```ts
		const requested = formData.get('format');
		const format = isValidFormat(requested) ? (requested as string) : DEFAULT_FORMAT;

		await db.insert(boards).values({ title, slug, creatorToken, spaceId: space.id, format });
		// Пространство помнит последний выбор — он станет предвыбором для следующей доски
		await db.update(spaces).set({ lastFormat: format }).where(eq(spaces.id, space.id));
```

(импорт `isValidFormat, DEFAULT_FORMAT` из `$lib/formats.js`).

`NewBoardModal.svelte`: проп `defaultFormat: string | null = null`; `let format = $state(defaultFormat ?? 'classic');` (svelte-ignore как у `title`); в форме после `<label>` — `<FormatPicker bind:value={format} compact />`.

`src/routes/spaces/[slug]/+page.svelte`: в `<NewBoardModal ... defaultFormat={data.space.lastFormat ?? null} />`.

- [ ] **Step 8: CTA на страницах форматов**

`src/routes/formats/[format]/+page.svelte:123`: `<a href="/new?format={format.slug}" class="btn btn-primary btn-md">{t('formats.cta.create')}</a>`.
`src/routes/formats/+page.svelte:71` оставить `/new` (там формат не выбран).

- [ ] **Step 9: Зелёные**

Run: `npm test && npm run check && npm run build && npx playwright test`
Expected: юнит и словарный тест зелёные; e2e — 14 passed (12 прежних + 2 новых).

- [ ] **Step 10: Commit**

```bash
git add src/lib/components/FormatPicker.svelte src/routes/new src/routes/spaces src/lib/components/NewBoardModal.svelte 'src/routes/formats/[format]/+page.svelte' src/lib/i18n e2e/formats.spec.ts
git commit -m "Форматы досок: выбор при создании, память в браузере и пространстве, ссылки со страниц форматов"
```

---

### Task 7: Документация и changelog

**Files:**
- Modify: `src/routes/api/+page.svelte:97-105` (пример JSON), `src/lib/i18n/{en,ru}.json`
- Modify: `src/routes/changelog/+page.svelte:14-16`
- Modify: `CLAUDE.md` (раздел Features/SEO)

- [ ] **Step 1: Пример JSON в документации API**

После строки `"title": "Sprint 42"` добавить `,` и строку

```svelte
    <span class="text-[#E0A470]">"format"</span>: <span class="text-[#9CBF8E]">"classic"</span>
```

и под блоком «Access note» — абзац:

```svelte
			<p class="text-sm leading-relaxed text-text-secondary">{t('apiDocs.format.note')}</p>
```

Ключи: en `"apiDocs.format.note": "Column keys depend on the board format (board.format). The classic board has went_well, didnt_go_well and improve; other formats use their own column ids, e.g. wind, anchors, rocks, island for Sailboat."`, ru `"apiDocs.format.note": "Ключи колонок зависят от формата доски (board.format). У классической доски это went_well, didnt_go_well и improve; у остальных форматов — свои id колонок, например wind, anchors, rocks, island у Sailboat."`.

- [ ] **Step 2: Changelog**

В начало массива `releases`:

```ts
		{
			version: '1.10',
			date: '2026-09-08',
			title: { en: 'Pick a format', ru: 'Выбор формата' },
			changes: [
				{ en: 'When creating a board you can pick its format: Start Stop Continue, Mad Sad Glad, 4L or Sailboat — the columns match the format', ru: 'При создании доски можно выбрать её формат: Start Stop Continue, Mad Sad Glad, 4L или Sailboat — колонки подстраиваются под формат' },
				{ en: 'The classic board is preselected and marked as recommended, so nothing changes if you just press «Create»', ru: 'Классическая доска выбрана заранее и помечена как рекомендуемая — если просто нажать «Создать», ничего не поменяется' },
				{ en: 'The browser remembers your last format, and a space suggests the format of its previous board', ru: 'Браузер запоминает последний формат, а пространство предлагает формат предыдущей доски' },
				{ en: 'Every format page now has a «Create a board in this format» button', ru: 'На каждой странице формата появилась кнопка «Создать доску в этом формате»' },
				{ en: 'Cards can be dragged between columns with the mouse', ru: 'Карточки можно перетаскивать между колонками мышью' },
				{ en: 'The Summary shows who wrote each card', ru: 'В «Итогах» видно, кто написал карточку' }
			]
		},
```

- [ ] **Step 3: CLAUDE.md**

В раздел Features добавить пункт:

```markdown
- **Board formats**: `board-formats.js` **in the repo root** is the registry of column presets (classic, start-stop-continue, mad-sad-glad, 4l, sailboat); `server.js`, `src/lib/formats.ts` and the export read it, so it is in the Dockerfile COPY line like `seo-paths.js`. `boards.format` is set at creation and never changes; `cards.column_type` is plain text validated against the board's format. Old boards are `classic` with the original `went_well / didnt_go_well / improve` ids. Format id = `/formats/<slug>` slug, so `/new?format=<slug>` preselects it; the browser remembers `retro_format`, a space remembers `last_format`
```

- [ ] **Step 4: Полная проверка и commit**

Run: `npm test && npm run check && npm run build && npx playwright test`
Expected: всё зелёное.

```bash
git add src/routes/api/+page.svelte src/lib/i18n src/routes/changelog/+page.svelte CLAUDE.md
git commit -m "Форматы досок: документация API, changelog 1.10, CLAUDE.md"
```

Затем `git push origin main` — деплой; после деплоя проверить на проде: `curl -s https://retrospectrix.ru/<новая-доска>/export | jq .board.format`.
