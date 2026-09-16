import type { Cookies } from '@sveltejs/kit';

/** Кто может смотреть пространство: пароля нет, пароль введён или это создатель */
export function canViewSpace(
	space: { slug: string; passwordHash: string | null; creatorToken: string },
	cookies: Cookies
): boolean {
	const creatorCookie = cookies.get(`retro_space_creator_${space.slug}`) ?? '';
	const isCreator = !!space.creatorToken && creatorCookie === space.creatorToken;
	if (!space.passwordHash) return true;
	return isCreator || !!cookies.get(`retro_space_${space.slug}`);
}
