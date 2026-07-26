import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

import { boardStore } from './board.svelte.js';
import type { Board, Card, Vote, Comment } from '$lib/types.js';

const board: Board = {
	id: 'b1',
	slug: 'test',
	title: 'Test Board',
	createdAt: '2025-01-01T00:00:00Z'
};

function makeCard(overrides: Partial<Card> = {}): Card {
	return {
		id: 'c1',
		boardId: 'b1',
		columnType: 'went_well',
		content: 'test card',
		authorName: null,
		imageId: null,
		imageWidth: null,
		imageHeight: null,
		createdAt: '2025-01-01T00:00:00Z',
		...overrides
	};
}

function makeVote(overrides: Partial<Vote> = {}): Vote {
	return {
		id: 'v1',
		cardId: 'c1',
		type: 'like',
		sessionId: 's1',
		createdAt: '2025-01-01T00:00:00Z',
		...overrides
	};
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
	return {
		id: 'cm1',
		cardId: 'c1',
		content: 'test comment',
		authorName: null,
		imageId: null,
		imageWidth: null,
		imageHeight: null,
		createdAt: '2025-01-01T00:00:00Z',
		...overrides
	};
}

beforeEach(() => {
	boardStore.setState({ board, cards: [], votes: [], comments: [] });
	boardStore.isCreator = false;
});

describe('BoardStore', () => {
	it('setState fills all fields', () => {
		const cards = [makeCard()];
		const votes = [makeVote()];
		const comments = [makeComment()];
		boardStore.setState({ board, cards, votes, comments });

		expect(boardStore.board).toEqual(board);
		expect(boardStore.cards).toEqual(cards);
		expect(boardStore.votes).toEqual(votes);
		expect(boardStore.comments).toEqual(comments);
	});

	it('addCard appends a card', () => {
		const card = makeCard();
		boardStore.addCard(card);
		expect(boardStore.cards).toHaveLength(1);
		expect(boardStore.cards[0]).toEqual(card);
	});

	it('updateCard updates a card by id', () => {
		const card = makeCard();
		boardStore.addCard(card);
		const updated = { ...card, content: 'updated' };
		boardStore.updateCard(updated);
		expect(boardStore.cards[0].content).toBe('updated');
	});

	it('removeCard deletes the card and cascades votes and comments', () => {
		boardStore.addCard(makeCard({ id: 'c1' }));
		boardStore.setVotes('c1', [makeVote({ id: 'v1', cardId: 'c1' })]);
		boardStore.addComment(makeComment({ id: 'cm1', cardId: 'c1' }));

		boardStore.removeCard('c1');
		expect(boardStore.cards).toHaveLength(0);
		expect(boardStore.votes).toHaveLength(0);
		expect(boardStore.comments).toHaveLength(0);
	});

	it('setVotes replaces votes for a specific card', () => {
		boardStore.setVotes('c1', [makeVote({ id: 'v1', cardId: 'c1' })]);
		boardStore.setVotes('c2', [makeVote({ id: 'v2', cardId: 'c2' })]);

		const newVotes = [makeVote({ id: 'v3', cardId: 'c1' })];
		boardStore.setVotes('c1', newVotes);

		expect(boardStore.votes.filter((v) => v.cardId === 'c1')).toHaveLength(1);
		expect(boardStore.votes.find((v) => v.cardId === 'c1')!.id).toBe('v3');
		expect(boardStore.votes.filter((v) => v.cardId === 'c2')).toHaveLength(1);
	});

	it('addComment appends a comment', () => {
		const comment = makeComment();
		boardStore.addComment(comment);
		expect(boardStore.comments).toHaveLength(1);
		expect(boardStore.comments[0]).toEqual(comment);
	});

	it('getColumnCards filters by type and sorts by date desc', () => {
		boardStore.addCard(makeCard({ id: 'c1', columnType: 'went_well', createdAt: '2025-01-01T00:00:00Z' }));
		boardStore.addCard(makeCard({ id: 'c2', columnType: 'went_well', createdAt: '2025-01-03T00:00:00Z' }));
		boardStore.addCard(makeCard({ id: 'c3', columnType: 'didnt_go_well', createdAt: '2025-01-02T00:00:00Z' }));

		const result = boardStore.getColumnCards('went_well');
		expect(result).toHaveLength(2);
		expect(result[0].id).toBe('c2');
		expect(result[1].id).toBe('c1');
	});

	it('getCardLikes counts only like votes', () => {
		boardStore.setVotes('c1', [
			makeVote({ id: 'v1', cardId: 'c1', type: 'like' }),
			makeVote({ id: 'v2', cardId: 'c1', type: 'dislike' }),
			makeVote({ id: 'v3', cardId: 'c1', type: 'like' })
		]);
		expect(boardStore.getCardLikes('c1')).toBe(2);
	});

	it('getCardDislikes counts only dislike votes', () => {
		boardStore.setVotes('c1', [
			makeVote({ id: 'v1', cardId: 'c1', type: 'like' }),
			makeVote({ id: 'v2', cardId: 'c1', type: 'dislike' }),
			makeVote({ id: 'v3', cardId: 'c1', type: 'dislike' })
		]);
		expect(boardStore.getCardDislikes('c1')).toBe(2);
	});

	it('getCardScore subtracts dislikes from likes', () => {
		boardStore.setVotes('c1', [
			makeVote({ id: 'v1', cardId: 'c1', type: 'like' }),
			makeVote({ id: 'v2', cardId: 'c1', type: 'like' }),
			makeVote({ id: 'v3', cardId: 'c1', type: 'like' }),
			makeVote({ id: 'v4', cardId: 'c1', type: 'dislike' })
		]);
		expect(boardStore.getCardScore('c1')).toBe(2);
	});

	it('getCardScore goes negative when dislikes win', () => {
		boardStore.setVotes('c1', [
			makeVote({ id: 'v1', cardId: 'c1', type: 'like' }),
			makeVote({ id: 'v2', cardId: 'c1', type: 'dislike' }),
			makeVote({ id: 'v3', cardId: 'c1', type: 'dislike' })
		]);
		expect(boardStore.getCardScore('c1')).toBe(-1);
	});

	it('getCardScore ignores votes on other cards', () => {
		boardStore.setVotes('c1', [makeVote({ id: 'v1', cardId: 'c1', type: 'like' })]);
		boardStore.setVotes('c2', [makeVote({ id: 'v2', cardId: 'c2', type: 'dislike' })]);
		expect(boardStore.getCardScore('c1')).toBe(1);
	});

	it('isCreator defaults to false', () => {
		expect(boardStore.isCreator).toBe(false);
	});

	it('isCreator can be set to true', () => {
		boardStore.isCreator = true;
		expect(boardStore.isCreator).toBe(true);
	});

	it('setState does not reset isCreator', () => {
		boardStore.isCreator = true;
		boardStore.setState({ board, cards: [], votes: [], comments: [] });
		expect(boardStore.isCreator).toBe(true);
	});

	it('getSummaryCards ranks a heavily disliked card below a quieter one', () => {
		boardStore.setState({
			board,
			cards: [
				makeCard({ id: 'loud', columnType: 'went_well' }),
				makeCard({ id: 'quiet', columnType: 'went_well' })
			],
			votes: [
				// 17 лайков и 10 дизлайков => 7
				...Array.from({ length: 17 }, (_, i) =>
					makeVote({ id: `l${i}`, cardId: 'loud', type: 'like', sessionId: `s${i}` })
				),
				...Array.from({ length: 10 }, (_, i) =>
					makeVote({ id: `d${i}`, cardId: 'loud', type: 'dislike', sessionId: `d${i}` })
				),
				// 9 лайков без возражений => 9
				...Array.from({ length: 9 }, (_, i) =>
					makeVote({ id: `q${i}`, cardId: 'quiet', type: 'like', sessionId: `q${i}` })
				)
			],
			comments: []
		});

		expect(boardStore.getCardScore('loud')).toBe(7);
		expect(boardStore.getCardScore('quiet')).toBe(9);
		expect(boardStore.getSummaryCards().map((c) => c.id)).toEqual(['quiet', 'loud']);
	});

	it('getColumnCards sorted by votes puts a disliked card below an unopposed one', () => {
		boardStore.setState({
			board,
			cards: [
				makeCard({ id: 'c1', createdAt: '2025-01-02T00:00:00Z' }),
				makeCard({ id: 'c2', createdAt: '2025-01-01T00:00:00Z' })
			],
			votes: [
				makeVote({ id: 'v1', cardId: 'c1', type: 'like' }),
				makeVote({ id: 'v2', cardId: 'c1', type: 'like' }),
				makeVote({ id: 'v3', cardId: 'c1', type: 'dislike' }),
				makeVote({ id: 'v4', cardId: 'c1', type: 'dislike' }),
				makeVote({ id: 'v5', cardId: 'c2', type: 'like' })
			],
			comments: []
		});
		// c1: 2 - 2 = 0, c2: 1 - 0 = 1
		expect(boardStore.getColumnCards('went_well', 'votes').map((c) => c.id)).toEqual(['c2', 'c1']);
	});

	it('getSummaryCards sorts by column order then by likes desc', () => {
		boardStore.addCard(makeCard({ id: 'c1', columnType: 'improve' }));
		boardStore.addCard(makeCard({ id: 'c2', columnType: 'went_well' }));
		boardStore.addCard(makeCard({ id: 'c3', columnType: 'went_well' }));

		boardStore.setVotes('c2', [makeVote({ id: 'v1', cardId: 'c2', type: 'like' })]);
		boardStore.setVotes('c3', [
			makeVote({ id: 'v2', cardId: 'c3', type: 'like' }),
			makeVote({ id: 'v3', cardId: 'c3', type: 'like' })
		]);

		const result = boardStore.getSummaryCards();
		// went_well first (c3 has more likes than c2), then improve
		expect(result.map((c) => c.id)).toEqual(['c3', 'c2', 'c1']);
	});

	it('getColumnCards sorts by votes desc when sortBy=votes', () => {
		boardStore.setState({
			board,
			cards: [
				makeCard({ id: 'c1', createdAt: '2025-01-02T00:00:00Z' }),
				makeCard({ id: 'c2', createdAt: '2025-01-01T00:00:00Z' })
			],
			votes: [makeVote({ id: 'v1', cardId: 'c2' })],
			comments: []
		});
		expect(boardStore.getColumnCards('went_well', 'votes').map((c) => c.id)).toEqual(['c2', 'c1']);
	});

	it('getColumnCards falls back to newest-first among equal votes', () => {
		boardStore.setState({
			board,
			cards: [
				makeCard({ id: 'c1', createdAt: '2025-01-01T00:00:00Z' }),
				makeCard({ id: 'c2', createdAt: '2025-01-02T00:00:00Z' })
			],
			votes: [],
			comments: []
		});
		expect(boardStore.getColumnCards('went_well', 'votes').map((c) => c.id)).toEqual(['c2', 'c1']);
	});
});
