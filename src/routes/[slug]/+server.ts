import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { boards, spaces } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { guardBoardByCookies } from '$lib/server/board-access.js';
import type { RequestHandler } from './$types.js';

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const board = await db.query.boards.findFirst({
		where: eq(boards.slug, params.slug)
	});

	if (!board) throw error(404, 'Board not found');

	// Пароль пространства — единственный способ отозвать доступ. Создатель доски,
	// потерявший доступ к пространству, не должен сносить доску по старой cookie
	await guardBoardByCookies(params.slug, cookies);

	const token = cookies.get(`retro_creator_${params.slug}`) ?? '';
	let allowed = !!board.creatorToken && token === board.creatorToken;
	// Создатель пространства — создатель всех его досок (как и на странице доски)
	if (!allowed && board.spaceId) {
		const space = await db.query.spaces.findFirst({ where: eq(spaces.id, board.spaceId) });
		const spaceToken = space ? (cookies.get(`retro_space_creator_${space.slug}`) ?? '') : '';
		allowed = !!space?.creatorToken && spaceToken === space.creatorToken;
	}
	if (!allowed) throw error(403, 'Forbidden');

	await db.delete(boards).where(eq(boards.id, board.id));

	return json({ ok: true });
};
