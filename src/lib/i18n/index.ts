import { localeStore } from '$lib/stores/locale.svelte.js';
import en from './en.json';
import ru from './ru.json';

export const LOCALES = {
	en: { label: 'EN', dict: en },
	ru: { label: 'RU', dict: ru }
} as const;

export type Locale = keyof typeof LOCALES;
export const LOCALE_KEYS = Object.keys(LOCALES) as Locale[];

export function t(key: string, params?: Record<string, string | number>): string {
	const dict = LOCALES[localeStore.locale]?.dict ?? LOCALES.en.dict;
	let value = (dict as Record<string, string>)[key] ?? (LOCALES.en.dict as Record<string, string>)[key] ?? key;
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			value = value.replaceAll(`{${k}}`, String(v));
		}
	}
	return value;
}
