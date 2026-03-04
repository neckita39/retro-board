import { localeStore } from '$lib/stores/locale.svelte.js';
import en from './en.json';
import ru from './ru.json';

export const LOCALES = {
	en: { label: 'EN', dict: en },
	ru: { label: 'RU', dict: ru }
} as const;

export type Locale = keyof typeof LOCALES;
export const LOCALE_KEYS = Object.keys(LOCALES) as Locale[];

const PLURAL_RULES: Record<Locale, (n: number) => number> = {
	en: (n) => (n === 1 ? 0 : 1),
	ru: (n) => {
		const m10 = n % 10;
		const m100 = n % 100;
		if (m10 === 1 && m100 !== 11) return 0;
		if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 1;
		return 2;
	}
};

export function t(key: string, params?: Record<string, string | number>): string {
	const locale = localeStore.locale;
	const dict = LOCALES[locale]?.dict ?? LOCALES.en.dict;
	let value = (dict as Record<string, string>)[key] ?? (LOCALES.en.dict as Record<string, string>)[key] ?? key;
	if (params && 'n' in params && value.includes('|')) {
		const n = Number(params.n);
		const forms = value.split('|');
		const idx = PLURAL_RULES[locale]?.(n) ?? (n === 1 ? 0 : 1);
		value = forms[Math.min(idx, forms.length - 1)];
	}
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			value = value.replaceAll(`{${k}}`, String(v));
		}
	}
	return value;
}
