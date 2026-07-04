import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

import { translate } from './index.js';

describe('translate', () => {
	it('uses the explicit locale, not the store', () => {
		expect(translate('en', 'column.went_well')).toBe('Went Well');
		expect(translate('ru', 'column.went_well')).toBe('Что прошло хорошо');
	});

	it('applies russian plural forms', () => {
		expect(translate('ru', 'apiExport.likes', { n: 1 })).toBe('1 лайк');
		expect(translate('ru', 'apiExport.likes', { n: 2 })).toBe('2 лайка');
		expect(translate('ru', 'apiExport.likes', { n: 5 })).toBe('5 лайков');
	});

	it('applies english plural forms', () => {
		expect(translate('en', 'apiExport.dislikes', { n: 1 })).toBe('1 dislike');
		expect(translate('en', 'apiExport.dislikes', { n: 3 })).toBe('3 dislikes');
	});
});
