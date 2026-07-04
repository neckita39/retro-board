// Shared in-memory per-IP rate limiter (single-process app, no external store needed)

export interface RateLimiter {
	check(ip: string): boolean;
	size(): number;
}

export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }): RateLimiter {
	const counts = new Map<string, { count: number; resetAt: number }>();
	let lastPrune = Date.now();

	return {
		check(ip: string): boolean {
			const now = Date.now();
			if (now - lastPrune > windowMs) {
				for (const [key, entry] of counts) {
					if (now > entry.resetAt) counts.delete(key);
				}
				lastPrune = now;
			}
			const entry = counts.get(ip);
			if (!entry || now > entry.resetAt) {
				counts.set(ip, { count: 1, resetAt: now + windowMs });
				return true;
			}
			if (entry.count >= max) return false;
			entry.count++;
			return true;
		},
		size(): number {
			return counts.size;
		}
	};
}
