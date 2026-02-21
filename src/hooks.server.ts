import type { Handle, HandleServerError } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const start = Date.now();
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
