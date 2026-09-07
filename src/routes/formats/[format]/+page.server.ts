import { error } from '@sveltejs/kit';
import { findFormat } from '$lib/content/formats.js';
import type { PageServerLoad } from './$types.js';

// Неизвестный слаг должен отдавать 404, а не пустую страницу: иначе поисковик
// проиндексирует бесконечное число мусорных адресов вида /formats/что-угодно.
export const load: PageServerLoad = async ({ params }) => {
	const format = findFormat(params.format);
	if (!format) throw error(404, 'Format not found');
	return { slug: format.slug };
};
