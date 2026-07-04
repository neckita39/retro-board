import { error } from '@sveltejs/kit';
import { loadBoardExport, toMarkdown, exportRateLimiter } from '$lib/server/export.js';
import { metric } from '$lib/server/statsd.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params, url, getClientAddress }) => {
	if (!exportRateLimiter.check(getClientAddress())) {
		throw error(429, 'Too many requests');
	}

	const lang = url.searchParams.get('lang') === 'ru' ? 'ru' : 'en';
	const data = await loadBoardExport(params.slug, url.origin);
	if (!data) {
		throw error(404, 'Board not found');
	}

	metric('retro.export.api', 1);

	return new Response(toMarkdown(data, lang), {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Cache-Control': 'no-cache'
		}
	});
};
