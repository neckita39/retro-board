import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createRateLimiter } from '$lib/server/ratelimit.js';

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || '';
const TG_CHAT_ID = process.env.TG_CHAT_ID || '';

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
		try {
			const tgText = `💬 *Feedback*\n\nОт: ${senderName}\n\n${text}`;
			await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					chat_id: TG_CHAT_ID,
					text: tgText,
					parse_mode: 'Markdown'
				})
			});
		} catch {
			// Non-critical — feedback is already logged
		}
	}

	return json({ ok: true });
};
