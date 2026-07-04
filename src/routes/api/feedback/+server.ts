import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createRateLimiter } from '$lib/server/ratelimit.js';

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || '';
const TG_CHAT_ID = process.env.TG_CHAT_ID || '';
// api.telegram.org is unreachable from RU hosting — point this at a proxy that
// forwards to it (e.g. nginx on a server outside RU)
const TG_API_BASE = process.env.TG_API_BASE || 'https://api.telegram.org';

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
			const res = await fetch(`${TG_API_BASE}/bot${TG_BOT_TOKEN}/sendMessage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					chat_id: TG_CHAT_ID,
					text: tgText
				}),
				signal: AbortSignal.timeout(10_000)
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
