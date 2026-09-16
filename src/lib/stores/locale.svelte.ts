import { browser } from '$app/environment';

const SUPPORTED_LOCALES = ['en', 'ru'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupported(val: string): val is SupportedLocale {
	return (SUPPORTED_LOCALES as readonly string[]).includes(val);
}

// ru по умолчанию: домен .ru, аудитория русская, и именно эту версию сервер
// отдаёт поисковикам. Язык браузера намеренно не учитывается: рендерер Googlebot
// живёт с en-US, и автопереключение заставляло Google индексировать английские
// title/description у русских страниц. Английский включается кнопкой EN и
// запоминается в localStorage.
export function resolveInitialLocale(saved: string | null): SupportedLocale {
	return saved && isSupported(saved) ? saved : 'ru';
}

class LocaleStore {
	locale = $state<SupportedLocale>('ru');

	constructor() {
		if (browser) {
			this.locale = resolveInitialLocale(localStorage.getItem('retro-locale'));
		}
	}

	set(locale: SupportedLocale) {
		this.locale = locale;
		if (browser) {
			localStorage.setItem('retro-locale', locale);
		}
	}

	cycle() {
		const idx = SUPPORTED_LOCALES.indexOf(this.locale);
		const next = SUPPORTED_LOCALES[(idx + 1) % SUPPORTED_LOCALES.length];
		this.set(next);
	}
}

export const localeStore = new LocaleStore();
