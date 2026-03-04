import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { boards } from '$lib/server/db/schema.js';
import { metric } from '$lib/server/statsd.js';
import { nanoid } from 'nanoid';
import type { Actions } from './$types.js';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim() || 'Ретро';

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
	}
};
