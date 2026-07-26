import { describe, it, expect } from 'vitest';
import { classifySource, isBot, isCountablePage } from './visitors.js';

const HOST = 'retrospectrix.ru';

describe('classifySource', () => {
	it('recognises Google in all its regional flavours', () => {
		expect(classifySource('https://www.google.com/', HOST)).toBe('google');
		expect(classifySource('https://www.google.ru/search?q=ретро', HOST)).toBe('google');
		expect(classifySource('https://google.co.uk/', HOST)).toBe('google');
	});

	it('recognises Yandex', () => {
		expect(classifySource('https://yandex.ru/search/?text=ретро', HOST)).toBe('yandex');
		expect(classifySource('https://ya.ru/', HOST)).toBe('yandex');
		expect(classifySource('https://yandex.com/', HOST)).toBe('yandex');
	});

	it('recognises other search engines', () => {
		expect(classifySource('https://www.bing.com/search?q=x', HOST)).toBe('search_other');
		expect(classifySource('https://duckduckgo.com/', HOST)).toBe('search_other');
		expect(classifySource('https://mail.ru/', HOST)).toBe('search_other');
	});

	it('recognises messengers and social networks', () => {
		expect(classifySource('https://t.me/somechannel', HOST)).toBe('social');
		expect(classifySource('https://web.telegram.org/', HOST)).toBe('social');
		expect(classifySource('https://vk.com/wall-1_1', HOST)).toBe('social');
		expect(classifySource('https://app.slack.com/client/T1/C1', HOST)).toBe('social');
	});

	it('treats a missing referrer as direct', () => {
		expect(classifySource(null, HOST)).toBe('direct');
		expect(classifySource('', HOST)).toBe('direct');
	});

	it('treats our own pages as internal', () => {
		expect(classifySource('https://retrospectrix.ru/somebooardslug', HOST)).toBe('internal');
		expect(classifySource('http://localhost:3777/board', 'localhost:3777')).toBe('internal');
	});

	it('falls back to other for an unknown site', () => {
		expect(classifySource('https://habr.com/ru/post/1/', HOST)).toBe('other');
	});

	it('treats a malformed referrer as other rather than throwing', () => {
		expect(classifySource('not a url', HOST)).toBe('other');
	});

	it('does not mistake a lookalike domain for the real one', () => {
		expect(classifySource('https://notgoogle.com/', HOST)).toBe('other');
		expect(classifySource('https://google.com.evil.io/', HOST)).toBe('other');
		expect(classifySource('https://retrospectrix.ru.evil.io/', HOST)).toBe('other');
	});
});

describe('isBot', () => {
	it('spots the crawlers we just invited', () => {
		expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
		expect(isBot('Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)')).toBe(true);
		expect(isBot('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe(true);
	});

	it('spots generic crawlers and probes', () => {
		expect(isBot('curl/8.4.0')).toBe(true);
		expect(isBot('python-requests/2.31.0')).toBe(true);
		expect(isBot('SomeThing-Spider/1.0')).toBe(true);
	});

	it('lets real browsers through', () => {
		expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36')).toBe(false);
		expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe(false);
	});

	it('treats a missing user agent as a bot', () => {
		expect(isBot(null)).toBe(true);
		expect(isBot('')).toBe(true);
	});
});

describe('isCountablePage', () => {
	it('counts page views', () => {
		expect(isCountablePage('/', 'text/html,application/xhtml+xml')).toBe(true);
		expect(isCountablePage('/somebooardslug', 'text/html')).toBe(true);
	});

	it('ignores api calls, assets and service files', () => {
		expect(isCountablePage('/api/v1/boards/x/export.md', 'text/html')).toBe(false);
		expect(isCountablePage('/health', 'text/html')).toBe(false);
		expect(isCountablePage('/metrics', 'text/html')).toBe(false);
		expect(isCountablePage('/sitemap.xml', 'text/html')).toBe(false);
	});

	it('ignores non-document requests such as fetch and prefetch', () => {
		expect(isCountablePage('/', 'application/json')).toBe(false);
		expect(isCountablePage('/', null)).toBe(false);
	});
});
