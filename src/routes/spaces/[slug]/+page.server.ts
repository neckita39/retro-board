import { redirect, error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { spaces, boards, cards } from '$lib/server/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { verifyPassword } from '$lib/server/password.js';
import { nanoid } from 'nanoid';
import { metric } from '$lib/server/statsd.js';
import type { PageServerLoad, Actions } from './$types.js';

export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const space = await db.query.spaces.findFirst({
		where: eq(spaces.slug, params.slug)
	});

	if (!space) throw error(404, 'Space not found');

	// Check admin token
	const adminParam = url.searchParams.get('admin') ?? '';
	const cookieCreator = cookies.get(`retro_space_creator_${params.slug}`) ?? '';

	let isCreator = false;
	let showAdminBanner = false;

	if (adminParam && adminParam === space.creatorToken) {
		cookies.set(`retro_space_creator_${params.slug}`, adminParam, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
		isCreator = true;
		showAdminBanner = true;
	} else if (cookieCreator && cookieCreator === space.creatorToken) {
		isCreator = true;
	}

	const adminLink = isCreator ? `${url.origin}/spaces/${params.slug}?admin=${space.creatorToken}` : null;

	// Check access cookie
	const accessCookie = cookies.get(`retro_space_${params.slug}`);
	const hasAccess = !!accessCookie || isCreator;

	if (!hasAccess) {
		return {
			space: { slug: space.slug, name: space.name },
			hasAccess: false,
			isCreator,
			showAdminBanner,
			adminLink,
			boards: [],
			passwordError: ''
		};
	}

	// Load boards with per-column card counts
	const spaceBoards = await db
		.select({
			slug: boards.slug,
			title: boards.title,
			createdAt: boards.createdAt,
			cardCount: sql<number>`(SELECT count(*) FROM cards WHERE cards.board_id = boards.id)`,
			wellCount: sql<number>`(SELECT count(*) FROM cards WHERE cards.board_id = boards.id AND cards.column_type = 'went_well')`,
			badCount: sql<number>`(SELECT count(*) FROM cards WHERE cards.board_id = boards.id AND cards.column_type = 'didnt_go_well')`,
			improveCount: sql<number>`(SELECT count(*) FROM cards WHERE cards.board_id = boards.id AND cards.column_type = 'improve')`
		})
		.from(boards)
		.where(eq(boards.spaceId, space.id))
		.orderBy(boards.createdAt);

	return {
		space: { slug: space.slug, name: space.name },
		hasAccess: true,
		isCreator,
		showAdminBanner,
		adminLink,
		boards: spaceBoards.map((b) => ({
			...b,
			cardCount: Number(b.cardCount),
			wellCount: Number(b.wellCount),
			badCount: Number(b.badCount),
			improveCount: Number(b.improveCount),
			createdAt: b.createdAt.toISOString()
		})),
		passwordError: ''
	};
};

export const actions: Actions = {
	verify: async ({ request, params, cookies }) => {
		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404, 'Space not found');

		const formData = await request.formData();
		const password = formData.get('password') as string;

		if (!password || !(await verifyPassword(password, space.passwordHash))) {
			return fail(400, { passwordError: 'space.password.error' });
		}

		cookies.set(`retro_space_${params.slug}`, 'ok', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});

		return { success: true };
	},

	createBoard: async ({ request, params, cookies }) => {
		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404, 'Space not found');

		// Verify access
		const accessCookie = cookies.get(`retro_space_${params.slug}`);
		const creatorCookie = cookies.get(`retro_space_creator_${params.slug}`);
		if (!accessCookie && !(creatorCookie && creatorCookie === space.creatorToken)) {
			throw error(403, 'Forbidden');
		}

		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim().slice(0, 100) || 'Ретро';

		const slug = nanoid(21);
		const creatorToken = nanoid(32);

		await db.insert(boards).values({ title, slug, creatorToken, spaceId: space.id });

		cookies.set(`retro_creator_${slug}`, creatorToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});

		metric('retro.board.created', 1);

		throw redirect(303, `/${slug}?admin=${creatorToken}`);
	}
};
