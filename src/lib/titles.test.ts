import { describe, it, expect } from 'vitest';
import { normalizeTitle, TITLE_MAX } from './titles.js';

describe('normalizeTitle — имя доски или пространства при переименовании', () => {
	it('обрезает пробелы по краям', () => {
		expect(normalizeTitle('  Спринт 12  ')).toBe('Спринт 12');
	});

	it('схлопывает внутренние пробелы и переводы строк', () => {
		expect(normalizeTitle('Спринт\n\t 12')).toBe('Спринт 12');
	});

	it('пустое имя или только пробелы → null', () => {
		expect(normalizeTitle('')).toBeNull();
		expect(normalizeTitle('   ')).toBeNull();
	});

	it('не строка → null', () => {
		expect(normalizeTitle(undefined)).toBeNull();
		expect(normalizeTitle(null)).toBeNull();
		expect(normalizeTitle(42)).toBeNull();
	});

	it('длиннее лимита → null, ровно лимит — ок', () => {
		expect(TITLE_MAX).toBe(100);
		expect(normalizeTitle('a'.repeat(101))).toBeNull();
		expect(normalizeTitle('a'.repeat(100))).toBe('a'.repeat(100));
	});
});
