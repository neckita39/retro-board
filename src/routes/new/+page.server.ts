import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { boards, spaces } from '$lib/server/db/schema.js';
import { metric } from '$lib/server/statsd.js';
import { hashPassword } from '$lib/server/password.js';
import { spacePasswordError } from '$lib/server/space-access.js';
import { nanoid } from 'nanoid';
import { isValidFormat, DEFAULT_FORMAT } from '$lib/formats.js';
import type { PageServerLoad, Actions } from './$types.js';

export const load: PageServerLoad = async ({ url }) => {
	const type = url.searchParams.get('type');
	const requested = url.searchParams.get('format');
	return {
		type: type === 'space' ? 'space' : 'board',
		// Ссылка со страницы формата предвыбирает его; мусор в параметре игнорируем
		format: isValidFormat(requested) ? requested : null
	};
};

export const actions: Actions = {
	createBoard: async ({ request, cookies }) => {
		const formData = await request.formData();
		const locale = formData.get('locale') === 'ru' ? 'ru' : 'en';
		const title = (formData.get('title') as string)?.trim().slice(0, 100) || (locale === 'ru' ? 'Ретро' : 'Retro');

		const requested = formData.get('format');
		const format = isValidFormat(requested) ? (requested as string) : DEFAULT_FORMAT;

		const slug = nanoid(21);
		const creatorToken = nanoid(32);

		await db.insert(boards).values({ title, slug, creatorToken, format });

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
		const name = (formData.get('name') as string)?.trim();
		const password = (formData.get('password') as string)?.trim() || null;

		if (!name) return fail(400, { spaceError: 'name_required' });
		// Пароль необязателен, но если его задают — он закрывает и доски пространства,
		// поэтому к нему та же планка, что и в enablePassword
		const policyError = password ? spacePasswordError(password) : null;
		if (policyError) return fail(400, { spaceError: policyError });

		const slug = nanoid(21);
		const creatorToken = nanoid(32);
		// Токен cookie доступа генерируем сами, а не берём DEFAULT колонки: значение нужно
		// сразу для cookie, и вставка не зависит от того, есть ли у колонки default
		const accessToken = nanoid(32);
		const passwordHash = password ? await hashPassword(password) : null;

		await db.insert(spaces).values({ name, slug, passwordHash, creatorToken, accessToken });

		if (passwordHash) {
			cookies.set(`retro_space_${slug}`, accessToken, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 365
			});
		}
		cookies.set(`retro_space_creator_${slug}`, creatorToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});

		metric('retro.space.created', 1);

		throw redirect(303, `/spaces/${slug}?admin=${creatorToken}`);
	}
};
