import { describe, it, expect } from 'vitest';
import {
	collectCards,
	isAnalysisBoard,
	ANALYSIS_MAX_CARDS,
	ANALYSIS_CHAR_BUDGET,
	cacheState,
	analysesInWindow,
	retryInHours,
	ANALYSIS_DAILY_LIMIT,
	effectiveRow,
	livePending,
	latestReady,
	limitRows,
	statePayload,
	PENDING_STALE_MS,
	type AnalysisRow,
	ANALYSIS_WINDOW_MS,
	buildPrompt,
	parseAnalysis,
	isEmptyAnalysis,
	analysisTitle,
	parseClientDate,
	analysisAuthor,
	cardText,
	ANALYSIS_COLUMNS,
	AnalysisFailure,
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
	it('parseClientDate — календарный день нажавшего, в пределах двух суток', () => {
		const now = new Date('2026-09-16T21:30:00Z'); // в Москве уже 17-е
		expect(analysisTitle(parseClientDate('2026-09-17', now), 'ru')).toBe('Анализ пространства за 17.09.2026');
		expect(parseClientDate('2026-09-16', now).toISOString()).toBe('2026-09-16T12:00:00.000Z');
		// Мусор, невалидная дата и слишком далёкая — серверное «сейчас»
		expect(parseClientDate(undefined, now)).toBe(now);
		expect(parseClientDate('17.09.2026', now)).toBe(now);
		expect(parseClientDate('2026-02-30', now)).toBe(now);
		expect(parseClientDate('2026-09-01', now)).toBe(now);
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
