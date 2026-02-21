import { describe, it, expect } from 'vitest';
import { COLUMN_CONFIG } from './types.js';
import type { ColumnType } from './types.js';

describe('COLUMN_CONFIG', () => {
	const expectedTypes: ColumnType[] = ['went_well', 'didnt_go_well', 'improve'];

	it('contains all three column types', () => {
		expect(Object.keys(COLUMN_CONFIG).sort()).toEqual([...expectedTypes].sort());
	});

	it.each(expectedTypes)('%s has an emoji field', (type) => {
		expect(COLUMN_CONFIG[type]).toHaveProperty('emoji');
		expect(typeof COLUMN_CONFIG[type].emoji).toBe('string');
	});
});
