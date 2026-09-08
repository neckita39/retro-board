import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

import { createStatsCache } from './stats.js';

function setup(ttl = 1000) {
	let now = 0;
	const clock = () => now;
	const loader = vi.fn(async () => ({ boards: loader.mock.calls.length, spaces: 1 }));
	const get = createStatsCache(loader, ttl, clock);
	return { get, loader, advance: (ms: number) => (now += ms) };
}

describe('кэш публичной статистики', () => {
	it('первый вызов грузит, повторный в пределах TTL — нет', async () => {
		const { get, loader } = setup();
		expect((await get())!.boards).toBe(1);
		expect((await get())!.boards).toBe(1);
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it('после TTL перезагружает', async () => {
		const { get, loader, advance } = setup(1000);
		await get();
		advance(1001);
		expect((await get())!.boards).toBe(2);
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it('параллельные вызовы делят одну загрузку', async () => {
		const { get, loader } = setup();
		await Promise.all([get(), get(), get()]);
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it('если база упала, отдаёт null, а не роняет главную', async () => {
		const failing = vi.fn(async () => {
			throw new Error('db down');
		});
		const get = createStatsCache(failing, 1000, () => 0);
		expect(await get()).toBeNull();
	});
});
