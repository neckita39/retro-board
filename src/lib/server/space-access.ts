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

/**
 * Минимальная длина пароля пространства. Пароль закрывает не только витрину
 * со списком досок, но и каждую доску внутри, а доска до этого была защищена
 * неугадываемой ссылкой в 21 символ (~125 бит). Пароль «1» без этой проверки
 * менял бы сильную защиту на слабую, поэтому короткие пароли не принимаем.
 */
export const SPACE_PASSWORD_MIN = 6;

export type SpacePasswordError = 'empty_password' | 'short_password';

/** Годится ли пароль в качестве пароля пространства. null — годится. */
export function spacePasswordError(raw: string | null | undefined): SpacePasswordError | null {
	const password = (raw ?? '').trim();
	if (!password) return 'empty_password';
	if (password.length < SPACE_PASSWORD_MIN) return 'short_password';
	return null;
}

/** Алфавит nanoid по умолчанию; слаг доски — ровно 21 такой символ */
const BOARD_SLUG = /^[A-Za-z0-9_-]{21}$/;

/**
 * Куда вернуть посетителя после ввода пароля. Доска внутри закрытого пространства
 * уводит на форму пароля с ?next={слаг}, и это значение приходит из адресной строки,
 * то есть от кого угодно. Пускаем строго слаг доски и никогда — произвольный путь:
 * иначе форма пароля превращается в открытый редирект на чужой сайт.
 */
export function safeNextBoardSlug(raw: string | null | undefined): string | null {
	const next = (raw ?? '').trim();
	return BOARD_SLUG.test(next) ? next : null;
}

/**
 * Выдать cookie доступа к пространству. Одно место на все маршруты: пароль
 * принимает и страница пространства, и доска внутри него.
 */
export function grantSpaceAccess(
	space: { slug: string; accessToken: string },
	cookies: Cookies
): void {
	cookies.set(`retro_space_${space.slug}`, space.accessToken, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365
	});
}
