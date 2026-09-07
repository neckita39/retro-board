import { SITE, INDEXABLE_PATHS } from '$lib/seo.js';
import type { RequestHandler } from './$types.js';

// Карта сайта строится из того же списка, что и allow-лист noindex в server.js,
// — раньше «только главная» было записано в трёх местах порознь и разъезжалось.
// Главная получает приоритет выше: с неё начинается любой сценарий.
export const GET: RequestHandler = async () => {
	const urls = INDEXABLE_PATHS.map((path) => {
		const priority = path === '/' ? '1.0' : '0.8';
		const changefreq = path === '/' ? 'weekly' : 'monthly';
		return `	<url>
		<loc>${SITE}${path}</loc>
		<changefreq>${changefreq}</changefreq>
		<priority>${priority}</priority>
	</url>`;
	}).join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
