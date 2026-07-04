import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createRateLimiter } from '$lib/server/ratelimit.js';
import { socksDispatcher } from 'fetch-socks';
// undici's own fetch — the SOCKS dispatcher is built from the npm undici and is
// not accepted by Node's built-in fetch (different undici copies)
import { fetch as undiciFetch } from 'undici';

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || '';
const TG_CHAT_ID = process.env.TG_CHAT_ID || '';
// api.telegram.org is unreachable from RU hosting — override the base URL or,
// better, route through a SOCKS proxy outside RU (TG_PROXY=socks5://user:pass@host:port)
const TG_API_BASE = process.env.TG_API_BASE || 'https://api.telegram.org';
const TG_PROXY = process.env.TG_PROXY || '';

function buildTgDispatcher(): ReturnType<typeof socksDispatcher> | undefined {
	if (!TG_PROXY) return undefined;
	try {
		const u = new URL(TG_PROXY);
		return socksDispatcher({
			type: u.protocol.startsWith('socks4') ? 4 : 5,
			host: u.hostname,
			port: Number(u.port) || 1080,
			userId: decodeURIComponent(u.username) || undefined,
			password: decodeURIComponent(u.password) || undefined
		});
	} catch (e) {
		console.error(`[FEEDBACK] invalid TG_PROXY url: ${e instanceof Error ? e.message : e}`);
		return undefined;
	}
}

const tgDispatcher = buildTgDispatcher();

// Rate limit: 3 per IP per 10 minutes
const feedbackLimiter = createRateLimiter({ max: 3, windowMs: 600_000 });

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!feedbackLimiter.check(getClientAddress())) {
		throw error(429, 'Too many requests');
	}

	const { name, message } = await request.json();

	if (!message || typeof message !== 'string' || message.trim().length === 0 || message.length > 2000) {
		throw error(400, 'Invalid message');
	}
	if (name && (typeof name !== 'string' || name.length > 100)) {
		throw error(400, 'Invalid name');
	}

	const senderName = name?.trim() || 'Anonymous';
	const text = message.trim();
	const timestamp = new Date().toISOString();

	console.log(`[FEEDBACK] from="${senderName}" time=${timestamp}\n${text}`);

	if (TG_BOT_TOKEN && TG_CHAT_ID) {
		// Delivery is non-critical (feedback is already logged above), but failures
		// must be visible in the logs, not swallowed.
		// No parse_mode: user text with unbalanced * or _ would make Telegram
		// reject the whole message with 400.
		try {
			const tgText = `💬 Feedback\n\nОт: ${senderName}\n\n${text}`;
			const res = await undiciFetch(`${TG_API_BASE}/bot${TG_BOT_TOKEN}/sendMessage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					chat_id: TG_CHAT_ID,
					text: tgText
				}),
				signal: AbortSignal.timeout(10_000),
				dispatcher: tgDispatcher
			});
			if (!res.ok) {
				console.error(`[FEEDBACK] telegram send failed: ${res.status} ${await res.text()}`);
			}
		} catch (e) {
			console.error(`[FEEDBACK] telegram send error: ${e instanceof Error ? e.message : e}`);
		}
	} else {
		console.warn('[FEEDBACK] TG_BOT_TOKEN/TG_CHAT_ID not set — telegram notification skipped');
	}

	return json({ ok: true });
};
