export type ColumnType = 'went_well' | 'didnt_go_well' | 'improve';
export type VoteType = 'like' | 'dislike';

export interface Board {
	id: string;
	slug: string;
	title: string;
	createdAt: string;
}

export interface Card {
	id: string;
	boardId: string;
	columnType: ColumnType;
	content: string;
	authorName: string | null;
	createdAt: string;
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
