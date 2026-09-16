// Анализ пространства: чистая логика без БД и сети. Что отдать модели,
// актуален ли кеш, не исчерпан ли лимит, как разобрать ответ и во что его
// превратить. Всё, что ходит наружу, живёт в deepseek.ts и в action.
import { findBoardFormat, ANALYSIS_FORMAT, type Tone } from '$lib/formats.js';
import { PENDING_STALE_MS, type AnalysisState } from '$lib/analysis-state.js';

export { PENDING_STALE_MS };

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
				tone: columns.find((col) => col.id === c.columnType)?.tone ?? 'plum',
				boardTitle: b.title,
				boardDate,
				score: score.get(c.id) ?? 0
			});
		}
	}
	return entries;
}

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
		'Each card has a tone: well = went well, bad = went badly, improve = something to improve, plum = other.',
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

/**
 * Дата для названия — календарный день того, кто нажал: вечером в Москве
 * по UTC ещё «вчера». Принимаем YYYY-MM-DD не дальше двух суток от серверного
 * «сейчас», иначе берём серверную дату. Возвращает полдень UTC этого дня.
 */
export function parseClientDate(input: unknown, now: Date): Date {
	if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return now;
	const date = new Date(`${input}T12:00:00Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) return now;
	if (Math.abs(date.getTime() - now.getTime()) > 2 * 24 * 60 * 60 * 1000) return now;
	return date;
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

// --- Состояние анализа: строки space_analyses и что из них следует ---

export interface AnalysisRow {
	id: string;
	state: 'pending' | 'ready' | 'failed';
	error: string | null;
	title: string;
	boardSlug: string;
	boardId: string | null;
	createdAt: Date;
}

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
