import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { connectLimiter, groupLimiter, createIpLimiter, createSpaceLimiter, runningCards } from './bitrix-limits.js';
import type { RateLimiter } from './ratelimit.js';

function allowedOf(limiter: RateLimiter, key: string, attempts: number): number {
	let allowed = 0;
	for (let i = 0; i < attempts; i++) if (limiter.check(key)) allowed++;
	return allowed;
}

describe('лимиты Битрикс24', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('подключение — 5 попыток в минуту с IP, другой IP считается отдельно, через минуту снова можно', () => {
		expect(allowedOf(connectLimiter, '10.0.0.1', 7)).toBe(5);
		expect(connectLimiter.check('10.0.0.2')).toBe(true);
		vi.advanceTimersByTime(60_001);
		expect(connectLimiter.check('10.0.0.1')).toBe(true);
	});

	it('проверка группы — 30 в минуту с IP', () => {
		expect(allowedOf(groupLimiter, '10.0.0.1', 35)).toBe(30);
	});

	it('создание задач — 10 в минуту с IP и 30 в час на пространство', () => {
		expect(allowedOf(createIpLimiter, '10.0.0.1', 12)).toBe(10);
		expect(allowedOf(createSpaceLimiter, 'space:s1', 31)).toBe(30);
		vi.advanceTimersByTime(60_001);
		expect(createSpaceLimiter.check('space:s1')).toBe(false);
		vi.advanceTimersByTime(3_600_000);
		expect(createSpaceLimiter.check('space:s1')).toBe(true);
	});

	it('runningCards — пустой Set на процесс', () => {
		expect(runningCards).toBeInstanceOf(Set);
		expect(runningCards.size).toBe(0);
	});
});
