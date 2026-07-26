import type { Board, Card, Vote, Comment, BoardState } from '$lib/types.js';

class BoardStore {
	board = $state<Board | null>(null);
	cards = $state<Card[]>([]);
	votes = $state<Vote[]>([]);
	comments = $state<Comment[]>([]);
	isCreator = $state(false);

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

	getColumnCards(columnType: string, sortBy: 'newest' | 'votes' = 'newest') {
		const filtered = this.cards.filter((c) => c.columnType === columnType);
		if (sortBy === 'votes') {
			return filtered.sort(
				(a, b) =>
					this.getCardScore(b.id) - this.getCardScore(a.id) ||
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);
		}
		return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	}

	getCardLikes(cardId: string): number {
		return this.votes.filter((v) => v.cardId === cardId && v.type === 'like').length;
	}

	getCardDislikes(cardId: string): number {
		return this.votes.filter((v) => v.cardId === cardId && v.type === 'dislike').length;
	}

	/** Вес карточки: дизлайк гасит лайк, иначе возражения ни на что не влияют. */
	getCardScore(cardId: string): number {
		let score = 0;
		for (const v of this.votes) {
			if (v.cardId !== cardId) continue;
			if (v.type === 'like') score++;
			else if (v.type === 'dislike') score--;
		}
		return score;
	}

	getSummaryCards() {
		const order: string[] = ['went_well', 'didnt_go_well', 'improve'];
		return [...this.cards]
			.sort((a, b) => {
				const colDiff = order.indexOf(a.columnType) - order.indexOf(b.columnType);
				if (colDiff !== 0) return colDiff;
				return this.getCardScore(b.id) - this.getCardScore(a.id);
			});
	}
}

export const boardStore = new BoardStore();
