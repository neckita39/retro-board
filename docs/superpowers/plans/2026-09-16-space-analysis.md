# Анализ пространства (AI) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Кнопка «Анализ пространства» отдаёт последние карточки всех досок пространства в DeepSeek и создаёт доску-анализ с повторяющимися паттернами; кеш и лимит выводятся из таблицы досок.

**Architecture:** Доска-анализ — обычная строка `boards` с `format = 'analysis'` (скрытый формат в реестре). Кеш актуален, пока после последней доски-анализа не появилось новой обычной доски; лимит — 3 доски-анализа за 24 часа на пространство. Чистая логика в `src/lib/server/analysis.ts`, HTTP-клиент в `src/lib/server/deepseek.ts`, form action `analyze` на странице пространства, кнопка — компонент `AnalyzeButton`, встроенный в `Header`.

**Tech Stack:** SvelteKit (Svelte 5 runes), Drizzle ORM + PostgreSQL, Vitest, Playwright, DeepSeek Chat Completions (OpenAI-совместимый HTTP API).

**Spec:** `docs/superpowers/specs/2026-09-16-space-analysis-design.md`

## Global Constraints

- Никаких новых таблиц и миграций: доска-анализ хранится в `boards`, карточки в `cards`.
- Лимит: 3 успешных анализа в сутки на пространство; неудачные вызовы в лимит не входят.
- Вход модели: не больше 150 карточек и 60 000 символов текста, обход от самой новой доски и карточки, доски `analysis` пропускаются, комментарии не передаются.
- Формат `analysis` скрыт: не показывается в пикерах, `isValidFormat('analysis') === false`, но `findBoardFormat`/`isValidColumn` его знают.
- Колонки формата: `again_well` («Still good» / «Снова хорошо»), `again_bad` («Still bad» / «Снова плохо»), `again_improve` («Still to improve» / «Снова стоит улучшить»).
- Автор карточек: «AI analysis» / «AI-анализ». Название доски: «Space analysis for 16.09.2026» / «Анализ пространства за 16.09.2026». Текст карточки: «{text} (in {n} boards)» / «{text} (в {n} досках)».
- Ключ DeepSeek только в `.env` (локально и на проде), в репозиторий не попадает. Переменные: `DEEPSEEK_API_KEY`, `DEEPSEEK_API_BASE` (по умолчанию `https://api.deepseek.com`).
- Все пользовательские строки через `t()`, ключи в обоих словарях `en.json` и `ru.json`.
- Коммиты: сообщения по-русски, в конце строка `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Перед каждым коммитом `npm test` и `npm run check` зелёные.
- Tabs для отступов, как во всём репо.

---

### Task 1: Скрытый формат `analysis` в реестре

**Files:**
- Modify: `board-formats.js`
- Modify: `src/lib/formats.ts`
- Modify: `src/lib/components/FormatPicker.svelte:24`
- Test: `src/lib/formats.test.ts`

**Interfaces:**
- Produces: `ANALYSIS_FORMAT = 'analysis'`, `VISIBLE_FORMATS` (массив форматов без `hidden`), поле `hidden?: boolean` в `BoardFormat`. `isValidFormat` отклоняет скрытые форматы.

- [ ] **Step 1: Написать падающие тесты**

Добавить в конец `describe('реестр форматов', …)` в `src/lib/formats.test.ts`:

```ts
	it('формат analysis скрыт: пикеры его не видят, форма не принимает, доска рендерится', () => {
		expect(ANALYSIS_FORMAT).toBe('analysis');
		expect(isValidFormat('analysis')).toBe(false);
		expect(VISIBLE_FORMATS.some((f) => f.id === 'analysis')).toBe(false);
		expect(VISIBLE_FORMATS.length).toBe(BOARD_FORMATS.length - 1);
		expect(findBoardFormat('analysis').id).toBe('analysis');
		expect(findBoardFormat('analysis').columns.map((c) => c.id)).toEqual([
			'again_well',
			'again_bad',
			'again_improve'
		]);
		expect(isValidColumn('analysis', 'again_bad')).toBe(true);
		expect(isValidColumn('analysis', 'went_well')).toBe(false);
	});
```

И расширить импорт в начале файла:

```ts
import {
	BOARD_FORMATS,
	VISIBLE_FORMATS,
	ANALYSIS_FORMAT,
	DEFAULT_FORMAT,
	findBoardFormat,
	isValidFormat,
	isValidColumn,
	TONE
} from './formats.js';
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/lib/formats.test.ts`
Expected: FAIL — `VISIBLE_FORMATS`/`ANALYSIS_FORMAT` не экспортируются (ошибка импорта или `undefined`).

- [ ] **Step 3: Добавить формат в `board-formats.js`**

В массив `BOARD_FORMATS` после `sailboat`:

```js
	{
		// Доска-анализ пространства: создаётся сервером, в пикерах не показывается
		id: 'analysis',
		hidden: true,
		columns: [
			{ id: 'again_well', tone: 'well', title: { en: 'Still good', ru: 'Снова хорошо' }, short: { en: 'Good', ru: 'Хорошо' } },
			{ id: 'again_bad', tone: 'bad', title: { en: 'Still bad', ru: 'Снова плохо' }, short: { en: 'Bad', ru: 'Плохо' } },
			{ id: 'again_improve', tone: 'improve', title: { en: 'Still to improve', ru: 'Снова стоит улучшить' }, short: { en: 'Improve', ru: 'Улучшить' } }
		]
	}
```

Обновить typedef: `@typedef {{ id: string, hidden?: boolean, columns: BoardColumn[] }} BoardFormat`.

После массива добавить:

```js
export const ANALYSIS_FORMAT = 'analysis';

/** Форматы, которые можно выбрать руками. Скрытые (analysis) создаёт только сервер. */
export const VISIBLE_FORMATS = BOARD_FORMATS.filter((f) => !f.hidden);
```

И заменить `isValidFormat`:

```js
/** Принимает только видимые форматы: скрытые нельзя создать через форму. @param {unknown} id */
export function isValidFormat(id) {
	return typeof id === 'string' && VISIBLE_FORMATS.some((f) => f.id === id);
}
```

- [ ] **Step 4: Пробросить в `src/lib/formats.ts`**

```ts
import {
	BOARD_FORMATS as RAW_FORMATS,
	VISIBLE_FORMATS as RAW_VISIBLE,
	ANALYSIS_FORMAT,
	DEFAULT_FORMAT,
	findBoardFormat as rawFind,
	isValidFormat,
	isValidColumn
} from '../../board-formats.js';
```

В `BoardFormat` добавить `hidden?: boolean;`. После `export const BOARD_FORMATS = …`:

```ts
export const VISIBLE_FORMATS = RAW_VISIBLE as BoardFormat[];
export { DEFAULT_FORMAT, ANALYSIS_FORMAT, isValidFormat, isValidColumn };
```

(убрать старую строку `export { DEFAULT_FORMAT, isValidFormat, isValidColumn };`).

- [ ] **Step 5: Пикер показывает только видимые**

В `src/lib/components/FormatPicker.svelte` заменить импорт на `import { VISIBLE_FORMATS, TONE } from '$lib/formats.js';` и `{#each BOARD_FORMATS as format (format.id)}` на `{#each VISIBLE_FORMATS as format (format.id)}`.

- [ ] **Step 6: Прогнать тесты и проверку типов**

Run: `npx vitest run src/lib/formats.test.ts && npm run check`
Expected: PASS, 0 errors.

- [ ] **Step 7: Коммит**

```bash
git add board-formats.js src/lib/formats.ts src/lib/formats.test.ts src/lib/components/FormatPicker.svelte
git commit -m "Анализ пространства: скрытый формат analysis в реестре

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `encrypt` на стороне SvelteKit

**Files:**
- Modify: `src/lib/server/crypto.ts`
- Test: `src/lib/server/crypto.test.ts` (создать)

**Interfaces:**
- Produces: `encrypt(plaintext: string | null): string | null` — тот же формат `iv.ciphertext+tag` в base64url, что и `encrypt` в `server.js`; без ключа возвращает вход как есть.

- [ ] **Step 1: Написать падающий тест**

`src/lib/server/crypto.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';

// Модуль читает ENCRYPTION_KEY при импорте — грузим его заново под каждым окружением
async function load(key: string | undefined) {
	vi.resetModules();
	if (key === undefined) vi.stubEnv('ENCRYPTION_KEY', '');
	else vi.stubEnv('ENCRYPTION_KEY', key);
	return await import('./crypto.js');
}

const KEY = '0'.repeat(64);

describe('encrypt/decrypt на стороне SvelteKit', () => {
	afterEach(() => vi.unstubAllEnvs());

	it('шифрует и расшифровывает обратно, шифртекст не содержит исходника', async () => {
		const { encrypt, decrypt } = await load(KEY);
		const enc = encrypt('снова падают тесты');
		expect(enc).not.toBe('снова падают тесты');
		expect(enc).toContain('.');
		expect(decrypt(enc)).toBe('снова падают тесты');
	});

	it('без ключа возвращает текст как есть', async () => {
		const { encrypt } = await load(undefined);
		expect(encrypt('plain')).toBe('plain');
	});

	it('null и пустая строка проходят насквозь', async () => {
		const { encrypt } = await load(KEY);
		expect(encrypt(null)).toBeNull();
		expect(encrypt('')).toBe('');
	});
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/lib/server/crypto.test.ts`
Expected: FAIL — `encrypt is not a function`.

- [ ] **Step 3: Реализовать `encrypt`**

В `src/lib/server/crypto.ts` перед `export function decrypt`:

```ts
// Зеркало encrypt() из server.js: тот же формат, чтобы карточки, созданные
// сервером SvelteKit (доска-анализ), читались сокет-сервером без оговорок
export function encrypt(plaintext: string | null): string | null {
	if (!encKey || !plaintext) return plaintext;
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return iv.toString('base64url') + '.' + Buffer.concat([encrypted, tag]).toString('base64url');
}
```

- [ ] **Step 4: Прогнать тест**

Run: `npx vitest run src/lib/server/crypto.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Коммит**

```bash
git add src/lib/server/crypto.ts src/lib/server/crypto.test.ts
git commit -m "Анализ пространства: encrypt на стороне SvelteKit

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Выбор карточек для модели (`collectCards`)

**Files:**
- Create: `src/lib/server/analysis.ts`
- Test: `src/lib/server/analysis.test.ts` (создать)

**Interfaces:**
- Produces:
  ```ts
  export interface SourceBoard { id: string; title: string; format: string; createdAt: Date }
  export interface SourceCard { id: string; boardId: string; columnType: string; content: string; createdAt: Date }
  export interface SourceVote { cardId: string; type: 'like' | 'dislike' }
  export interface AnalysisEntry { text: string; tone: Tone; boardTitle: string; boardDate: string; score: number }
  export const ANALYSIS_MAX_CARDS = 150;
  export const ANALYSIS_CHAR_BUDGET = 60_000;
  export function isAnalysisBoard(b: { format: string }): boolean;
  export function collectCards(boards: SourceBoard[], cards: SourceCard[], votes: SourceVote[], opts?: { max?: number; budget?: number }): AnalysisEntry[];
  ```
  `boardDate` — `YYYY-MM-DD` в UTC. Тон берётся из колонки формата доски, неизвестная колонка → `accent`.

- [ ] **Step 1: Написать падающие тесты**

`src/lib/server/analysis.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
	collectCards,
	isAnalysisBoard,
	ANALYSIS_MAX_CARDS,
	ANALYSIS_CHAR_BUDGET,
	type SourceBoard,
	type SourceCard,
	type SourceVote
} from './analysis.js';

const d = (iso: string) => new Date(iso);

function board(id: string, title: string, createdAt: string, format = 'classic'): SourceBoard {
	return { id, title, format, createdAt: d(createdAt) };
}
function card(id: string, boardId: string, columnType: string, content: string, createdAt: string): SourceCard {
	return { id, boardId, columnType, content, createdAt: d(createdAt) };
}

describe('collectCards — вход для модели', () => {
	const boards = [
		board('b1', 'Sprint 1', '2026-08-01T10:00:00Z'),
		board('b2', 'Sprint 2', '2026-08-15T10:00:00Z', 'sailboat'),
		board('a1', 'Analysis', '2026-08-20T10:00:00Z', 'analysis')
	];
	const cards = [
		card('c1', 'b1', 'went_well', 'ci is green', '2026-08-01T10:01:00Z'),
		card('c2', 'b1', 'didnt_go_well', 'flaky tests', '2026-08-01T10:02:00Z'),
		card('c3', 'b2', 'anchors', 'slow reviews', '2026-08-15T10:01:00Z'),
		card('c4', 'b2', 'wind', 'pairing helped', '2026-08-15T10:02:00Z'),
		card('c5', 'a1', 'again_bad', 'flaky tests again', '2026-08-20T10:01:00Z')
	];
	const votes: SourceVote[] = [
		{ cardId: 'c2', type: 'like' },
		{ cardId: 'c2', type: 'like' },
		{ cardId: 'c2', type: 'dislike' },
		{ cardId: 'c3', type: 'dislike' }
	];

	it('идёт от новой доски и новой карточки, пропускает доски-анализы', () => {
		const entries = collectCards(boards, cards, votes);
		expect(entries.map((e) => e.text)).toEqual(['pairing helped', 'slow reviews', 'flaky tests', 'ci is green']);
		expect(entries.every((e) => e.text !== 'flaky tests again')).toBe(true);
	});

	it('тон берётся из формата доски, дата и название доски прилагаются', () => {
		const entries = collectCards(boards, cards, votes);
		const anchors = entries.find((e) => e.text === 'slow reviews')!;
		expect(anchors).toMatchObject({ tone: 'bad', boardTitle: 'Sprint 2', boardDate: '2026-08-15' });
		expect(entries.find((e) => e.text === 'pairing helped')!.tone).toBe('well');
		expect(entries.find((e) => e.text === 'ci is green')!.tone).toBe('well');
	});

	it('счёт голосов: лайки минус дизлайки', () => {
		const entries = collectCards(boards, cards, votes);
		expect(entries.find((e) => e.text === 'flaky tests')!.score).toBe(1);
		expect(entries.find((e) => e.text === 'slow reviews')!.score).toBe(-1);
		expect(entries.find((e) => e.text === 'ci is green')!.score).toBe(0);
	});

	it('не больше max карточек', () => {
		const many = Array.from({ length: 10 }, (_, i) =>
			card(`m${i}`, 'b1', 'went_well', `card ${i}`, `2026-08-01T10:${String(i).padStart(2, '0')}:00Z`)
		);
		const entries = collectCards([boards[0]], many, [], { max: 3 });
		expect(entries.map((e) => e.text)).toEqual(['card 9', 'card 8', 'card 7']);
	});

	it('бюджет символов режет хвост: карточка, не влезшая целиком, и всё после неё отбрасываются', () => {
		const entries = collectCards(boards, cards, votes, { budget: 26 });
		// 'pairing helped' (14) + 'slow reviews' (12) = 26, 'flaky tests' уже не влезает
		expect(entries.map((e) => e.text)).toEqual(['pairing helped', 'slow reviews']);
	});

	it('неизвестная колонка получает тон accent, пустой текст пропускается', () => {
		const odd = [
			card('o1', 'b1', 'mystery', 'weird column', '2026-08-01T11:00:00Z'),
			card('o2', 'b1', 'went_well', '   ', '2026-08-01T11:01:00Z')
		];
		const entries = collectCards([boards[0]], odd, []);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ text: 'weird column', tone: 'accent' });
	});

	it('дефолты: 150 карточек и 60 000 символов', () => {
		expect(ANALYSIS_MAX_CARDS).toBe(150);
		expect(ANALYSIS_CHAR_BUDGET).toBe(60_000);
		expect(isAnalysisBoard({ format: 'analysis' })).toBe(true);
		expect(isAnalysisBoard({ format: 'classic' })).toBe(false);
	});
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/lib/server/analysis.test.ts`
Expected: FAIL — модуль `./analysis.js` не найден.

- [ ] **Step 3: Реализовать `collectCards`**

`src/lib/server/analysis.ts`:

```ts
// Анализ пространства: чистая логика без БД и сети. Что отдать модели,
// актуален ли кеш, не исчерпан ли лимит, как разобрать ответ и во что его
// превратить. Всё, что ходит наружу, живёт в deepseek.ts и в action.
import { findBoardFormat, ANALYSIS_FORMAT, type Tone } from '$lib/formats.js';

export interface SourceBoard {
	id: string;
	title: string;
	format: string;
	createdAt: Date;
}

export interface SourceCard {
	id: string;
	boardId: string;
	columnType: string;
	content: string;
	createdAt: Date;
}

export interface SourceVote {
	cardId: string;
	type: 'like' | 'dislike';
}

export interface AnalysisEntry {
	text: string;
	tone: Tone;
	boardTitle: string;
	/** YYYY-MM-DD, UTC */
	boardDate: string;
	/** лайки минус дизлайки */
	score: number;
}

export const ANALYSIS_MAX_CARDS = 150;
export const ANALYSIS_CHAR_BUDGET = 60_000;

export function isAnalysisBoard(b: { format: string }): boolean {
	return b.format === ANALYSIS_FORMAT;
}

const newestFirst = <T extends { createdAt: Date }>(a: T, b: T) =>
	b.createdAt.getTime() - a.createdAt.getTime();

/**
 * Последние карточки пространства: от самой новой доски и самой новой карточки,
 * доски-анализы пропускаем (иначе модель анализировала бы саму себя).
 * Карточка, не влезающая в бюджет символов, отбрасывается вместе со всем хвостом.
 */
export function collectCards(
	boards: SourceBoard[],
	cards: SourceCard[],
	votes: SourceVote[],
	opts: { max?: number; budget?: number } = {}
): AnalysisEntry[] {
	const max = opts.max ?? ANALYSIS_MAX_CARDS;
	const budget = opts.budget ?? ANALYSIS_CHAR_BUDGET;

	const score = new Map<string, number>();
	for (const v of votes) {
		score.set(v.cardId, (score.get(v.cardId) ?? 0) + (v.type === 'like' ? 1 : -1));
	}

	const byBoard = new Map<string, SourceCard[]>();
	for (const c of cards) {
		if (!byBoard.has(c.boardId)) byBoard.set(c.boardId, []);
		byBoard.get(c.boardId)!.push(c);
	}

	const entries: AnalysisEntry[] = [];
	let used = 0;
	const ordered = boards.filter((b) => !isAnalysisBoard(b)).sort(newestFirst);

	for (const b of ordered) {
		const columns = findBoardFormat(b.format).columns;
		const boardDate = b.createdAt.toISOString().slice(0, 10);
		const boardCards = (byBoard.get(b.id) ?? []).sort(newestFirst);
		for (const c of boardCards) {
			const text = c.content.trim();
			if (!text) continue;
			if (entries.length >= max) return entries;
			if (used + text.length > budget) return entries;
			used += text.length;
			entries.push({
				text,
				tone: columns.find((col) => col.id === c.columnType)?.tone ?? 'accent',
				boardTitle: b.title,
				boardDate,
				score: score.get(c.id) ?? 0
			});
		}
	}
	return entries;
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npx vitest run src/lib/server/analysis.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Коммит**

```bash
git add src/lib/server/analysis.ts src/lib/server/analysis.test.ts
git commit -m "Анализ пространства: выбор карточек для модели

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Кеш, лимит и замок

**Files:**
- Modify: `src/lib/server/analysis.ts`
- Test: `src/lib/server/analysis.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const ANALYSIS_DAILY_LIMIT = 3;
  export const ANALYSIS_WINDOW_MS = 24 * 60 * 60 * 1000;
  export function cacheState(latestRegularAt: Date | null, latestAnalysisAt: Date | null): 'fresh' | 'stale';
  export function analysesInWindow(analysisBoards: { createdAt: Date }[], now: Date, windowMs?: number): { count: number; oldestAt: Date | null };
  export function retryInHours(oldestAt: Date, now: Date, windowMs?: number): number; // целое ≥ 1
  export function runOnce<T>(key: string, fn: () => Promise<T>): Promise<T>;
  ```

- [ ] **Step 1: Написать падающие тесты**

Дописать в `src/lib/server/analysis.test.ts` (импорт расширить: `cacheState, analysesInWindow, retryInHours, runOnce, ANALYSIS_DAILY_LIMIT, ANALYSIS_WINDOW_MS`):

```ts
describe('cacheState — новая доска сбрасывает кеш', () => {
	it('анализа не было → stale', () => {
		expect(cacheState(d('2026-09-01T00:00:00Z'), null)).toBe('stale');
	});
	it('анализ новее последней доски → fresh', () => {
		expect(cacheState(d('2026-09-01T00:00:00Z'), d('2026-09-02T00:00:00Z'))).toBe('fresh');
	});
	it('после анализа появилась доска → stale', () => {
		expect(cacheState(d('2026-09-03T00:00:00Z'), d('2026-09-02T00:00:00Z'))).toBe('stale');
	});
	it('обычных досок нет, анализ есть → fresh (нечего пересчитывать)', () => {
		expect(cacheState(null, d('2026-09-02T00:00:00Z'))).toBe('fresh');
	});
});

describe('analysesInWindow / retryInHours — 3 в сутки на пространство', () => {
	const now = d('2026-09-16T12:00:00Z');
	it('считает только доски внутри окна и находит самую старую из них', () => {
		const list = [
			{ createdAt: d('2026-09-15T11:00:00Z') }, // 25 ч назад — вне окна
			{ createdAt: d('2026-09-16T09:00:00Z') },
			{ createdAt: d('2026-09-15T14:00:00Z') }
		];
		expect(analysesInWindow(list, now)).toEqual({ count: 2, oldestAt: d('2026-09-15T14:00:00Z') });
	});
	it('пустой список → 0 и null', () => {
		expect(analysesInWindow([], now)).toEqual({ count: 0, oldestAt: null });
	});
	it('часы до освобождения слота округляются вверх и не меньше 1', () => {
		expect(retryInHours(d('2026-09-15T14:00:00Z'), now)).toBe(2); // 22 ч прошло → 2 ч осталось
		expect(retryInHours(d('2026-09-15T12:30:00Z'), now)).toBe(1); // 30 мин осталось → 1
		expect(retryInHours(d('2026-09-15T11:59:00Z'), now)).toBe(1); // уже свободно, но показываем 1
	});
	it('константы', () => {
		expect(ANALYSIS_DAILY_LIMIT).toBe(3);
		expect(ANALYSIS_WINDOW_MS).toBe(86_400_000);
	});
});

describe('runOnce — параллельные клики схлопываются', () => {
	it('второй вызов с тем же ключом получает результат первого, fn запускается один раз', async () => {
		let calls = 0;
		let release!: (v: string) => void;
		const fn = () => {
			calls++;
			return new Promise<string>((res) => (release = res));
		};
		const p1 = runOnce('space-1', fn);
		const p2 = runOnce('space-1', fn);
		release('slug-1');
		expect(await p1).toBe('slug-1');
		expect(await p2).toBe('slug-1');
		expect(calls).toBe(1);
	});
	it('после завершения ключ свободен, ошибка тоже освобождает', async () => {
		await expect(runOnce('space-2', () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
		expect(await runOnce('space-2', () => Promise.resolve('ok'))).toBe('ok');
	});
	it('разные ключи независимы', async () => {
		const [a, b] = await Promise.all([
			runOnce('x', () => Promise.resolve('a')),
			runOnce('y', () => Promise.resolve('b'))
		]);
		expect([a, b]).toEqual(['a', 'b']);
	});
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/lib/server/analysis.test.ts`
Expected: FAIL — функции не экспортируются.

- [ ] **Step 3: Реализовать**

Дописать в `src/lib/server/analysis.ts`:

```ts
export const ANALYSIS_DAILY_LIMIT = 3;
export const ANALYSIS_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Кеш актуален, пока после последней доски-анализа не появилось новой обычной доски. */
export function cacheState(latestRegularAt: Date | null, latestAnalysisAt: Date | null): 'fresh' | 'stale' {
	if (!latestAnalysisAt) return 'stale';
	if (!latestRegularAt) return 'fresh';
	return latestAnalysisAt.getTime() > latestRegularAt.getTime() ? 'fresh' : 'stale';
}

/** Сколько анализов сделано за окно и когда самый старый из них — от него считаем «через N ч». */
export function analysesInWindow(
	analysisBoards: { createdAt: Date }[],
	now: Date,
	windowMs = ANALYSIS_WINDOW_MS
): { count: number; oldestAt: Date | null } {
	const since = now.getTime() - windowMs;
	let count = 0;
	let oldestAt: Date | null = null;
	for (const b of analysisBoards) {
		if (b.createdAt.getTime() <= since) continue;
		count++;
		if (!oldestAt || b.createdAt < oldestAt) oldestAt = b.createdAt;
	}
	return { count, oldestAt };
}

export function retryInHours(oldestAt: Date, now: Date, windowMs = ANALYSIS_WINDOW_MS): number {
	const left = oldestAt.getTime() + windowMs - now.getTime();
	return Math.max(1, Math.ceil(left / 3_600_000));
}

// Один анализ на пространство в моменте: второй клик ждёт результат первого.
// Процесс один, поэтому Map в памяти достаточно.
const inFlight = new Map<string, Promise<unknown>>();

export function runOnce<T>(key: string, fn: () => Promise<T>): Promise<T> {
	const existing = inFlight.get(key);
	if (existing) return existing as Promise<T>;
	const p = fn().finally(() => inFlight.delete(key));
	inFlight.set(key, p);
	return p;
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npx vitest run src/lib/server/analysis.test.ts`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/lib/server/analysis.ts src/lib/server/analysis.test.ts
git commit -m "Анализ пространства: кеш по последней доске, лимит 3 в сутки, замок

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Промпт, разбор ответа и тексты доски

**Files:**
- Modify: `src/lib/server/analysis.ts`
- Test: `src/lib/server/analysis.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AnalysisLocale = 'en' | 'ru';
  export interface ChatMessage { role: 'system' | 'user'; content: string }
  export interface AnalysisItem { text: string; boards: number }
  export interface AnalysisResult { well: AnalysisItem[]; bad: AnalysisItem[]; improve: AnalysisItem[] }
  export const ANALYSIS_COLUMNS: { well: 'again_well'; bad: 'again_bad'; improve: 'again_improve' };
  export function buildPrompt(entries: AnalysisEntry[], locale: AnalysisLocale): ChatMessage[];
  export function parseAnalysis(raw: string): AnalysisResult | null;
  export function isEmptyAnalysis(r: AnalysisResult): boolean;
  export function analysisTitle(date: Date, locale: AnalysisLocale): string;
  export function analysisAuthor(locale: AnalysisLocale): string;
  export function cardText(item: AnalysisItem, locale: AnalysisLocale): string;
  export class AnalysisFailure extends Error { kind: 'bad_response' | 'empty' }
  ```

- [ ] **Step 1: Написать падающие тесты**

Дописать в тест (импорт расширить: `buildPrompt, parseAnalysis, isEmptyAnalysis, analysisTitle, analysisAuthor, cardText, ANALYSIS_COLUMNS, AnalysisFailure`):

```ts
describe('buildPrompt', () => {
	const entries = collectCards(
		[board('b1', 'Sprint 7', '2026-09-01T10:00:00Z')],
		[
			card('c1', 'b1', 'didnt_go_well', 'flaky tests', '2026-09-01T10:01:00Z'),
			card('c2', 'b1', 'went_well', 'ci is green', '2026-09-01T10:02:00Z')
		],
		[{ cardId: 'c1', type: 'like' }]
	);
	it('system просит JSON нужной формы и язык, user содержит все карточки с тоном, счётом и доской', () => {
		const [system, user] = buildPrompt(entries, 'ru');
		expect(system.role).toBe('system');
		expect(system.content).toMatch(/json/i);
		expect(system.content).toContain('"well"');
		expect(system.content).toContain('"bad"');
		expect(system.content).toContain('"improve"');
		expect(system.content).toContain('Russian');
		expect(user.role).toBe('user');
		expect(user.content).toContain('Sprint 7 (2026-09-01)');
		expect(user.content).toContain('[bad] (+1) flaky tests');
		expect(user.content).toContain('[well] (0) ci is green');
	});
	it('локаль en просит английский', () => {
		expect(buildPrompt(entries, 'en')[0].content).toContain('English');
	});
});

describe('parseAnalysis', () => {
	it('валидный JSON → результат, лишние поля отброшены, boards нормализован', () => {
		const raw = JSON.stringify({
			well: [{ text: 'CI stays green', boards: 3, extra: 1 }],
			bad: [{ text: 'Flaky tests', boards: '2' }],
			improve: [{ text: 'Write ADRs', boards: 0 }]
		});
		expect(parseAnalysis(raw)).toEqual({
			well: [{ text: 'CI stays green', boards: 3 }],
			bad: [{ text: 'Flaky tests', boards: 2 }],
			improve: [{ text: 'Write ADRs', boards: 1 }]
		});
	});
	it('терпит ```json-обёртку и отсутствующие колонки', () => {
		const raw = '```json\n{"bad":[{"text":"x","boards":2}]}\n```';
		expect(parseAnalysis(raw)).toEqual({ well: [], bad: [{ text: 'x', boards: 2 }], improve: [] });
	});
	it('мусор, не-объект, элементы без текста → null или пропуск', () => {
		expect(parseAnalysis('not json')).toBeNull();
		expect(parseAnalysis('[]')).toBeNull();
		expect(parseAnalysis('"str"')).toBeNull();
		expect(parseAnalysis(JSON.stringify({ well: [{ boards: 2 }, { text: '   ' }, 'nope'] }))).toEqual({
			well: [],
			bad: [],
			improve: []
		});
	});
	it('режет текст до 2000 символов и берёт не больше 6 элементов в колонке', () => {
		const long = 'a'.repeat(2500);
		const eight = Array.from({ length: 8 }, (_, i) => ({ text: `p${i}`, boards: 1 }));
		const r = parseAnalysis(JSON.stringify({ well: [{ text: long, boards: 1 }], bad: eight }))!;
		expect(r.well[0].text).toHaveLength(2000);
		expect(r.bad).toHaveLength(6);
	});
	it('isEmptyAnalysis — все три массива пусты', () => {
		expect(isEmptyAnalysis({ well: [], bad: [], improve: [] })).toBe(true);
		expect(isEmptyAnalysis({ well: [{ text: 'x', boards: 1 }], bad: [], improve: [] })).toBe(false);
	});
});

describe('тексты доски-анализа', () => {
	const date = new Date(Date.UTC(2026, 8, 16, 12));
	it('название по локали, дата d.m.Y', () => {
		expect(analysisTitle(date, 'ru')).toBe('Анализ пространства за 16.09.2026');
		expect(analysisTitle(date, 'en')).toBe('Space analysis for 16.09.2026');
	});
	it('автор', () => {
		expect(analysisAuthor('ru')).toBe('AI-анализ');
		expect(analysisAuthor('en')).toBe('AI analysis');
	});
	it('текст карточки с числом досок и русскими формами', () => {
		expect(cardText({ text: 'Flaky tests', boards: 3 }, 'en')).toBe('Flaky tests (in 3 boards)');
		expect(cardText({ text: 'Flaky tests', boards: 1 }, 'en')).toBe('Flaky tests (in 1 board)');
		expect(cardText({ text: 'Тесты флапают', boards: 1 }, 'ru')).toBe('Тесты флапают (в 1 доске)');
		expect(cardText({ text: 'Тесты флапают', boards: 3 }, 'ru')).toBe('Тесты флапают (в 3 досках)');
		expect(cardText({ text: 'Тесты флапают', boards: 21 }, 'ru')).toBe('Тесты флапают (в 21 доске)');
	});
	it('колонки и ошибка', () => {
		expect(ANALYSIS_COLUMNS).toEqual({ well: 'again_well', bad: 'again_bad', improve: 'again_improve' });
		expect(new AnalysisFailure('empty').kind).toBe('empty');
	});
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/lib/server/analysis.test.ts`
Expected: FAIL — функции не экспортируются.

- [ ] **Step 3: Реализовать**

Дописать в `src/lib/server/analysis.ts`:

```ts
export type AnalysisLocale = 'en' | 'ru';

export interface ChatMessage {
	role: 'system' | 'user';
	content: string;
}

export interface AnalysisItem {
	text: string;
	boards: number;
}

export interface AnalysisResult {
	well: AnalysisItem[];
	bad: AnalysisItem[];
	improve: AnalysisItem[];
}

export const ANALYSIS_COLUMNS = {
	well: 'again_well',
	bad: 'again_bad',
	improve: 'again_improve'
} as const;

export class AnalysisFailure extends Error {
	constructor(public kind: 'bad_response' | 'empty') {
		super(`analysis ${kind}`);
	}
}

const LANGUAGE: Record<AnalysisLocale, string> = { en: 'English', ru: 'Russian' };

const MAX_ITEMS_PER_COLUMN = 6;
const MAX_ITEM_TEXT = 2000;

export function buildPrompt(entries: AnalysisEntry[], locale: AnalysisLocale): ChatMessage[] {
	const system = [
		'You are an experienced agile facilitator. You are given cards from several retrospectives of one team, newest first.',
		'Each card has a tone: well = went well, bad = went badly, improve = something to improve, accent = other.',
		'The score is likes minus dislikes from the team.',
		'Find patterns that REPEAT ACROSS DIFFERENT retrospectives, not things mentioned once. Weigh cards with higher scores more.',
		'Respond with JSON only, exactly this shape:',
		'{"well":[{"text":"...","boards":2}],"bad":[{"text":"...","boards":3}],"improve":[{"text":"...","boards":2}]}',
		'well = what keeps going well, bad = what keeps going badly, improve = what the team keeps wanting to improve.',
		'"boards" is the number of distinct retrospectives where the pattern appears (integer, at least 1).',
		`At most ${MAX_ITEMS_PER_COLUMN} items per key, each "text" is 1-2 sentences in ${LANGUAGE[locale]}.`,
		'Do not invent anything. If there is too little data, return fewer items or empty arrays.'
	].join('\n');

	const lines: string[] = [];
	let current = '';
	for (const e of entries) {
		const header = `${e.boardTitle} (${e.boardDate})`;
		if (header !== current) {
			current = header;
			lines.push('', `## ${header}`);
		}
		const score = e.score > 0 ? `+${e.score}` : String(e.score);
		lines.push(`- [${e.tone}] (${score}) ${e.text}`);
	}
	const user = `Retrospective cards, newest first:${lines.join('\n')}`;

	return [
		{ role: 'system', content: system },
		{ role: 'user', content: user }
	];
}

function normalizeItems(value: unknown): AnalysisItem[] {
	if (!Array.isArray(value)) return [];
	const items: AnalysisItem[] = [];
	for (const raw of value) {
		if (!raw || typeof raw !== 'object') continue;
		const text = typeof (raw as { text?: unknown }).text === 'string' ? (raw as { text: string }).text.trim() : '';
		if (!text) continue;
		const n = Math.floor(Number((raw as { boards?: unknown }).boards));
		items.push({ text: text.slice(0, MAX_ITEM_TEXT), boards: Number.isFinite(n) && n >= 1 ? n : 1 });
		if (items.length >= MAX_ITEMS_PER_COLUMN) break;
	}
	return items;
}

/** Разбирает ответ модели. Мусор или не-объект → null. Лишние поля отбрасываются. */
export function parseAnalysis(raw: string): AnalysisResult | null {
	const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
	let parsed: unknown;
	try {
		parsed = JSON.parse(cleaned);
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
	const obj = parsed as Record<string, unknown>;
	return {
		well: normalizeItems(obj.well),
		bad: normalizeItems(obj.bad),
		improve: normalizeItems(obj.improve)
	};
}

export function isEmptyAnalysis(r: AnalysisResult): boolean {
	return r.well.length === 0 && r.bad.length === 0 && r.improve.length === 0;
}

function dmy(date: Date): string {
	const dd = String(date.getUTCDate()).padStart(2, '0');
	const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
	return `${dd}.${mm}.${date.getUTCFullYear()}`;
}

export function analysisTitle(date: Date, locale: AnalysisLocale): string {
	return locale === 'ru' ? `Анализ пространства за ${dmy(date)}` : `Space analysis for ${dmy(date)}`;
}

export function analysisAuthor(locale: AnalysisLocale): string {
	return locale === 'ru' ? 'AI-анализ' : 'AI analysis';
}

// Формы «доска» вручную: t() живёт в клиентском словаре, на сервере его нет
function ruBoards(n: number): string {
	const m10 = n % 10;
	const m100 = n % 100;
	if (m10 === 1 && m100 !== 11) return 'доске';
	return 'досках';
}

export function cardText(item: AnalysisItem, locale: AnalysisLocale): string {
	if (locale === 'ru') return `${item.text} (в ${item.boards} ${ruBoards(item.boards)})`;
	return `${item.text} (in ${item.boards} ${item.boards === 1 ? 'board' : 'boards'})`;
}
```

- [ ] **Step 4: Прогнать тесты и типы**

Run: `npx vitest run src/lib/server/analysis.test.ts && npm run check`
Expected: PASS, 0 errors.

- [ ] **Step 5: Коммит**

```bash
git add src/lib/server/analysis.ts src/lib/server/analysis.test.ts
git commit -m "Анализ пространства: промпт, разбор ответа, тексты доски

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Клиент DeepSeek

**Files:**
- Create: `src/lib/server/deepseek.ts`
- Test: `src/lib/server/deepseek.test.ts` (создать)

**Interfaces:**
- Consumes: `ChatMessage` из `analysis.ts`.
- Produces:
  ```ts
  export type DeepSeekErrorKind = 'network' | 'timeout' | 'http' | 'shape';
  export class DeepSeekError extends Error { kind: DeepSeekErrorKind; status?: number }
  export interface DeepSeekOptions { apiKey: string; apiBase?: string; timeoutMs?: number; fetchFn?: typeof fetch }
  export const DEEPSEEK_DEFAULT_BASE = 'https://api.deepseek.com';
  export function chatCompletion(messages: ChatMessage[], opts: DeepSeekOptions): Promise<string>; // content первого choice
  ```

- [ ] **Step 1: Написать падающие тесты**

`src/lib/server/deepseek.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { chatCompletion, DeepSeekError, DEEPSEEK_DEFAULT_BASE } from './deepseek.js';

const messages = [
	{ role: 'system' as const, content: 'sys' },
	{ role: 'user' as const, content: 'usr' }
];

function okResponse(content: string) {
	return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
}

describe('chatCompletion', () => {
	it('шлёт OpenAI-совместимый запрос с ключом, json-режимом и возвращает content', async () => {
		const fetchFn = vi.fn(async () => okResponse('{"well":[]}'));
		const out = await chatCompletion(messages, { apiKey: 'sk-test', fetchFn });
		expect(out).toBe('{"well":[]}');
		expect(fetchFn).toHaveBeenCalledTimes(1);
		const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe(`${DEEPSEEK_DEFAULT_BASE}/chat/completions`);
		expect(init.method).toBe('POST');
		expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
		const body = JSON.parse(init.body as string);
		expect(body.model).toBe('deepseek-chat');
		expect(body.messages).toEqual(messages);
		expect(body.response_format).toEqual({ type: 'json_object' });
		expect(body.stream).toBe(false);
	});

	it('apiBase без хвостового слэша и с ним даёт один URL', async () => {
		const fetchFn = vi.fn(async () => okResponse('x'));
		await chatCompletion(messages, { apiKey: 'k', apiBase: 'http://localhost:4778/', fetchFn });
		expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe('http://localhost:4778/chat/completions');
	});

	it('HTTP-ошибка → DeepSeekError http со статусом', async () => {
		const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }));
		await expect(chatCompletion(messages, { apiKey: 'k', fetchFn })).rejects.toMatchObject({
			kind: 'http',
			status: 500
		});
	});

	it('ответ без choices → DeepSeekError shape', async () => {
		const fetchFn = vi.fn(async () => new Response('{"foo":1}', { status: 200 }));
		await expect(chatCompletion(messages, { apiKey: 'k', fetchFn })).rejects.toMatchObject({ kind: 'shape' });
	});

	it('сетевая ошибка → DeepSeekError network', async () => {
		const fetchFn = vi.fn(async () => {
			throw new TypeError('fetch failed');
		});
		await expect(chatCompletion(messages, { apiKey: 'k', fetchFn })).rejects.toMatchObject({ kind: 'network' });
	});

	it('таймаут → DeepSeekError timeout', async () => {
		const fetchFn = vi.fn(
			(_url: string, init?: RequestInit) =>
				new Promise<Response>((_, reject) => {
					init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
				})
		);
		await expect(chatCompletion(messages, { apiKey: 'k', fetchFn: fetchFn as unknown as typeof fetch, timeoutMs: 10 })).rejects.toMatchObject({
			kind: 'timeout'
		});
	});

	it('DeepSeekError — это Error с kind', () => {
		const e = new DeepSeekError('http', 'bad', 502);
		expect(e).toBeInstanceOf(Error);
		expect(e.kind).toBe('http');
		expect(e.status).toBe(502);
	});
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/lib/server/deepseek.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать клиент**

`src/lib/server/deepseek.ts`:

```ts
// Тонкий клиент DeepSeek (OpenAI-совместимый chat/completions). Ключ и текст
// карточек в ошибки и логи не попадают — только вид ошибки и статус.
import type { ChatMessage } from './analysis.js';

export type DeepSeekErrorKind = 'network' | 'timeout' | 'http' | 'shape';

export class DeepSeekError extends Error {
	constructor(
		public kind: DeepSeekErrorKind,
		message: string,
		public status?: number
	) {
		super(message);
	}
}

export interface DeepSeekOptions {
	apiKey: string;
	apiBase?: string;
	timeoutMs?: number;
	fetchFn?: typeof fetch;
}

export const DEEPSEEK_DEFAULT_BASE = 'https://api.deepseek.com';
const DEFAULT_TIMEOUT_MS = 60_000;

export async function chatCompletion(messages: ChatMessage[], opts: DeepSeekOptions): Promise<string> {
	const base = (opts.apiBase || DEEPSEEK_DEFAULT_BASE).replace(/\/+$/, '');
	const fetchFn = opts.fetchFn ?? fetch;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

	let res: Response;
	try {
		res = await fetchFn(`${base}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${opts.apiKey}`
			},
			body: JSON.stringify({
				model: 'deepseek-chat',
				messages,
				response_format: { type: 'json_object' },
				temperature: 0.3,
				max_tokens: 2000,
				stream: false
			}),
			signal: controller.signal
		});
	} catch (err) {
		const aborted = (err as { name?: string })?.name === 'AbortError';
		throw new DeepSeekError(aborted ? 'timeout' : 'network', aborted ? 'DeepSeek timed out' : 'DeepSeek unreachable');
	} finally {
		clearTimeout(timer);
	}

	if (!res.ok) throw new DeepSeekError('http', `DeepSeek HTTP ${res.status}`, res.status);

	let data: unknown;
	try {
		data = await res.json();
	} catch {
		throw new DeepSeekError('shape', 'DeepSeek returned non-JSON body');
	}
	const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
	if (typeof content !== 'string') throw new DeepSeekError('shape', 'DeepSeek response has no content');
	return content;
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npx vitest run src/lib/server/deepseek.test.ts && npm run check`
Expected: PASS (7 tests), 0 errors.

- [ ] **Step 5: Коммит**

```bash
git add src/lib/server/deepseek.ts src/lib/server/deepseek.test.ts
git commit -m "Анализ пространства: клиент DeepSeek с типизированными ошибками

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Админ пространства — админ его досок; `analysisEnabled` и `format` в загрузках

**Files:**
- Modify: `src/routes/[slug]/+page.server.ts`
- Modify: `src/routes/spaces/[slug]/+page.server.ts` (load)
- Modify: `src/lib/components/SpaceBoardGrid.svelte:5-13` (интерфейс `SpaceBoard`)
- Test: `e2e/analysis.spec.ts` (сценарий 7 в Task 12 покрывает права; здесь — только проверка типов)

**Interfaces:**
- Produces: в данных страницы доски `analysisEnabled: boolean`; `isCreator` истинен и для создателя пространства. В данных пространства `analysisEnabled: boolean`, у каждой доски `format: string`.

- [ ] **Step 1: Страница доски — создатель пространства становится создателем доски**

В `src/routes/[slug]/+page.server.ts` добавить импорт `import { env } from '$env/dynamic/private';`.

Перенести блок загрузки пространства **выше** вычисления `isCreator` и расширить его:

```ts
	// Родительское пространство и его админ: создатель пространства управляет
	// всеми его досками (переименовать, удалить, вести обсуждение), включая доску-анализ
	let space: { slug: string; name: string } | null = null;
	let spaceCreator = false;
	if (board.spaceId) {
		const s = await db.query.spaces.findFirst({
			where: eq(spaces.id, board.spaceId)
		});
		if (s) {
			space = { slug: s.slug, name: s.name };
			const spaceCookie = cookies.get(`retro_space_creator_${s.slug}`) ?? '';
			spaceCreator = !!s.creatorToken && spaceCookie === s.creatorToken;
		}
	}

	const adminParam = url.searchParams.get('admin') ?? '';
	const cookieToken = cookies.get(`retro_creator_${params.slug}`) ?? '';

	let isCreator = spaceCreator;
	let showAdminBanner = false;

	if (adminParam && adminParam === board.creatorToken) {
		cookies.set(`retro_creator_${params.slug}`, adminParam, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
		isCreator = true;
		showAdminBanner = true;
	} else if (cookieToken && cookieToken === board.creatorToken) {
		isCreator = true;
	}
```

Удалить старый блок `// Load parent space if board belongs to one` ниже. В возвращаемый объект добавить `analysisEnabled: !!env.DEEPSEEK_API_KEY,`.

- [ ] **Step 2: Страница пространства — `format` у досок и `analysisEnabled`**

В `src/routes/spaces/[slug]/+page.server.ts` добавить импорт `import { env } from '$env/dynamic/private';`. В запросе `spaceBoards` добавить `format: boards.format,` после `title: boards.title,` и `boards.format` в `.groupBy(boards.id, boards.slug, boards.title, boards.format, boards.createdAt)`.

В ранний `return` (пространство под паролем) добавить `analysisEnabled: false`. В основной `return` добавить `analysisEnabled: !!env.DEEPSEEK_API_KEY`.

- [ ] **Step 3: Интерфейс плитки**

В `src/lib/components/SpaceBoardGrid.svelte` в `interface SpaceBoard` добавить `format: string;` после `title: string;`.

- [ ] **Step 4: Проверить типы и тесты**

Run: `npm run check && npm test`
Expected: 0 errors, все тесты зелёные.

- [ ] **Step 5: Коммит**

```bash
git add src/routes/[slug]/+page.server.ts src/routes/spaces/[slug]/+page.server.ts src/lib/components/SpaceBoardGrid.svelte
git commit -m "Анализ пространства: админ пространства — админ его досок, флаг analysisEnabled

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Form action `analyze`

**Files:**
- Modify: `src/routes/spaces/[slug]/+page.server.ts` (actions)

**Interfaces:**
- Consumes: всё из Task 3–6, `encrypt` из Task 2, `metric` из `$lib/server/statsd.js`, `decrypt` из `$lib/server/crypto.js`.
- Produces: `POST /spaces/{slug}?/analyze` с полем `locale`. Успех — редирект 303 на `/{slug}` доски-анализа. Ошибка — `fail(status, { analysis: kind, retryInHours? })`, где `kind ∈ not_configured | no_cards | limit | network | timeout | http | bad_response | empty`.

- [ ] **Step 1: Импорты**

В начало `src/routes/spaces/[slug]/+page.server.ts` добавить:

```ts
import { ANALYSIS_FORMAT } from '$lib/formats.js';
import { decrypt, encrypt } from '$lib/server/crypto.js';
import { votes } from '$lib/server/db/schema.js'; // добавить в существующий импорт schema
import { inArray } from 'drizzle-orm'; // добавить в существующий импорт drizzle-orm
import {
	ANALYSIS_COLUMNS,
	ANALYSIS_DAILY_LIMIT,
	AnalysisFailure,
	analysesInWindow,
	analysisAuthor,
	analysisTitle,
	buildPrompt,
	cacheState,
	cardText,
	collectCards,
	isAnalysisBoard,
	isEmptyAnalysis,
	parseAnalysis,
	retryInHours,
	runOnce,
	type AnalysisLocale
} from '$lib/server/analysis.js';
import { chatCompletion, DeepSeekError } from '$lib/server/deepseek.js';
```

(`env` уже импортирован в Task 7.)

- [ ] **Step 2: Action**

Добавить в `actions` после `createBoard`:

```ts
	analyze: async ({ request, params, cookies }) => {
		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404);

		// Доступ как к самому пространству: пароль введён, пароля нет или это создатель
		const creatorCookie = cookies.get(`retro_space_creator_${params.slug}`) ?? '';
		const isCreator = !!space.creatorToken && creatorCookie === space.creatorToken;
		if (space.passwordHash && !cookies.get(`retro_space_${params.slug}`) && !isCreator) {
			throw error(403, 'Not authenticated');
		}

		metric('retro.analysis.requested', 1);
		const failWith = (status: number, kind: string, extra: Record<string, unknown> = {}) => {
			metric(`retro.analysis.failed.${kind}`, 1);
			return fail(status, { analysis: kind, ...extra });
		};

		const apiKey = env.DEEPSEEK_API_KEY || '';
		if (!apiKey) return failWith(503, 'not_configured');

		const formData = await request.formData();
		const locale: AnalysisLocale = formData.get('locale') === 'ru' ? 'ru' : 'en';

		const spaceBoards = await db
			.select({ id: boards.id, slug: boards.slug, title: boards.title, format: boards.format, createdAt: boards.createdAt })
			.from(boards)
			.where(eq(boards.spaceId, space.id))
			.orderBy(desc(boards.createdAt));
		const regular = spaceBoards.filter((b) => !isAnalysisBoard(b));
		const analyses = spaceBoards.filter(isAnalysisBoard);

		// Кеш: новых досок с последнего анализа не было — открываем его
		if (cacheState(regular[0]?.createdAt ?? null, analyses[0]?.createdAt ?? null) === 'fresh') {
			metric('retro.analysis.cached', 1);
			throw redirect(303, `/${analyses[0].slug}`);
		}

		const now = new Date();
		const window = analysesInWindow(analyses, now);
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

		let slug: string;
		try {
			slug = await runOnce(space.id, async () => {
				const started = Date.now();
				const raw = await chatCompletion(buildPrompt(entries, locale), {
					apiKey,
					apiBase: env.DEEPSEEK_API_BASE || undefined
				});
				const result = parseAnalysis(raw);
				if (!result) throw new AnalysisFailure('bad_response');
				if (isEmptyAnalysis(result)) throw new AnalysisFailure('empty');

				const boardSlug = nanoid(21);
				const creatorToken = nanoid(32);
				const author = encrypt(analysisAuthor(locale));
				await db.transaction(async (tx) => {
					const [created] = await tx
						.insert(boards)
						.values({ title: analysisTitle(now, locale), slug: boardSlug, creatorToken, spaceId: space.id, format: ANALYSIS_FORMAT })
						.returning({ id: boards.id });
					const rows = (['well', 'bad', 'improve'] as const).flatMap((key) =>
						result[key].map((item) => ({
							boardId: created.id,
							columnType: ANALYSIS_COLUMNS[key],
							content: encrypt(cardText(item, locale)) ?? '',
							authorName: author
						}))
					);
					if (rows.length) await tx.insert(cards).values(rows);
				});

				cookies.set(`retro_creator_${boardSlug}`, creatorToken, {
					path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
				});
				metric('retro.analysis.created', 1);
				metric('retro.analysis.duration_ms', Date.now() - started, 'ms');
				console.info(JSON.stringify({ event: 'analysis:created', space: params.slug, cards: entries.length, ms: Date.now() - started }));
				return boardSlug;
			});
		} catch (err) {
			if (err instanceof DeepSeekError) {
				console.warn(JSON.stringify({ event: 'analysis:failed', space: params.slug, kind: err.kind, status: err.status ?? null }));
				return failWith(502, err.kind === 'shape' ? 'bad_response' : err.kind);
			}
			if (err instanceof AnalysisFailure) {
				console.warn(JSON.stringify({ event: 'analysis:failed', space: params.slug, kind: err.kind }));
				return failWith(err.kind === 'empty' ? 422 : 502, err.kind);
			}
			console.error(JSON.stringify({ event: 'analysis:failed', space: params.slug, kind: 'unknown', message: (err as Error)?.message }));
			return failWith(500, 'network');
		}

		throw redirect(303, `/${slug}`);
	}
```

Заметка для исполнителя: cookie ставится внутри `runOnce`, поэтому её получит только тот, чей запрос реально создал доску; второй участник, ждавший замок, просто редиректится на доску. Это соответствует спеке (создатель — кто нажал первым), доступ к доске у второго и так есть по ссылке.

- [ ] **Step 3: Проверить типы**

Run: `npm run check && npm test`
Expected: 0 errors. Если `metric` не принимает тип `'ms'`, посмотреть сигнатуру в `src/lib/server/statsd.ts` (`metric(name, value, type = 'c')`) — она принимает строку, ок.

- [ ] **Step 4: Ручная проверка через curl (сервер dev с ключом в .env)**

Только если локальная БД запущена (`docker compose up -d db`, `DATABASE_URL=postgresql://retro:retro@localhost:5433/retro npm run dev`). Создать пространство и доску с карточками в браузере, потом:

```bash
curl -s -X POST "http://localhost:5173/spaces/<slug>?/analyze" -H "Origin: http://localhost:5173" -F locale=ru -i | head -20
```

Expected: `HTTP/1.1 303` с `location: /<новый slug>` (или JSON с `analysis: 'no_cards'`, если карточек нет). Этот шаг можно пропустить — e2e в Task 12 покрывает поток полностью.

- [ ] **Step 5: Коммит**

```bash
git add src/routes/spaces/[slug]/+page.server.ts
git commit -m "Анализ пространства: form action analyze — кеш, лимит, DeepSeek, доска-анализ

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Кнопка, стили и словарь

**Files:**
- Create: `src/lib/components/AnalyzeButton.svelte`
- Modify: `src/lib/components/Header.svelte` (props + правая зона)
- Modify: `src/routes/spaces/[slug]/+page.svelte:83-88` (Header)
- Modify: `src/routes/[slug]/+page.svelte:33-39` (Header)
- Modify: `src/app.css` (токены и классы)
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/ru.json`

**Interfaces:**
- Produces: `<AnalyzeButton spaceSlug compact? />`; проп Header `analysis?: { spaceSlug: string } | null`; CSS `--color-ai-from`, `--color-ai-to`, утилита `ai-frame`, классы `.btn-ai`, `.badge-ai`.

- [ ] **Step 1: Словарь**

В `src/lib/i18n/en.json` после `"space.delete.confirm"`:

```json
	"space.analysis.button": "Space analysis",
	"space.analysis.running": "Analysing… usually under a minute",
	"space.analysis.error.not_configured": "AI analysis is not set up on this server",
	"space.analysis.error.no_cards": "Nothing to analyse yet — add some cards first",
	"space.analysis.error.limit": "Limit reached: 3 analyses a day. Try again in {n} hour|Limit reached: 3 analyses a day. Try again in {n} hours",
	"space.analysis.error.network": "Could not reach the AI service. Try again later",
	"space.analysis.error.timeout": "The AI took too long to answer. Try again",
	"space.analysis.error.http": "The AI service returned an error. Try again later",
	"space.analysis.error.bad_response": "The AI answer could not be read. Try again",
	"space.analysis.error.empty": "The AI found no recurring patterns yet",
	"analysis.badge": "AI analysis",
	"new.space.ai": "AI analysis of patterns across all your retros",
```

В `src/lib/i18n/ru.json` в том же месте:

```json
	"space.analysis.button": "Анализ пространства",
	"space.analysis.running": "Анализируем… обычно до минуты",
	"space.analysis.error.not_configured": "AI-анализ на этом сервере не настроен",
	"space.analysis.error.no_cards": "Пока нечего анализировать — сначала добавьте карточки",
	"space.analysis.error.limit": "Лимит: 3 анализа в сутки. Следующий через {n} час|Лимит: 3 анализа в сутки. Следующий через {n} часа|Лимит: 3 анализа в сутки. Следующий через {n} часов",
	"space.analysis.error.network": "Не удалось связаться с AI-сервисом. Попробуйте позже",
	"space.analysis.error.timeout": "AI отвечал слишком долго. Попробуйте ещё раз",
	"space.analysis.error.http": "AI-сервис вернул ошибку. Попробуйте позже",
	"space.analysis.error.bad_response": "Ответ AI не удалось разобрать. Попробуйте ещё раз",
	"space.analysis.error.empty": "AI пока не нашёл повторяющихся паттернов",
	"analysis.badge": "AI-анализ",
	"new.space.ai": "AI-анализ паттернов по всем ретро",
```

Run: `npm test` — тест целостности словарей должен быть зелёным.

- [ ] **Step 2: CSS**

В `src/app.css` в блок `@theme { … }` (рядом с `--color-accent`) добавить:

```css
	--color-ai-from: #7c3aed;
	--color-ai-to: #c026d3;
```

В блок `.dark { … }`:

```css
	--color-ai-from: #a78bfa;
	--color-ai-to: #e879f9;
```

После секции BADGES добавить:

```css
	/* ---------- AI-АНАЛИЗ ---------- */

	.badge-ai {
		background: linear-gradient(135deg, var(--color-ai-from), var(--color-ai-to));
		color: #fff;
	}
	.btn-ai {
		@apply font-bold text-white active:scale-[0.97];
		background: linear-gradient(135deg, var(--color-ai-from), var(--color-ai-to));
	}
	.btn-ai:hover { filter: brightness(1.08); }
	.btn-ai:disabled { opacity: 0.7; cursor: progress; }
```

Вне `@layer` (в конце файла) — утилита, чтобы работали варианты вроде `md:ai-frame`:

```css
/* Градиентная обводка доски-анализа: фон в padding-box, градиент в border-box.
   --ai-frame-bg задаёт цвет внутри рамки (у плитки — surface-card). */
@utility ai-frame {
	border: 2px solid transparent;
	background:
		linear-gradient(var(--ai-frame-bg, var(--color-surface)), var(--ai-frame-bg, var(--color-surface))) padding-box,
		linear-gradient(135deg, var(--color-ai-from), var(--color-ai-to)) border-box;
}
```

- [ ] **Step 3: Компонент кнопки**

`src/lib/components/AnalyzeButton.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { t } from '$lib/i18n/index.js';

	// compact: на узких экранах остаётся только иконка (как у «Поделиться»)
	let { spaceSlug, compact = false }: { spaceSlug: string; compact?: boolean } = $props();

	let busy = $state(false);
	let error = $state<{ kind: string; hours: number } | null>(null);
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	function showError(kind: string, hours = 0) {
		error = { kind, hours };
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => (error = null), 8000);
	}
</script>

<form
	method="POST"
	action="/spaces/{spaceSlug}?/analyze"
	class="contents"
	use:enhance={() => {
		busy = true;
		error = null;
		return async ({ result }) => {
			busy = false;
			if (result.type === 'redirect') {
				await goto(result.location, { invalidateAll: true });
			} else if (result.type === 'failure') {
				const data = (result.data ?? {}) as { analysis?: string; retryInHours?: number };
				showError(data.analysis ?? 'network', data.retryInHours ?? 0);
			} else if (result.type === 'error') {
				showError('network');
			}
		};
	}}
>
	<input type="hidden" name="locale" value={localeStore.locale} />
	<button
		type="submit"
		disabled={busy}
		class="btn btn-ai btn-md"
		title={t('space.analysis.button')}
		aria-label={t('space.analysis.button')}
		data-testid="analyze-button"
	>
		{#if busy}
			<svg class="h-[15px] w-[15px] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
		{:else}
			<svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/></svg>
		{/if}
		<span class={compact ? 'hidden sm:inline' : ''}>{t('space.analysis.button')}</span>
	</button>
</form>

{#if busy || error}
	<div
		role="status"
		class="card-enter fixed bottom-5 left-1/2 z-[60] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-border bg-surface-card px-4 py-3 text-sm shadow-lg {error ? 'text-bad' : 'text-text-secondary'}"
		data-testid="analyze-status"
	>
		{#if error}
			{t(`space.analysis.error.${error.kind}`, { n: error.hours })}
		{:else}
			{t('space.analysis.running')}
		{/if}
	</div>
{/if}
```

- [ ] **Step 4: Header**

В `src/lib/components/Header.svelte`:

Импорт: `import AnalyzeButton from './AnalyzeButton.svelte';` и `import { ANALYSIS_FORMAT } from '$lib/formats.js';`.

В props добавить `analysis = null` и тип `analysis?: { spaceSlug: string } | null;`.

В правой зоне `<!-- Right: actions -->` внутри `{#if isBoard}` **перед** `<!-- Share: primary visible action -->`:

```svelte
				{#if analysis}
					<AnalyzeButton spaceSlug={analysis.spaceSlug} compact />
				{/if}
```

В ветке `{:else}` **перед** `{#if onNewBoard}`:

```svelte
				{#if analysis}
					<AnalyzeButton spaceSlug={analysis.spaceSlug} compact />
				{/if}
```

Бейдж доски-анализа: в десктопных крошках после `{/if}` блока `renaming` (внутри `<div class="hidden … md:flex">`):

```svelte
				{#if boardStore.board?.format === ANALYSIS_FORMAT}
					<span class="badge-sm badge-ai shrink-0">{t('analysis.badge')}</span>
				{/if}
```

И в мобильной подписи заменить `{spaceName ?? t('header.brand')} · …` на:

```svelte
				<span class="truncate text-[13px] text-text-muted">
					{#if boardStore.board?.format === ANALYSIS_FORMAT}<span class="badge-sm badge-ai mr-1 align-middle">{t('analysis.badge')}</span>{/if}
					{spaceName ?? t('header.brand')} · {t('user.online', { n: socketStore.usersCount })}
				</span>
```

- [ ] **Step 5: Страницы передают проп**

`src/routes/spaces/[slug]/+page.svelte`, компонент Header:

```svelte
	<Header
		spaceName={data.space.name}
		spaceSlug={data.space.slug}
		locked={data.hasPassword}
		onNewBoard={data.authenticated ? () => (creating = true) : null}
		analysis={data.authenticated && data.analysisEnabled ? { spaceSlug: data.space.slug } : null}
	/>
```

`src/routes/[slug]/+page.svelte`:

```svelte
	<Header
		showOnline={true}
		adminLink={data.adminLink}
		spaceName={data.space?.name}
		spaceSlug={data.space?.slug}
		creatorToken={data.creatorToken}
		analysis={data.space && data.analysisEnabled ? { spaceSlug: data.space.slug } : null}
	/>
```

- [ ] **Step 6: Проверить**

Run: `npm run check && npm test`
Expected: 0 errors, тесты зелёные (включая словарь).

- [ ] **Step 7: Коммит**

```bash
git add src/lib/components/AnalyzeButton.svelte src/lib/components/Header.svelte src/routes/spaces/[slug]/+page.svelte src/routes/[slug]/+page.svelte src/app.css src/lib/i18n/en.json src/lib/i18n/ru.json
git commit -m "Анализ пространства: кнопка в шапке, статус и ошибки, стили AI

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Вид доски-анализа: рамка, плитка, подсказка на /new

**Files:**
- Modify: `src/lib/components/Board.svelte`
- Modify: `src/lib/components/SpaceBoardGrid.svelte`
- Modify: `src/routes/new/+page.svelte` (карточка «Пространство»)

- [ ] **Step 1: Рамка вокруг колонок**

В `src/lib/components/Board.svelte` импорт `import { TONE, ANALYSIS_FORMAT } from '$lib/formats.js';` и после `gridCols`:

```ts
	let isAnalysis = $derived(boardStore.board?.format === ANALYSIS_FORMAT);
```

Контейнер колонок заменить на:

```svelte
<div
	class="mx-auto grid w-full max-w-[1360px] grid-cols-1 gap-5 p-4 pb-32 sm:p-6 md:pb-10 lg:px-7 {gridCols} {isAnalysis ? 'ai-frame rounded-3xl md:mt-5' : ''}"
	data-testid="board-columns"
>
```

- [ ] **Step 2: Плитка в пространстве**

В `src/lib/components/SpaceBoardGrid.svelte` импорт `import { ANALYSIS_FORMAT } from '$lib/formats.js';`. Ссылку-плитку заменить на:

```svelte
			<a
				href="/{board.slug}"
				class="tile-enter flex min-h-[150px] flex-col gap-3.5 rounded-2xl bg-surface-card p-5 transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] {board.format === ANALYSIS_FORMAT
					? 'ai-frame [--ai-frame-bg:var(--color-surface-card)]'
					: 'border border-border hover:border-border-strong'}"
				style="animation-delay: {Math.min(i, 8) * 70}ms"
				data-testid="space-tile"
				data-format={board.format}
			>
				<div class="flex items-start justify-between gap-2">
					<span class="font-heading min-w-0 truncate text-base font-bold text-text-primary">{board.title}</span>
					<span class="flex shrink-0 items-center gap-1.5">
						{#if board.format === ANALYSIS_FORMAT}
							<span class="badge-sm badge-ai">{t('analysis.badge')}</span>
						{/if}
						{#if isLive(board)}
							<span class="rounded-full bg-accent-bg px-[9px] py-[3px] text-[11px] font-bold text-accent">{t('space.tile.live')}</span>
						{/if}
					</span>
				</div>
```

(остальная часть плитки без изменений).

- [ ] **Step 3: Подсказка на /new**

В `src/routes/new/+page.svelte` в кнопке-карточке «Пространство» после `<p class="text-sm leading-relaxed text-text-secondary">{t('new.space.desc')}</p>`:

```svelte
					<span class="mt-auto inline-flex items-center gap-2 text-[13px] font-semibold text-text-secondary">
						<span class="badge-sm badge-ai">AI</span>
						{t('new.space.ai')}
					</span>
```

- [ ] **Step 4: Проверить и посмотреть глазами**

Run: `npm run check && npm test`
Expected: 0 errors.

Если локальная БД поднята — `npm run dev`, открыть `/new` и убедиться, что строка с бейджем AI видна в карточке «Пространство» и не ломает выравнивание карточек. Иначе — полагаемся на e2e.

- [ ] **Step 5: Коммит**

```bash
git add src/lib/components/Board.svelte src/lib/components/SpaceBoardGrid.svelte src/routes/new/+page.svelte
git commit -m "Анализ пространства: градиентная рамка доски и плитки, подсказка на /new

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Конфигурация, документация, changelog

**Files:**
- Modify: `.env.example`, `docker-compose.yml`, `docker-compose.prod.yml`, `CLAUDE.md`, `src/routes/changelog/+page.svelte`
- Local only (не коммитить): `.env`

- [ ] **Step 1: `.env.example`**

В конец файла:

```
# AI-анализ пространства (опционально). Без ключа кнопка не показывается.
# Ключ выдаёт platform.deepseek.com; API совместим с OpenAI chat/completions.
DEEPSEEK_API_KEY=
DEEPSEEK_API_BASE=https://api.deepseek.com
```

- [ ] **Step 2: Compose**

`docker-compose.prod.yml`, блок `environment` сервиса приложения, после `TG_PROXY`:

```yaml
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-}
      DEEPSEEK_API_BASE: ${DEEPSEEK_API_BASE:-https://api.deepseek.com}
```

`docker-compose.yml`, блок `environment` приложения, после `BODY_SIZE_LIMIT`:

```yaml
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-}
      DEEPSEEK_API_BASE: ${DEEPSEEK_API_BASE:-https://api.deepseek.com}
```

- [ ] **Step 3: Локальный `.env`**

Ключ — тот, что пользователь прислал в чате (в план и репозиторий не копировать):

```bash
grep -q '^DEEPSEEK_API_KEY=' .env 2>/dev/null || printf '\nDEEPSEEK_API_KEY=<ключ из чата>\nDEEPSEEK_API_BASE=https://api.deepseek.com\n' >> .env
git status --short .env   # должно быть пусто: .env в .gitignore
```

- [ ] **Step 4: CLAUDE.md**

В раздел «Features» после строки про **Renaming**:

```
- **Space analysis (AI)**: button «Анализ пространства» on a space page and on every board inside a space (only if `DEEPSEEK_API_KEY` is set). Form action `analyze` in `src/routes/spaces/[slug]/+page.server.ts` sends the last 150 cards of all regular boards (newest board and card first, 60k-char budget, no comments) to DeepSeek and creates a board with `format = 'analysis'` (hidden format in `board-formats.js`: not in pickers, `isValidFormat` rejects it, but it renders like any board). The analysis board IS the cache and the rate-limit record: cache is fresh while no regular board is newer than the latest analysis board; limit is 3 analysis boards per space per 24h. Pure logic in `src/lib/server/analysis.ts`, HTTP client in `src/lib/server/deepseek.ts`. Space creator (cookie `retro_space_creator_*`) is treated as creator of every board in the space. E2e runs against `e2e/mock-deepseek.mjs` via `DEEPSEEK_API_BASE`
```

В раздел «Environment variables»:

```
- `DEEPSEEK_API_KEY` — enables the space analysis button; `DEEPSEEK_API_BASE` — override for tests/proxies (default `https://api.deepseek.com`)
```

- [ ] **Step 5: Changelog**

В `src/routes/changelog/+page.svelte` в начало массива `releases`:

```ts
		{
			version: '1.12',
			date: '2026-09-16',
			title: { en: 'Space analysis', ru: 'Анализ пространства' },
			changes: [
				{ en: 'A «Space analysis» button on a space and on its boards: AI reads the recent cards from all retros of the space and shows what keeps going well, what keeps going badly and what the team keeps wanting to improve', ru: 'Кнопка «Анализ пространства» в пространстве и на его досках: AI читает последние карточки всех ретро пространства и показывает, что снова хорошо, что снова плохо и что команда снова хочет улучшить' },
				{ en: 'The result is a regular board with a purple frame — walk through it with the team, vote and comment as usual', ru: 'Результат — обычная доска с фиолетовой рамкой: по ней можно пройтись с командой, голосовать и комментировать как обычно' },
				{ en: 'The analysis is rerun only after a new board appears in the space, and no more than three times a day', ru: 'Анализ пересчитывается только после появления новой доски в пространстве и не чаще трёх раз в сутки' },
				{ en: 'The space creator now has creator rights on every board in the space', ru: 'Создатель пространства теперь имеет права создателя на всех досках пространства' }
			]
		},
```

- [ ] **Step 6: Проверить и закоммитить**

Run: `npm run check && npm test && git status --short`
Expected: 0 errors; `.env` в статусе отсутствует.

```bash
git add .env.example docker-compose.yml docker-compose.prod.yml CLAUDE.md src/routes/changelog/+page.svelte
git commit -m "Анализ пространства: переменные окружения, документация, changelog 1.12

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: E2e с моком DeepSeek

**Files:**
- Create: `e2e/mock-deepseek.mjs`
- Modify: `playwright.config.ts`
- Modify: `e2e/helpers.ts` (перенести `createSpace`, добавить `createBoardInSpace`)
- Modify: `e2e/space-rename.spec.ts` (импорт `createSpace` из helpers)
- Create: `e2e/analysis.spec.ts`

**Interfaces:**
- Produces: `createSpace(page, name): Promise<{ slug: string; adminUrl: string }>`, `createBoardInSpace(page, spaceSlug, title): Promise<string>` (slug доски; после вызова страница — на новой доске).
- Мок: `POST /chat/completions` (режим `ok` — фиксированный JSON, режим `error` — HTTP 500), `POST /__mode` с телом `{ "mode": "ok" | "error" }`, `GET /health`.

- [ ] **Step 1: Мок**

`e2e/mock-deepseek.mjs`:

```js
// Мок DeepSeek для e2e: детерминированный ответ, переключаемый режим ошибки.
// Поднимается Playwright'ом вторым webServer, приложение ходит сюда через DEEPSEEK_API_BASE.
import { createServer } from 'http';

const PORT = Number(process.env.MOCK_PORT || 4778);
let mode = 'ok';

const ANSWER = {
	well: [{ text: 'Deploys keep going smoothly', boards: 2 }],
	bad: [{ text: 'Flaky tests block merges again', boards: 3 }],
	improve: [{ text: 'Write down decisions after each retro', boards: 2 }]
};

function readBody(req) {
	return new Promise((resolve) => {
		let data = '';
		req.on('data', (chunk) => (data += chunk));
		req.on('end', () => resolve(data));
	});
}

createServer(async (req, res) => {
	if (req.method === 'GET' && req.url === '/health') {
		res.writeHead(200).end('ok');
		return;
	}
	if (req.method === 'POST' && req.url === '/__mode') {
		const body = JSON.parse((await readBody(req)) || '{}');
		mode = body.mode === 'error' ? 'error' : 'ok';
		res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ mode }));
		return;
	}
	if (req.method === 'POST' && req.url === '/chat/completions') {
		await readBody(req);
		if (mode === 'error') {
			res.writeHead(500, { 'content-type': 'application/json' }).end('{"error":"mock failure"}');
			return;
		}
		res.writeHead(200, { 'content-type': 'application/json' }).end(
			JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify(ANSWER) } }] })
		);
		return;
	}
	res.writeHead(404).end();
}).listen(PORT, () => console.log(`mock deepseek on ${PORT}`));
```

- [ ] **Step 2: Playwright: два сервера**

В `playwright.config.ts` заменить `webServer: { … }` на массив:

```ts
	webServer: [
		{
			command: 'node e2e/mock-deepseek.mjs',
			url: 'http://localhost:4778/health',
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
				DEEPSEEK_API_KEY: 'test-key',
				DEEPSEEK_API_BASE: 'http://localhost:4778'
			}
		}
	]
```

- [ ] **Step 3: Хелперы**

В `e2e/helpers.ts` добавить:

```ts
// URL доски: host, затем сразу slug. /spaces/<slug> сюда не подходит — slug
// пространства тоже 21 символ, и waitForURL на нём сработал бы мгновенно.
export const BOARD_URL = /\/\/[^/]+\/[A-Za-z0-9_-]{21}(\?.*)?$/;

// Создаёт пространство через UI, закрывает admin-баннер.
// adminUrl — ссылка с ?admin=, по ней другой браузер становится создателем пространства.
export async function createSpace(page: Page, name: string): Promise<{ slug: string; adminUrl: string }> {
	await initStorage(page);
	await page.goto('/new');
	// Форма пространства скрыта за переключателем типа (вторая карточка — «Space»)
	await page.locator('button[aria-pressed]').nth(1).click();
	await page.getByPlaceholder('Space name').fill(name);
	await page.locator('form[action="?/createSpace"] button[type="submit"]').click();
	await page.waitForURL(/\/spaces\/[A-Za-z0-9_-]{21}/);
	const adminUrl = page.url();
	const closeBanner = page.getByRole('button', { name: 'Close' });
	await closeBanner.click();
	await expect(closeBanner).toBeHidden();
	return { slug: new URL(adminUrl).pathname.split('/')[2], adminUrl };
}

// Создаёт доску внутри пространства через модалку «New board». Остаётся на странице доски.
export async function createBoardInSpace(page: Page, spaceSlug: string, title: string): Promise<string> {
	await page.goto(`/spaces/${spaceSlug}`);
	await page.getByRole('button', { name: 'New board' }).first().click();
	const modal = page.getByRole('dialog');
	await modal.getByPlaceholder('Board title (optional)').fill(title);
	await modal.locator('button[type="submit"]').click();
	await page.waitForURL(BOARD_URL);
	const closeBanner = page.getByRole('button', { name: 'Close' });
	await closeBanner.click();
	await expect(closeBanner).toBeHidden();
	return new URL(page.url()).pathname.slice(1);
}
```

В `e2e/space-rename.spec.ts` удалить локальный `createSpace`, импортировать из helpers: `import { initStorage, createSpace } from './helpers';` и заменить вызовы `await createSpace(page, 'X')` на `const { slug } = await createSpace(page, 'X')` там, где slug нужен (в первых двух тестах результат не используется — оставить `await createSpace(page, …)`; в третьем — `const { slug } = …`).

- [ ] **Step 4: Спека — сначала убедиться, что падает**

`e2e/analysis.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { addCard, createBoard, createBoardInSpace, createSpace, initStorage } from './helpers';

const MOCK = 'http://localhost:4778';

async function setMock(page: Page, mode: 'ok' | 'error') {
	await page.request.post(`${MOCK}/__mode`, { data: { mode } });
}

test.afterEach(async ({ page }) => {
	await setMock(page, 'ok');
});

// Жмёт кнопку и ждёт доску-анализ по заголовку; возвращает её pathname
async function runAnalysis(page: Page): Promise<string> {
	await page.getByTestId('analyze-button').click();
	await expect(page).toHaveTitle(/^Space analysis for/, { timeout: 15_000 });
	return new URL(page.url()).pathname;
}

// Пространство с двумя досками и карточками — типичный вход для анализа
async function seedSpace(page: Page, name: string) {
	const space = await createSpace(page, name);
	await createBoardInSpace(page, space.slug, 'Sprint 1');
	await addCard(page, "Didn't Go Well", 'flaky tests');
	await addCard(page, 'Went Well', 'deploys are smooth');
	await createBoardInSpace(page, space.slug, 'Sprint 2');
	await addCard(page, "Didn't Go Well", 'flaky tests again');
	return space;
}

test('analysis creates a purple board with three columns and AI cards', async ({ page }) => {
	const space = await seedSpace(page, 'Analysed team');
	await page.goto(`/spaces/${space.slug}`);
	await page.getByTestId('analyze-button').click();

	// Ждём по заголовку: URL пространства сам похож на URL доски
	await expect(page).toHaveTitle(/^Space analysis for \d{2}\.\d{2}\.\d{4} — /, { timeout: 15_000 });
	for (const name of ['Still good', 'Still bad', 'Still to improve']) {
		await expect(page.getByRole('heading', { name })).toBeVisible();
	}
	const bad = page.locator('.card-board', { hasText: 'Flaky tests block merges again (in 3 boards)' });
	await expect(bad).toBeVisible();
	await expect(bad.getByText('AI analysis', { exact: true })).toBeVisible();
	await expect(page.getByTestId('board-columns')).toHaveClass(/ai-frame/);
	await expect(page.locator('header').getByText('AI analysis', { exact: true }).first()).toBeVisible();

	// В списке пространства — плитка с рамкой и бейджем
	await page.goto(`/spaces/${space.slug}`);
	const tile = page.getByTestId('space-tile').filter({ has: page.getByText(/^Space analysis for/) });
	await expect(tile).toHaveAttribute('data-format', 'analysis');
	await expect(tile).toHaveClass(/ai-frame/);
});

test('cache: no new boards → same analysis board; a new board → a new analysis', async ({ page }) => {
	const space = await seedSpace(page, 'Cached team');
	await page.goto(`/spaces/${space.slug}`);
	const first = await runAnalysis(page);

	await page.goto(`/spaces/${space.slug}`);
	expect(await runAnalysis(page)).toBe(first);

	await createBoardInSpace(page, space.slug, 'Sprint 3');
	// Кнопка есть и на доске внутри пространства
	expect(await runAnalysis(page)).not.toBe(first);
});

test('limit: the fourth analysis in a day is refused with a message', async ({ page }) => {
	test.setTimeout(90_000);
	const space = await seedSpace(page, 'Busy team');
	for (let i = 0; i < 3; i++) {
		await createBoardInSpace(page, space.slug, `Sprint ${10 + i}`);
		await runAnalysis(page);
	}
	await createBoardInSpace(page, space.slug, 'Sprint 20');
	await page.getByTestId('analyze-button').click();
	await expect(page.getByTestId('analyze-status')).toContainText('Limit reached: 3 analyses a day');
	await expect(page).not.toHaveTitle(/^Space analysis for/);
});

test('AI failure shows an error and creates no board', async ({ page }) => {
	const space = await seedSpace(page, 'Unlucky team');
	await setMock(page, 'error');
	await page.goto(`/spaces/${space.slug}`);
	await page.getByTestId('analyze-button').click();
	await expect(page.getByTestId('analyze-status')).toContainText('The AI service returned an error');
	await expect(page.getByTestId('space-tile')).toHaveCount(2);
});

test('an empty space explains there is nothing to analyse', async ({ page }) => {
	const space = await createSpace(page, 'Empty team');
	await page.goto(`/spaces/${space.slug}`);
	await page.getByTestId('analyze-button').click();
	await expect(page.getByTestId('analyze-status')).toContainText('Nothing to analyse yet');
});

test('the space creator has creator rights on the analysis board', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const ctxB = await browser.newContext();
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const space = await seedSpace(pageA, 'Admin team');
	// B становится создателем пространства по admin-ссылке, а анализ запускает A
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
```

- [ ] **Step 5: Прогнать e2e и увидеть, что новая спека проходит вместе со старыми**

```bash
lsof -ti tcp:4777 | xargs -r kill; lsof -ti tcp:4778 | xargs -r kill
npm run build && npx playwright test
```

Expected: все тесты зелёные (21 старых + 7 новых). Если падает `createBoardInSpace` на имени кнопки «New board» — проверить, что заголовок кнопки в `Header.svelte` (`space.boards.create`) в en.json равен «New board», и что модалка имеет `role="dialog"`.

Если падает проверка `toHaveClass(/ai-frame/)` у плитки — убедиться, что Tailwind не вырезал класс (он задан через `@utility`, поэтому попадает в бандл при использовании в разметке).

- [ ] **Step 6: Полный набор проверок**

```bash
npm run check && npm test && npx playwright test
```

Expected: всё зелёное.

- [ ] **Step 7: Коммит**

```bash
git add e2e/mock-deepseek.mjs playwright.config.ts e2e/helpers.ts e2e/space-rename.spec.ts e2e/analysis.spec.ts
git commit -m "Анализ пространства: e2e с моком DeepSeek

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Финальная проверка и пуш

- [ ] **Step 1: Вся проверка ещё раз с чистого билда**

```bash
npm run check && npm test && npm run build && npx playwright test
```

- [ ] **Step 2: Просмотреть итоговый diff глазами**

`git log --oneline main@{upstream}..HEAD` — 12 коммитов фичи. `git diff main@{upstream}..HEAD --stat`. Убедиться, что `.env` не попал: `git diff main@{upstream}..HEAD --name-only | grep -c '^\.env$'` → 0.

- [ ] **Step 3: Пуш**

```bash
git push
```

После деплоя на проде добавить в `.env` сервера `DEEPSEEK_API_KEY` и перезапустить контейнер — без этого кнопка не появится. Напомнить пользователю перевыпустить ключ, засвеченный в чате.
