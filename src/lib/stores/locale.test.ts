import { describe, it, expect } from 'vitest';
import { resolveInitialLocale } from './locale.svelte.js';

describe('resolveInitialLocale', () => {
	it('uses the saved locale when it is supported', () => {
		expect(resolveInitialLocale('en')).toBe('en');
		expect(resolveInitialLocale('ru')).toBe('ru');
	});

	it('falls back to ru when nothing is saved', () => {
		// Googlebot renders pages with an en-US browser; the browser language
		// must not switch the page, otherwise Google indexes English titles.
		expect(resolveInitialLocale(null)).toBe('ru');
	});

	it('falls back to ru for an unsupported saved value', () => {
		expect(resolveInitialLocale('de')).toBe('ru');
	});
});
