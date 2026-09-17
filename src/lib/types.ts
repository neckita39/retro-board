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

export interface Card {
	id: string;
	boardId: string;
	columnType: ColumnType;
	content: string;
	authorName: string | null;
	imageId: string | null;
	imageWidth: number | null;
	imageHeight: number | null;
	/** Задача Битрикс24, созданная из карточки; null — задачи нет */
	bitrixTaskId: number | null;
	bitrixTaskUrl: string | null;
	createdAt: string;
}

/** Задача Битрикс24 карточки: id на портале и готовая ссылка на неё */
export interface CardTask {
	id: number;
	url: string;
}

/** Подключение Битрикс24 пространства для преформы на доске — без секрета вебхука */
export interface BitrixInfo {
	spaceSlug: string;
	portal: string;
	userName: string;
	groupId: number | null;
	groupName: string | null;
}

export interface Vote {
	id: string;
	cardId: string;
	type: VoteType;
	sessionId: string;
	createdAt: string;
}

export interface Comment {
	id: string;
	cardId: string;
	content: string;
	authorName: string | null;
	imageId: string | null;
	imageWidth: number | null;
	imageHeight: number | null;
	createdAt: string;
}

export interface BoardState {
	board: Board;
	cards: Card[];
	votes: Vote[];
	comments: Comment[];
}

export const COLUMN_CONFIG: Record<ColumnType, { emoji: string }> = {
	went_well: { emoji: '+' },
	didnt_go_well: { emoji: '-' },
	improve: { emoji: '!' }
};
