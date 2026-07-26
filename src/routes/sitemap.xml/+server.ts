import type { RequestHandler } from './$types.js';

const SITE = 'https://retrospectrix.ru';

// В индексе только главная: доски и пространства приватны, служебные страницы
// поисковой выдаче не нужны.
export const GET: RequestHandler = async () => {
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url>
		<loc>${SITE}/</loc>
		<changefreq>weekly</changefreq>
		<priority>1.0</priority>
	</url>
</urlset>
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
