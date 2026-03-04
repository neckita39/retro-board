import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { boards } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const board = await db.query.boards.findFirst({
		where: eq(boards.slug, params.slug)
	});

	if (!board) throw error(404, 'Board not found');

	const token = cookies.get(`retro_creator_${params.slug}`) ?? '';
	if (!board.creatorToken || token !== board.creatorToken) {
		throw error(403, 'Forbidden');
	}

	await db.delete(boards).where(eq(boards.id, board.id));

	return json({ ok: true });
};
