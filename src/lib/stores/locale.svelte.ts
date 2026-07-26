import { browser } from '$app/environment';

const SUPPORTED_LOCALES = ['en', 'ru'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupported(val: string): val is SupportedLocale {
	return (SUPPORTED_LOCALES as readonly string[]).includes(val);
}

class LocaleStore {
	// ru по умолчанию: домен .ru, аудитория русская, и именно эту версию
	// сервер отдаёт поисковикам. Англоязычные получат свой язык при загрузке.
	locale = $state<SupportedLocale>('ru');

	constructor() {
		if (browser) {
			const saved = localStorage.getItem('retro-locale');
			if (saved && isSupported(saved)) {
				this.locale = saved;
			} else {
				const lang = navigator.language.split('-')[0];
				if (isSupported(lang)) {
					this.locale = lang;
				}
			}
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
