import { loadSpaceAnalyses, spaceAnalysesToMarkdown, spaceForApi } from '$lib/server/space-export.js';
import { metric } from '$lib/server/statsd.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params, request, url, getClientAddress }) => {
	const space = await spaceForApi({ slug: params.slug, request, url, ip: getClientAddress() });
	const lang = url.searchParams.get('lang') === 'ru' ? 'ru' : 'en';
	const data = await loadSpaceAnalyses(space, url.origin);
	metric('retro.export.api', 1);
	return new Response(spaceAnalysesToMarkdown(data, lang), {
		headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-cache' }
	});
};
