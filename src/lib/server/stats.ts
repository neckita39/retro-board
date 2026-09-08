import { sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { boards, spaces } from './db/schema.js';

export interface PublicStats {
	boards: number;
	spaces: number;
}

/**
 * Кэш счётчика для главной. Главную дёргают краулеры и каждый заход
 * не должен стоить два count(*): свежее значение живёт TTL, параллельные
 * запросы делят одну загрузку, а упавшая база отдаёт null — главная
 * рендерится без строки счётчика, но рендерится.
 */
export function createStatsCache(
	load: () => Promise<PublicStats>,
	ttlMs = 60_000,
	now: () => number = Date.now
) {
	let value: PublicStats | null = null;
	let fetchedAt = 0;
	let pending: Promise<PublicStats | null> | null = null;

	return async function get(): Promise<PublicStats | null> {
		if (value && now() - fetchedAt < ttlMs) return value;
		if (!pending) {
			pending = load()
				.then((fresh) => {
					value = fresh;
					fetchedAt = now();
					return fresh;
				})
				.catch(() => value)
				.finally(() => {
					pending = null;
				});
		}
		return pending;
	};
}

async function countRows(): Promise<PublicStats> {
	const [[b], [s]] = await Promise.all([
		db.select({ n: sql<number>`cast(count(*) as integer)` }).from(boards),
		db.select({ n: sql<number>`cast(count(*) as integer)` }).from(spaces)
	]);
	return { boards: b.n, spaces: s.n };
}

export const getPublicStats = createStatsCache(countRows);
