import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { spaces } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const space = await db.query.spaces.findFirst({
		where: eq(spaces.slug, params.slug)
	});

	if (!space) throw error(404, 'Space not found');

	const token = cookies.get(`retro_space_creator_${params.slug}`) ?? '';
	if (!space.creatorToken || token !== space.creatorToken) {
		throw error(403, 'Forbidden');
	}

	await db.delete(spaces).where(eq(spaces.id, space.id));

	return json({ ok: true });
};
