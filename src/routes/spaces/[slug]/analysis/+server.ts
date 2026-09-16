import { json, error } from '@sveltejs/kit';
import { eq, desc } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { spaces, spaceAnalyses } from '$lib/server/db/schema.js';
import { statePayload } from '$lib/server/analysis.js';
import { canViewSpace } from '$lib/server/space-access.js';
import type { RequestHandler } from './$types.js';

// Текущее состояние AI-анализа: клиент дёргает после space:join и реконнекта,
// чтобы не проиграть гонку «задача закончилась, пока сокет подключался»
export const GET: RequestHandler = async ({ params, cookies }) => {
	const space = await db.query.spaces.findFirst({ where: eq(spaces.slug, params.slug) });
	if (!space) throw error(404, 'Space not found');
	if (!canViewSpace(space, cookies)) throw error(403, 'Forbidden');

	const rows = await db
		.select()
		.from(spaceAnalyses)
		.where(eq(spaceAnalyses.spaceId, space.id))
		.orderBy(desc(spaceAnalyses.createdAt));
	return json(statePayload(rows, new Date()), { headers: { 'cache-control': 'no-store' } });
};
