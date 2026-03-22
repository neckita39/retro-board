import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const FEEDBACK_EMAIL = process.env.FEEDBACK_EMAIL || '';

// Rate limit: 3 per IP per 10 minutes
const feedbackCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = feedbackCounts.get(ip);
	if (!entry || now > entry.resetAt) {
		feedbackCounts.set(ip, { count: 1, resetAt: now + 600_000 });
		return true;
	}
	if (entry.count >= 3) return false;
	entry.count++;
	return true;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!checkRateLimit(getClientAddress())) {
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
	const ip = getClientAddress();
	const timestamp = new Date().toISOString();

	// Send via SMTP-free approach: log + optional webhook
	// For now: log to stdout (picked up by Docker logs) and store in DB could be added later
	console.log(`[FEEDBACK] from="${senderName}" ip=${ip} time=${timestamp}\n${text}`);

	// If email is configured, send via a simple HTTPS webhook (e.g. Formspree, Mailgun, etc.)
	// For now we use a lightweight approach: POST to a mail API
	if (FEEDBACK_EMAIL) {
		try {
			// Use ntfy.sh as a free push notification (no email setup needed)
			const topic = FEEDBACK_EMAIL.replace(/[^a-zA-Z0-9]/g, '_');
			await fetch(`https://ntfy.sh/${topic}`, {
				method: 'POST',
				headers: { 'Title': `Feedback from ${senderName}`, 'Tags': 'speech_balloon' },
				body: text
			});
		} catch {
			// Non-critical — feedback is already logged
		}
	}

	return json({ ok: true });
};
