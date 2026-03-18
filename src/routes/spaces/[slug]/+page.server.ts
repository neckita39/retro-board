import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { spaces, boards, cards } from '$lib/server/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { verifyPassword } from '$lib/server/password.js';
import { metric } from '$lib/server/statsd.js';
import type { PageServerLoad, Actions } from './$types.js';

export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const space = await db.query.spaces.findFirst({
		where: eq(spaces.slug, params.slug)
	});

	if (!space) throw error(404, 'Space not found');

	const adminParam = url.searchParams.get('admin') ?? '';
	const creatorCookie = cookies.get(`retro_space_creator_${params.slug}`) ?? '';
	let isCreator = false;
	let showAdminBanner = false;

	if (adminParam && adminParam === space.creatorToken) {
		cookies.set(`retro_space_creator_${params.slug}`, adminParam, {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		cookies.set(`retro_space_${params.slug}`, 'authenticated', {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		isCreator = true;
		showAdminBanner = true;
	} else if (creatorCookie && creatorCookie === space.creatorToken) {
		isCreator = true;
	}

	const hasPassword = !!space.passwordHash;
	const accessCookie = cookies.get(`retro_space_${params.slug}`);
	if (hasPassword && !accessCookie && !isCreator) {
		return {
			space: { slug: space.slug, name: space.name },
			authenticated: false,
			isCreator: false,
			boards: [],
			showAdminBanner: false,
			adminLink: null
		};
	}

	const spaceBoards = await db
		.select({
			id: boards.id,
			slug: boards.slug,
			title: boards.title,
			createdAt: boards.createdAt,
			cardCount: sql<number>`(SELECT count(*) FROM cards WHERE cards.board_id = ${boards.id})`
		})
		.from(boards)
		.where(eq(boards.spaceId, space.id))
		.orderBy(boards.createdAt);

	const adminLink = isCreator
		? `${url.origin}/spaces/${params.slug}?admin=${space.creatorToken}`
		: null;

	return {
		space: {
			id: space.id,
			slug: space.slug,
			name: space.name,
			createdAt: space.createdAt.toISOString()
		},
		authenticated: true,
		isCreator,
		showAdminBanner,
		adminLink,
		boards: spaceBoards.map(b => ({
			...b,
			createdAt: b.createdAt.toISOString(),
			cardCount: Number(b.cardCount)
		}))
	};
};

export const actions: Actions = {
	verify: async ({ request, params, cookies }) => {
		const formData = await request.formData();
		const password = formData.get('password') as string;

		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});

		if (!space) throw error(404);

		const valid = await verifyPassword(password || '', space.passwordHash);
		if (!valid) {
			return fail(400, { error: 'wrong_password' });
		}

		cookies.set(`retro_space_${params.slug}`, 'authenticated', {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});

		throw redirect(303, `/spaces/${params.slug}`);
	},

	createBoard: async ({ request, params, cookies }) => {
		const accessCookie = cookies.get(`retro_space_${params.slug}`);
		if (!accessCookie) throw error(403, 'Not authenticated');

		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404);

		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim() || 'Ретро';

		const slug = nanoid(21);
		const creatorToken = nanoid(32);

		await db.insert(boards).values({
			title, slug, creatorToken,
			spaceId: space.id
		});

		cookies.set(`retro_creator_${slug}`, creatorToken, {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});

		metric('retro.board.created', 1);

		throw redirect(303, `/${slug}?admin=${creatorToken}`);
	}
};
