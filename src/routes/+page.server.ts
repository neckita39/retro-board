import { getPublicStats } from '$lib/server/stats.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	return { stats: await getPublicStats() };
};
