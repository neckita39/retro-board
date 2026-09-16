import { describe, it, expect } from 'vitest';
import { isOverflowing } from './truncated-title.js';

describe('isOverflowing — подсказка только когда текст не влезает', () => {
	it('scrollWidth больше clientWidth → не влезает', () => {
		expect(isOverflowing({ scrollWidth: 320, clientWidth: 280 })).toBe(true);
	});
	it('равны или меньше → влезает', () => {
		expect(isOverflowing({ scrollWidth: 280, clientWidth: 280 })).toBe(false);
		expect(isOverflowing({ scrollWidth: 100, clientWidth: 280 })).toBe(false);
	});
});
