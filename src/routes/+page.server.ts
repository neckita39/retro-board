import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { boards, spaces } from '$lib/server/db/schema.js';
import { metric } from '$lib/server/statsd.js';
import { hashPassword } from '$lib/server/password.js';
import { nanoid } from 'nanoid';
import type { Actions } from './$types.js';

export const actions: Actions = {
	createBoard: async ({ request, cookies }) => {
		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim().slice(0, 100) || 'Ретро';

		const slug = nanoid(21);
		const creatorToken = nanoid(32);

		await db.insert(boards).values({ title, slug, creatorToken });

		cookies.set(`retro_creator_${slug}`, creatorToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});

		metric('retro.board.created', 1);

		throw redirect(303, `/${slug}?admin=${creatorToken}`);
	},

	createSpace: async ({ request, cookies }) => {
		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim().slice(0, 100);
		const password = (formData.get('password') as string)?.slice(0, 100);

		if (!name || !password) {
			return { error: 'Name and password are required' };
		}

		const slug = nanoid(21);
		const creatorToken = nanoid(32);
		const passwordHash = await hashPassword(password);

		await db.insert(spaces).values({ name, slug, creatorToken, passwordHash });

		cookies.set(`retro_space_creator_${slug}`, creatorToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});

		cookies.set(`retro_space_${slug}`, 'ok', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});

		throw redirect(303, `/spaces/${slug}?admin=${creatorToken}`);
	}
};
