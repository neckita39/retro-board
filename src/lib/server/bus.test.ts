import { describe, it, expect, afterEach } from 'vitest';
import { emitSpace } from './bus.js';

const g = globalThis as { __retroBus?: unknown };

describe('emitSpace', () => {
	afterEach(() => {
		delete g.__retroBus;
	});

	it('без шины (npm run dev) возвращает false и не падает', () => {
		expect(emitSpace('sp', 'analysis:state', { state: 'idle' })).toBe(false);
	});

	it('с шиной шлёт событие space с slug, именем и payload', () => {
		const seen: unknown[] = [];
		g.__retroBus = { emit: (name: string, msg: unknown) => seen.push([name, msg]) };
		expect(emitSpace('sp', 'analysis:state', { state: 'idle' })).toBe(true);
		expect(seen).toEqual([['space', { spaceSlug: 'sp', event: 'analysis:state', payload: { state: 'idle' } }]]);
	});
});
