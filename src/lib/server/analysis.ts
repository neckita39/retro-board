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
