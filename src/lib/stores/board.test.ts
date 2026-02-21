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
		createdAt: '2025-01-01T00:00:00Z',
		...overrides
	};
}

beforeEach(() => {
	boardStore.setState({ board, cards: [], votes: [], comments: [] });
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
});
