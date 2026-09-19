import { error } from '@sveltejs/kit';
import { loadBoardExport, toMarkdown, exportRateLimiter } from '$lib/server/export.js';
import { guardBoardByCookies } from '$lib/server/board-access.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params, url, cookies, getClientAddress }) => {
	// Лимитера тут не было, в отличие от соседнего /api/v1/boards/*
	if (!exportRateLimiter.check(getClientAddress())) {
		throw error(429, 'Too many requests');
	}
	// Доска внутри пространства с паролем — только с cookie доступа
	await guardBoardByCookies(params.slug, cookies);

	const format = url.searchParams.get('format') || 'json';
	const lang = url.searchParams.get('lang') === 'ru' ? 'ru' : 'en';

	const data = await loadBoardExport(params.slug, url.origin);
	if (!data) {
		throw error(404, 'Board not found');
	}

	const safeTitle = data.board.title.replace(/[^a-zA-Z0-9_-]/g, '_');

	if (format === 'md') {
		return new Response(toMarkdown(data, lang), {
			headers: {
				'Content-Type': 'text/markdown; charset=utf-8',
				'Content-Disposition': `attachment; filename="board-${safeTitle}.md"`
			}
		});
	}

	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="board-${safeTitle}.json"`
		}
	});
};
