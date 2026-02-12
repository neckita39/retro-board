import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { boards, cards, votes, comments } from '$lib/server/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const board = await db.query.boards.findFirst({
		where: eq(boards.slug, params.slug)
	});

	if (!board) {
		throw error(404, 'Board not found');
	}

	const boardCards = await db.query.cards.findMany({
		where: eq(cards.boardId, board.id)
	});

	const cardIds = boardCards.map((c) => c.id);
	let boardVotes: (typeof votes.$inferSelect)[] = [];
	let boardComments: (typeof comments.$inferSelect)[] = [];

	if (cardIds.length > 0) {
		[boardVotes, boardComments] = await Promise.all([
			db.select().from(votes).where(inArray(votes.cardId, cardIds)),
			db.select().from(comments).where(inArray(comments.cardId, cardIds))
		]);
	}

	return {
		board: {
			id: board.id,
			slug: board.slug,
			title: board.title,
			createdAt: board.createdAt.toISOString()
		},
		cards: boardCards.map((c) => ({
			...c,
			createdAt: c.createdAt.toISOString()
		})),
		votes: boardVotes.map((v) => ({
			...v,
			createdAt: v.createdAt.toISOString()
		})),
		comments: boardComments.map((c) => ({
			...c,
			createdAt: c.createdAt.toISOString()
		}))
	};
};
