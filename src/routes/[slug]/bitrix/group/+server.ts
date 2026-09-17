import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { boards, spaces } from '$lib/server/db/schema.js';
import { BitrixError, resolveGroup } from '$lib/server/bitrix.js';
import { loadConnection } from '$lib/server/bitrix-connection.js';
import { groupLimiter } from '$lib/server/bitrix-limits.js';
import { canCreateTask, parseGroupId } from '$lib/server/bitrix-flows.js';
import type { RequestHandler } from './$types.js';

// Проверка группы из преформы (через 400 мс после ввода). Никаких throw error():
// клиент ветвится по телу ответа. Любая неудача портала, включая нет права
// «Рабочие группы соцсети», — { unknown: true }: поле не подсвечиваем.
const reply = (body: Record<string, unknown>, status = 200) =>
	json(body, { status, headers: { 'cache-control': 'no-store' } });

export const GET: RequestHandler = async ({ params, url, cookies, getClientAddress }) => {
	const board = await db.query.boards.findFirst({ where: eq(boards.slug, params.slug) });
	const space = board?.spaceId
		? await db.query.spaces.findFirst({ where: eq(spaces.id, board.spaceId) })
		: undefined;
	if (!board || !space || !canCreateTask(board, space, cookies)) return reply({ bitrixError: 'forbidden' }, 403);

	if (!groupLimiter.check(getClientAddress())) return reply({ bitrixError: 'rate_limited' }, 429);

	const groupId = parseGroupId(url.searchParams.get('id'));
	if (groupId === null || groupId === 'invalid') return reply({ bitrixError: 'invalid' }, 400);

	const connection = await loadConnection(space.id);
	if (!connection) return reply({ bitrixError: 'not_connected' }, 409);
	// Вебхук не расшифровался — о группе ничего сказать нельзя; отправка формы вернёт invalid_webhook
	if (!connection.webhook) return reply({ unknown: true });

	try {
		const group = await resolveGroup(connection.webhook, groupId);
		if (group.status === 'ok') return reply({ name: group.name });
		if (group.status === 'notFound') return reply({ notFound: true });
		return reply({ unknown: true });
	} catch (err) {
		// Глотаем только отказы портала: своя ошибка (упала БД, баг) должна дойти до 500
		if (!(err instanceof BitrixError)) throw err;
		return reply({ unknown: true });
	}
};
