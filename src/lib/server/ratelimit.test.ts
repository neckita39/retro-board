import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from './ratelimit.js';

describe('createRateLimiter', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('allows up to max requests within the window', () => {
		const limiter = createRateLimiter({ max: 3, windowMs: 60_000 });
		expect(limiter.check('1.1.1.1')).toBe(true);
		expect(limiter.check('1.1.1.1')).toBe(true);
		expect(limiter.check('1.1.1.1')).toBe(true);
		expect(limiter.check('1.1.1.1')).toBe(false);
	});

	it('tracks IPs independently', () => {
		const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
		expect(limiter.check('1.1.1.1')).toBe(true);
		expect(limiter.check('2.2.2.2')).toBe(true);
		expect(limiter.check('1.1.1.1')).toBe(false);
	});

	it('resets after the window passes', () => {
		const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
		expect(limiter.check('1.1.1.1')).toBe(true);
		expect(limiter.check('1.1.1.1')).toBe(false);
		vi.advanceTimersByTime(60_001);
		expect(limiter.check('1.1.1.1')).toBe(true);
	});

	it('prunes stale entries so the map does not grow unbounded', () => {
		const limiter = createRateLimiter({ max: 1, windowMs: 1_000 });
		for (let i = 0; i < 100; i++) limiter.check(`ip-${i}`);
		vi.advanceTimersByTime(2_000);
		limiter.check('fresh-ip');
		expect(limiter.size()).toBeLessThanOrEqual(1);
	});
});
