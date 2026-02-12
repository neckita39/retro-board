import type { Board, Card, Vote, Comment, BoardState } from '$lib/types.js';

class BoardStore {
	board = $state<Board | null>(null);
	cards = $state<Card[]>([]);
	votes = $state<Vote[]>([]);
	comments = $state<Comment[]>([]);

	setState(data: BoardState) {
		this.board = data.board;
		this.cards = data.cards;
		this.votes = data.votes;
		this.comments = data.comments;
	}

	addCard(card: Card) {
		this.cards = [...this.cards, card];
	}

	updateCard(updated: Card) {
		this.cards = this.cards.map((c) => (c.id === updated.id ? updated : c));
	}

	removeCard(cardId: string) {
		this.cards = this.cards.filter((c) => c.id !== cardId);
		this.votes = this.votes.filter((v) => v.cardId !== cardId);
		this.comments = this.comments.filter((c) => c.cardId !== cardId);
	}

	setVotes(cardId: string, cardVotes: Vote[]) {
		this.votes = [...this.votes.filter((v) => v.cardId !== cardId), ...cardVotes];
	}

	addComment(comment: Comment) {
		this.comments = [...this.comments, comment];
	}

	getCardVotes(cardId: string) {
		return this.votes.filter((v) => v.cardId === cardId);
	}

	getCardComments(cardId: string) {
		return this.comments.filter((c) => c.cardId === cardId);
	}

	getColumnCards(columnType: string) {
		return this.cards
			.filter((c) => c.columnType === columnType)
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	}

	getCardLikes(cardId: string): number {
		return this.votes.filter((v) => v.cardId === cardId && v.type === 'like').length;
	}

	getSummaryCards() {
		const order: string[] = ['went_well', 'didnt_go_well', 'improve'];
		return [...this.cards]
			.sort((a, b) => {
				const colDiff = order.indexOf(a.columnType) - order.indexOf(b.columnType);
				if (colDiff !== 0) return colDiff;
				return this.getCardLikes(b.id) - this.getCardLikes(a.id);
			});
	}
}

export const boardStore = new BoardStore();
