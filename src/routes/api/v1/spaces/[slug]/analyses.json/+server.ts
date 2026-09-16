import { loadSpaceAnalyses, spaceForApi } from '$lib/server/space-export.js';
import { metric } from '$lib/server/statsd.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params, request, url, getClientAddress }) => {
	const space = await spaceForApi({ slug: params.slug, request, url, ip: getClientAddress() });
	const data = await loadSpaceAnalyses(space, url.origin);
	metric('retro.export.api', 1);
	return new Response(JSON.stringify(data, null, 2), {
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
	});
};
