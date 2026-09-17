import { describe, it, expect, afterEach } from 'vitest';
import { emitSpace, emitBoard } from './bus.js';

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

describe('emitBoard', () => {
	afterEach(() => {
		delete g.__retroBus;
	});

	const payload = { cardId: 'c1', task: { id: 7, url: 'https://portal.bitrix24.ru/company/personal/user/1/tasks/task/view/7/' } };

	it('без шины (npm run dev) возвращает false и не падает', () => {
		expect(emitBoard('brd', 'card:task', payload)).toBe(false);
	});

	it('с шиной шлёт событие в канал board со slug доски, именем и payload', () => {
		const seen: unknown[] = [];
		g.__retroBus = { emit: (name: string, msg: unknown) => seen.push([name, msg]) };
		expect(emitBoard('brd', 'card:task', payload)).toBe(true);
		expect(seen).toEqual([['board', { boardSlug: 'brd', event: 'card:task', payload }]]);
	});
});
