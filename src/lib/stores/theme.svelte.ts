import { browser } from '$app/environment';

class ThemeStore {
	dark = $state(false);

	constructor() {
		if (browser) {
			const saved = localStorage.getItem('retro-theme');
			if (saved) {
				this.dark = saved === 'dark';
			} else {
				this.dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			}
			this.apply();
		}
	}

	toggle() {
		this.dark = !this.dark;
		if (browser) {
			localStorage.setItem('retro-theme', this.dark ? 'dark' : 'light');
			this.apply();
		}
	}

	apply() {
		if (browser) {
			document.documentElement.classList.toggle('dark', this.dark);
		}
	}
}

export const themeStore = new ThemeStore();
