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
