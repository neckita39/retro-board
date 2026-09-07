import { localeStore } from '$lib/stores/locale.svelte.js';

/** Пара переводов для длинных текстов, которые не живут в словарях i18n. */
export interface Localized {
	en: string;
	ru: string;
}

/**
 * Читается во время рендера, поэтому остаётся реактивной к смене языка —
 * так же, как это уже работает в /changelog.
 */
export function txt(value: Localized): string {
	return localeStore.locale === 'ru' ? value.ru : value.en;
}
