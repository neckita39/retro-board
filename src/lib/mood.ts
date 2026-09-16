// Полоса настроения на плитке пространства: сколько карточек в каждом тоне.
// Сервер считает карточки по (доска, колонка), а тон колонке даёт формат доски —
// поэтому полоса одинаково работает для classic, любых пресетов и доски-анализа.
import { findBoardFormat, type Tone } from './formats.js';

export type MoodCounts = Record<Tone, number>;

export interface ColumnCount {
	columnType: string;
	count: number;
}

/**
 * Карточка в колонке, которой нет в формате, в полосу не попадает: такое
 * бывает только у мусора в базе, и красить его не во что.
 */
export function moodCounts(format: string | null | undefined, rows: ColumnCount[]): MoodCounts {
	const columns = findBoardFormat(format).columns;
	const result: MoodCounts = { well: 0, bad: 0, improve: 0, plum: 0 };
	for (const row of rows) {
		const tone = columns.find((c) => c.id === row.columnType)?.tone;
		if (tone) result[tone] += row.count;
	}
	return result;
}
