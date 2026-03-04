import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { boards, cards, votes, comments } from '$lib/server/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params, cookies, url }) => {
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

	const adminParam = url.searchParams.get('admin') ?? '';
	const cookieToken = cookies.get(`retro_creator_${params.slug}`) ?? '';

	let isCreator = false;
	let showAdminBanner = false;

	if (adminParam && adminParam === board.creatorToken) {
		cookies.set(`retro_creator_${params.slug}`, adminParam, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
		isCreator = true;
		showAdminBanner = true;
	} else if (cookieToken && cookieToken === board.creatorToken) {
		isCreator = true;
	}

	const adminLink = isCreator ? `${url.origin}/${params.slug}?admin=${board.creatorToken}` : null;

	return {
		board: {
			id: board.id,
			slug: board.slug,
			title: board.title,
			createdAt: board.createdAt.toISOString()
		},
		isCreator,
		showAdminBanner,
		adminLink,
		creatorToken: isCreator ? board.creatorToken : null,
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
