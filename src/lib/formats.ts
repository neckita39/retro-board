// Типизированный вход в реестр board-formats.js (корень репо). Здесь же —
// Tailwind-классы по тону колонки: полными строками, иначе JIT их не соберёт.
import type { Localized } from './content/localized.js';
import {
	BOARD_FORMATS as RAW_FORMATS,
	VISIBLE_FORMATS as RAW_VISIBLE,
	ANALYSIS_FORMAT,
	DEFAULT_FORMAT,
	findBoardFormat as rawFind,
	isValidFormat,
	isValidColumn
} from '../../board-formats.js';

export type Tone = 'well' | 'bad' | 'improve' | 'plum';

export interface BoardColumn {
	id: string;
	tone: Tone;
	title: Localized;
	short: Localized;
}

export interface BoardFormat {
	id: string;
	/** Скрытый формат (analysis): не в пикерах, isValidFormat его не принимает */
	hidden?: boolean;
	columns: BoardColumn[];
}

export const BOARD_FORMATS = RAW_FORMATS as BoardFormat[];
export const VISIBLE_FORMATS = RAW_VISIBLE as BoardFormat[];
export { DEFAULT_FORMAT, ANALYSIS_FORMAT, isValidFormat, isValidColumn };

export function findBoardFormat(id: string | null | undefined): BoardFormat {
	return rawFind(id) as BoardFormat;
}

export interface ToneClasses {
	border: string;
	text: string;
	badge: string;
	tab: string;
	outline: string;
	/** Сплошной цвет: полоски колонок в пикере и на плитках. Тинты на белом были невидимы */
	bar: string;
	/** Та же полоска на плитке с иллюстрацией: тон поверх лавандового холста (art-токены) */
	art: string;
}

export const TONE: Record<Tone, ToneClasses> = {
	well: {
		border: 'border-well',
		text: 'text-well',
		badge: 'bg-well-bg text-well-strong',
		tab: 'bg-well text-white',
		outline: 'outline-well bg-well-bg',
		bar: 'bg-well',
		art: 'bg-art-well'
	},
	bad: {
		border: 'border-bad',
		text: 'text-bad',
		badge: 'bg-bad-bg text-bad-strong',
		tab: 'bg-bad text-white',
		outline: 'outline-bad bg-bad-bg',
		bar: 'bg-bad',
		art: 'bg-art-bad'
	},
	improve: {
		border: 'border-improve',
		text: 'text-improve',
		badge: 'bg-improve-bg text-improve-strong',
		tab: 'bg-improve text-white',
		outline: 'outline-improve bg-improve-bg',
		bar: 'bg-improve',
		art: 'bg-art-improve'
	},
	plum: {
		border: 'border-plum',
		text: 'text-plum',
		badge: 'bg-plum-bg text-plum-strong',
		tab: 'bg-plum text-white',
		outline: 'outline-plum bg-plum-bg',
		bar: 'bg-plum',
		art: 'bg-art-plum'
	}
};
