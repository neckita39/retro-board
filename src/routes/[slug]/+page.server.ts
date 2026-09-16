import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db/index.js';
import { boards, cards, votes, comments, spaces, images, spaceAnalyses } from '$lib/server/db/schema.js';
import { eq, inArray, desc } from 'drizzle-orm';
import { statePayload } from '$lib/server/analysis.js';
import type { AnalysisState } from '$lib/analysis-state.js';
import { canViewSpace } from '$lib/server/space-access.js';
import { decrypt } from '$lib/server/crypto.js';
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

	// Image dimensions for stable layout — same shape the socket board:state delivers
	const imageIds = [
		...new Set(
			[...boardCards, ...boardComments].map((c) => c.imageId).filter((id): id is string => !!id)
		)
	];
	let imageMeta: Record<string, { width: number; height: number }> = {};
	if (imageIds.length > 0) {
		const rows = await db
			.select({ id: images.id, width: images.width, height: images.height })
			.from(images)
			.where(inArray(images.id, imageIds));
		imageMeta = Object.fromEntries(rows.map((r) => [r.id, { width: r.width, height: r.height }]));
	}

	// Родительское пространство и его админ: создатель пространства управляет
	// всеми его досками (переименовать, удалить, вести обсуждение), включая доску-анализ
	let space: { slug: string; name: string } | null = null;
	let spaceCreator = false;
	let analysis: AnalysisState | null = null;
	// Кнопка анализа и его статус — только тем, кто имеет доступ к пространству:
	// доска открыта по ссылке всем, а пароль пространства защищает именно его содержимое
	let spaceViewable = false;
	if (board.spaceId) {
		const s = await db.query.spaces.findFirst({
			where: eq(spaces.id, board.spaceId)
		});
		if (s) {
			space = { slug: s.slug, name: s.name };
			const spaceCookie = cookies.get(`retro_space_creator_${s.slug}`) ?? '';
			spaceCreator = !!s.creatorToken && spaceCookie === s.creatorToken;
			spaceViewable = canViewSpace(s, cookies);
			if (spaceViewable) {
				// Статус AI-анализа пространства: уведомления должны приходить и на досках
				const rows = await db
					.select()
					.from(spaceAnalyses)
					.where(eq(spaceAnalyses.spaceId, s.id))
					.orderBy(desc(spaceAnalyses.createdAt));
				analysis = statePayload(rows, new Date());
			}
		}
	}

	const adminParam = url.searchParams.get('admin') ?? '';
	const cookieToken = cookies.get(`retro_creator_${params.slug}`) ?? '';

	let isCreator = spaceCreator;
	let showCreatedToast = false;

	if (adminParam && adminParam === board.creatorToken) {
		cookies.set(`retro_creator_${params.slug}`, adminParam, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
		isCreator = true;
		showCreatedToast = true;
	} else if (cookieToken && cookieToken === board.creatorToken) {
		isCreator = true;
	}

	const adminLink = isCreator ? `${url.origin}/${params.slug}?admin=${board.creatorToken}` : null;

	return {
		board: {
			id: board.id,
			slug: board.slug,
			title: board.title,
			format: board.format,
			createdAt: board.createdAt.toISOString()
		},
		space,
		spaceName: space?.name ?? null,
		spaceSlug: space?.slug ?? null,
		isCreator,
		showCreatedToast,
		adminLink,
		analysisEnabled: spaceViewable && !!env.DEEPSEEK_API_KEY,
		analysis,
		creatorToken: isCreator ? board.creatorToken : null,
		cards: boardCards.map((c) => ({
			...c,
			content: decrypt(c.content) ?? c.content,
			authorName: decrypt(c.authorName),
			imageWidth: c.imageId ? (imageMeta[c.imageId]?.width ?? null) : null,
			imageHeight: c.imageId ? (imageMeta[c.imageId]?.height ?? null) : null,
			createdAt: c.createdAt.toISOString()
		})),
		votes: boardVotes.map((v) => ({
			...v,
			createdAt: v.createdAt.toISOString()
		})),
		comments: boardComments.map((c) => ({
			...c,
			content: decrypt(c.content) ?? c.content,
			authorName: decrypt(c.authorName),
			imageWidth: c.imageId ? (imageMeta[c.imageId]?.width ?? null) : null,
			imageHeight: c.imageId ? (imageMeta[c.imageId]?.height ?? null) : null,
			createdAt: c.createdAt.toISOString()
		}))
	};
};
