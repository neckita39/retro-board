import { browser } from '$app/environment';

export function getSessionId(): string {
	if (!browser) return '';
	let id = localStorage.getItem('retro-session-id');
	if (!id) {
		id = crypto.randomUUID?.() ??
			Array.from(crypto.getRandomValues(new Uint8Array(16)))
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');
		localStorage.setItem('retro-session-id', id);
	}
	return id;
}
