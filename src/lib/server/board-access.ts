// Доступ к доске, которая лежит внутри пространства с паролем.
//
// Доска вне пространства и доска в пространстве без пароля защищены неугадываемой
// ссылкой — это осознанно и не меняется. Но если у пространства есть пароль, он
// обязан закрывать и его доски: иначе смена пароля ничего не отзывает, а утёкшая
// ссылка на доску остаётся действительной навсегда.
//
// Два входа — два способа доказать доступ, как и у пространства:
//   браузер — cookie retro_space_{slug} (её выдаёт форма пароля),
//   API      — заголовок X-Space-Password (query-строку не принимаем: она оседает
//              в логах прокси, в истории браузера и в реферерах).
import { error } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { boards, cards, comments, spaces } from './db/schema.js';
import { canViewSpace } from './space-access.js';
import { verifyPassword } from './password.js';

export interface BoardSpace {
	slug: string;
	name: string;
	passwordHash: string | null;
	creatorToken: string;
	accessToken: string;
}

/** Пространство доски. null — доски нет, она вне пространства или пространство исчезло. */
export async function spaceOfBoard(boardSlug: string): Promise<BoardSpace | null> {
	const [row] = await db
		.select({
			slug: spaces.slug,
			name: spaces.name,
			passwordHash: spaces.passwordHash,
			creatorToken: spaces.creatorToken,
			accessToken: spaces.accessToken
		})
		.from(boards)
		.innerJoin(spaces, eq(boards.spaceId, spaces.id))
		.where(eq(boards.slug, boardSlug))
		.limit(1);
	return row ?? null;
}

/**
 * Гейт для браузерных маршрутов. Молчит, если доска открыта по ссылке;
 * бросает 403, если пространство закрыто паролем, а cookie доступа нет.
 */
export async function guardBoardByCookies(boardSlug: string, cookies: Cookies): Promise<void> {
	const space = await spaceOfBoard(boardSlug);
	if (!space?.passwordHash) return;
	if (!canViewSpace(space, cookies)) throw error(403, 'Space password required');
}

/**
 * Гейт для API. Те же коды, что у /api/v1/spaces/*: без заголовка — 401,
 * неверный пароль — 403. Сделано одинаково нарочно: клиенту незачем помнить,
 * что доска и пространство закрываются по-разному.
 */
export async function guardBoardByHeader(boardSlug: string, request: Request): Promise<void> {
	const space = await spaceOfBoard(boardSlug);
	if (!space?.passwordHash) return;
	const password = request.headers.get('x-space-password') ?? '';
	if (!password) throw error(401, 'Password required');
	if (!(await verifyPassword(password, space.passwordHash))) throw error(403, 'Wrong password');
}

/**
 * Пространство, которому принадлежит картинка: через карточку или через комментарий.
 * null — картинку ещё никуда не прикрепили (свежая загрузка) или её доска вне
 * пространства. Ищем по image_id, индексы — drizzle/0009_image_access.sql.
 */
export async function spaceOfImage(imageId: string): Promise<BoardSpace | null> {
	const fields = {
		slug: spaces.slug,
		name: spaces.name,
		passwordHash: spaces.passwordHash,
		creatorToken: spaces.creatorToken,
		accessToken: spaces.accessToken
	};
	const [viaCard] = await db
		.select(fields)
		.from(cards)
		.innerJoin(boards, eq(cards.boardId, boards.id))
		.innerJoin(spaces, eq(boards.spaceId, spaces.id))
		.where(eq(cards.imageId, imageId))
		.limit(1);
	if (viaCard) return viaCard;
	const [viaComment] = await db
		.select(fields)
		.from(comments)
		.innerJoin(cards, eq(comments.cardId, cards.id))
		.innerJoin(boards, eq(cards.boardId, boards.id))
		.innerJoin(spaces, eq(boards.spaceId, spaces.id))
		.where(eq(comments.imageId, imageId))
		.limit(1);
	return viaComment ?? null;
}
