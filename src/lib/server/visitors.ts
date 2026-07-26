// Откуда пришёл посетитель. Считаем визиты, а не запросы: перезагрузка страницы
// не должна выглядеть как ещё один пришедший человек.

export type VisitSource =
	| 'google'
	| 'yandex'
	| 'search_other'
	| 'social'
	| 'direct'
	| 'internal'
	| 'other';

/** Домен точно совпадает или является поддоменом — «notgoogle.com» не пройдёт. */
function hostMatches(host: string, domain: string): boolean {
	return host === domain || host.endsWith(`.${domain}`);
}

function hostMatchesAny(host: string, domains: string[]): boolean {
	return domains.some((d) => hostMatches(host, d));
}

// google.ru, google.co.uk и прочие региональные зоны
const GOOGLE = /^(.+\.)?google(\.[a-z]{2,3}){1,2}$/;
const YANDEX = ['yandex.ru', 'yandex.com', 'yandex.by', 'yandex.kz', 'ya.ru'];
const SEARCH_OTHER = ['bing.com', 'duckduckgo.com', 'mail.ru', 'rambler.ru', 'search.marchmail.ru', 'ecosia.org'];
const SOCIAL = ['t.me', 'telegram.org', 'telegram.me', 'vk.com', 'slack.com', 'discord.com', 'x.com', 'twitter.com', 'linkedin.com', 'facebook.com'];

export function classifySource(referer: string | null, selfHost: string): VisitSource {
	if (!referer) return 'direct';

	let host: string;
	try {
		host = new URL(referer).host.toLowerCase();
	} catch {
		return 'other';
	}

	if (hostMatches(host, selfHost.toLowerCase())) return 'internal';
	if (GOOGLE.test(host)) return 'google';
	if (hostMatchesAny(host, YANDEX)) return 'yandex';
	if (hostMatchesAny(host, SEARCH_OTHER)) return 'search_other';
	if (hostMatchesAny(host, SOCIAL)) return 'social';
	return 'other';
}

const BOT_MARKERS = [
	'bot', 'crawler', 'spider', 'slurp', 'curl', 'wget', 'python-requests',
	'httpclient', 'headlesschrome', 'lighthouse', 'monitoring', 'pingdom',
	'uptime', 'facebookexternalhit', 'preview', 'scraper', 'go-http-client'
];

export function isBot(userAgent: string | null): boolean {
	// Пустой User-Agent живой браузер не присылает
	if (!userAgent) return true;
	const ua = userAgent.toLowerCase();
	return BOT_MARKERS.some((m) => ua.includes(m));
}

const SKIP_PREFIXES = ['/api/', '/_app/'];
const SKIP_EXACT = ['/health', '/ready', '/metrics', '/sitemap.xml', '/robots.txt', '/favicon.svg'];

/** Считаем только настоящие открытия страниц — не запросы данных и не ассеты. */
export function isCountablePage(pathname: string, accept: string | null): boolean {
	if (!accept?.includes('text/html')) return false;
	if (SKIP_EXACT.includes(pathname)) return false;
	if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return false;
	return true;
}
