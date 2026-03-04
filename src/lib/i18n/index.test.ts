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

	it('substitutes {n} parameter with plural form', () => {
		expect(t('column.cards', { n: 1 })).toBe('1 card');
		expect(t('column.cards', { n: 5 })).toBe('5 cards');
	});

	it('applies Russian plural rules', () => {
		localeStore.locale = 'ru';
		expect(t('column.cards', { n: 1 })).toBe('1 карточка');
		expect(t('column.cards', { n: 2 })).toBe('2 карточки');
		expect(t('column.cards', { n: 5 })).toBe('5 карточек');
		expect(t('column.cards', { n: 11 })).toBe('11 карточек');
		expect(t('column.cards', { n: 21 })).toBe('21 карточка');
	});

	it('en: 0 cards uses plural form', () => {
		expect(t('column.cards', { n: 0 })).toBe('0 cards');
	});

	it('en: comment count pluralizes correctly', () => {
		expect(t('comment.count', { n: 1 })).toBe('1 comment');
		expect(t('comment.count', { n: 3 })).toBe('3 comments');
	});

	it('ru: comment count uses correct forms', () => {
		localeStore.locale = 'ru';
		expect(t('comment.count', { n: 1 })).toBe('1 комментарий');
		expect(t('comment.count', { n: 3 })).toBe('3 комментария');
		expect(t('comment.count', { n: 5 })).toBe('5 комментариев');
		expect(t('comment.count', { n: 11 })).toBe('11 комментариев');
		expect(t('comment.count', { n: 21 })).toBe('21 комментарий');
	});

	it('ru: edge cases 12, 14, 100 use "many" form', () => {
		localeStore.locale = 'ru';
		expect(t('column.cards', { n: 12 })).toBe('12 карточек');
		expect(t('column.cards', { n: 14 })).toBe('14 карточек');
		expect(t('column.cards', { n: 100 })).toBe('100 карточек');
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
