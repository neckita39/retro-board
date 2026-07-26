import type { Handle, HandleServerError } from '@sveltejs/kit';
import { metric } from '$lib/server/statsd.js';
import { classifySource, isBot, isCountablePage } from '$lib/server/visitors.js';

// Сессионная кука: живёт до закрытия браузера. Один визит — один посетитель,
// перезагрузка страницы счётчик не двигает.
const VISIT_COOKIE = 'retro_visit';

function countVisit(event: Parameters<Handle>[0]['event']) {
	const req = event.request;
	if (!isCountablePage(event.url.pathname, req.headers.get('accept'))) return;
	if (isBot(req.headers.get('user-agent'))) return;
	if (event.cookies.get(VISIT_COOKIE)) return;

	event.cookies.set(VISIT_COOKIE, '1', {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: event.url.protocol === 'https:'
	});

	// internal — человек уже был посчитан на входе, это переход по сайту
	const source = classifySource(req.headers.get('referer'), event.url.host);
	if (source === 'internal') return;

	metric('retro.guest.from_web', 1);
	metric(`retro.guest.source.${source}`, 1);
}

export const handle: Handle = async ({ event, resolve }) => {
	const start = Date.now();
	try {
		countVisit(event);
	} catch {
		// Аналитика не имеет права уронить страницу
	}
	const response = await resolve(event);
	const duration = Date.now() - start;

	const status = response.status;

	if (duration > 1000 || status >= 400) {
		const entry = {
			level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'warn',
			msg: status >= 400 ? 'HTTP error response' : 'Slow request',
			method: event.request.method,
			url: event.url.pathname,
			status,
			duration,
			timestamp: new Date().toISOString()
		};
		console.log(JSON.stringify(entry));
	}

	return response;
};

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	const entry = {
		level: 'error',
		msg: 'Unhandled server error',
		method: event.request.method,
		url: event.url.pathname,
		status,
		error: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
		timestamp: new Date().toISOString()
	};
	console.log(JSON.stringify(entry));

	return { message };
};
