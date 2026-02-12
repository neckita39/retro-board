import { browser } from '$app/environment';

export function getSessionId(): string {
	if (!browser) return '';
	let id = localStorage.getItem('retro-session-id');
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem('retro-session-id', id);
	}
	return id;
}
