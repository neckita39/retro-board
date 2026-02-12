import { browser } from '$app/environment';

const TOKEN_KEY = 'retro-session-token';
const LEGACY_KEY = 'retro-session-id';

export function getSessionToken(): string | null {
	if (!browser) return null;
	return localStorage.getItem(TOKEN_KEY);
}

export function setSessionToken(token: string): void {
	if (!browser) return;
	localStorage.setItem(TOKEN_KEY, token);
}

export function getSessionId(): string {
	if (!browser) return '';
	const token = localStorage.getItem(TOKEN_KEY);
	if (token) return token.split('.')[0];
	// Fallback to legacy if no signed token yet
	return localStorage.getItem(LEGACY_KEY) || '';
}

export function getLegacySessionId(): string | null {
	if (!browser) return null;
	const id = localStorage.getItem(LEGACY_KEY);
	if (id) localStorage.removeItem(LEGACY_KEY);
	return id;
}
