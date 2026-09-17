import type { Cookies } from '@sveltejs/kit';

/**
 * Кто может смотреть пространство: пароля нет, это создатель или у посетителя
 * cookie доступа, равная access_token (её выдают verify, ?admin= и enablePassword).
 * Сравниваем значение, а не наличие: cookie с любым другим значением — подделка.
 */
export function canViewSpace(
	space: { slug: string; passwordHash: string | null; creatorToken: string; accessToken: string },
	cookies: Cookies
): boolean {
	if (!space.passwordHash) return true;
	const creatorCookie = cookies.get(`retro_space_creator_${space.slug}`) ?? '';
	if (space.creatorToken && creatorCookie === space.creatorToken) return true;
	const accessCookie = cookies.get(`retro_space_${space.slug}`) ?? '';
	// Та же строка равенства продублирована в server.js (space:join) — меняйте обе
	return !!space.accessToken && accessCookie === space.accessToken;
}
