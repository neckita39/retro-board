import { describe, it, expect } from 'vitest';
import en from './en.json';
import ru from './ru.json';

describe('dictionaries integrity', () => {
	const enKeys = Object.keys(en).sort();
	const ruKeys = Object.keys(ru).sort();

	it('both dictionaries have the same set of keys', () => {
		expect(enKeys).toEqual(ruKeys);
	});

	it('no English value is an empty string', () => {
		for (const [key, value] of Object.entries(en)) {
			expect(value, `en key "${key}" is empty`).not.toBe('');
		}
	});

	it('no Russian value is an empty string', () => {
		for (const [key, value] of Object.entries(ru)) {
			expect(value, `ru key "${key}" is empty`).not.toBe('');
		}
	});
});
