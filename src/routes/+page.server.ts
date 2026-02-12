import { db } from '$lib/server/db/index.js';
import { boards } from '$lib/server/db/schema.js';
import { nanoid } from 'nanoid';
import type { Actions } from './$types.js';

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const title = formData.get('title') as string;

		if (!title?.trim()) {
			return { error: 'Title is required' };
		}

		const slug = nanoid(21);

		await db.insert(boards).values({
			title: title.trim(),
			slug
		});

		return { slug };
	}
};
