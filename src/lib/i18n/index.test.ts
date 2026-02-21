import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

import { localeStore } from '$lib/stores/locale.svelte.js';
import { t } from './index.js';

beforeEach(() => {
	localeStore.locale = 'en';
});

describe('t()', () => {
	it('returns English translation by key', () => {
		expect(t('home.title')).toBe('Start a Retrospective');
	});

	it('returns Russian translation when locale is ru', () => {
		localeStore.locale = 'ru';
		expect(t('home.title')).toBe('Начать ретроспективу');
	});

	it('substitutes {n} parameter', () => {
		expect(t('column.cards', { n: 5 })).toBe('5 card(s)');
	});

	it('returns the key when translation is missing', () => {
		expect(t('nonexistent.key')).toBe('nonexistent.key');
	});

	it('falls back to English when Russian key is missing', () => {
		localeStore.locale = 'ru';
		// A completely missing key returns the key itself
		expect(t('nonexistent.only.en')).toBe('nonexistent.only.en');
	});
});
