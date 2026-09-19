import { error, fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db/index.js';
import { boards, cards, votes, comments, spaces, images, spaceAnalyses } from '$lib/server/db/schema.js';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { statePayload } from '$lib/server/analysis.js';
import type { AnalysisState } from '$lib/analysis-state.js';
import { canViewSpace } from '$lib/server/space-access.js';
import { decrypt } from '$lib/server/crypto.js';
import { metric } from '$lib/server/statsd.js';
import { emitBoard } from '$lib/server/bus.js';
import { loadConnection, loadPublicInfo, setLastError } from '$lib/server/bitrix-connection.js';
import { createIpLimiter, createSpaceLimiter, runningCards } from '$lib/server/bitrix-limits.js';
import {
	canCreateTask,
	createTaskFlow,
	isCardId,
	parseTaskForm,
	persistsLastError,
	statusForKind,
	type ActionErrorKind
} from '$lib/server/bitrix-flows.js';
import type { BitrixInfo, CardTask } from '$lib/types.js';
import type { Actions, PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const board = await db.query.boards.findFirst({
		where: eq(boards.slug, params.slug)
	});

	if (!board) {
		throw error(404, 'Board not found');
	}

	const boardCards = await db.query.cards.findMany({
		where: eq(cards.boardId, board.id)
	});

	const cardIds = boardCards.map((c) => c.id);
	let boardVotes: (typeof votes.$inferSelect)[] = [];
	let boardComments: (typeof comments.$inferSelect)[] = [];

	if (cardIds.length > 0) {
		[boardVotes, boardComments] = await Promise.all([
			db.select().from(votes).where(inArray(votes.cardId, cardIds)),
			db.select().from(comments).where(inArray(comments.cardId, cardIds))
		]);
	}

	// Image dimensions for stable layout — same shape the socket board:state delivers
	const imageIds = [
		...new Set(
			[...boardCards, ...boardComments].map((c) => c.imageId).filter((id): id is string => !!id)
		)
	];
	let imageMeta: Record<string, { width: number; height: number }> = {};
	if (imageIds.length > 0) {
		const rows = await db
			.select({ id: images.id, width: images.width, height: images.height })
			.from(images)
			.where(inArray(images.id, imageIds));
		imageMeta = Object.fromEntries(rows.map((r) => [r.id, { width: r.width, height: r.height }]));
	}

	// Родительское пространство и его админ: создатель пространства управляет
	// всеми его досками (переименовать, удалить, вести обсуждение), включая доску-анализ
	let space: { slug: string; name: string } | null = null;
	let spaceId: string | null = null;
	let spaceCreator = false;
	let analysis: AnalysisState | null = null;
	// Пароль пространства закрывает и доски внутри него: без доступа отдавать
	// содержимое нельзя, поэтому уводим на форму пароля, а она вернёт обратно (?next=)
	let spaceViewable = false;
	let lockedSpaceSlug: string | null = null;
	if (board.spaceId) {
		const s = await db.query.spaces.findFirst({
			where: eq(spaces.id, board.spaceId)
		});
		if (s) {
			space = { slug: s.slug, name: s.name };
			spaceId = s.id;
			const spaceCookie = cookies.get(`retro_space_creator_${s.slug}`) ?? '';
			spaceCreator = !!s.creatorToken && spaceCookie === s.creatorToken;
			spaceViewable = canViewSpace(s, cookies);
			if (!spaceViewable) lockedSpaceSlug = s.slug;
			if (spaceViewable) {
				// Статус AI-анализа пространства: уведомления должны приходить и на досках
				const rows = await db
					.select()
					.from(spaceAnalyses)
					.where(eq(spaceAnalyses.spaceId, s.id))
					.orderBy(desc(spaceAnalyses.createdAt));
				analysis = statePayload(rows, new Date());
			}
		}
	}

	const adminParam = url.searchParams.get('admin') ?? '';
	const cookieToken = cookies.get(`retro_creator_${params.slug}`) ?? '';

	let isCreator = spaceCreator;
	let showCreatedToast = false;

	if (adminParam && adminParam === board.creatorToken) {
		cookies.set(`retro_creator_${params.slug}`, adminParam, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
		isCreator = true;
		showCreatedToast = true;
	} else if (cookieToken && cookieToken === board.creatorToken) {
		isCreator = true;
	}

	// Битрикс24. Преформа — ведущему (создатель доски или пространства) с доступом
	// к пространству, когда пространство подключено; пункт меню «Подключить» —
	// только создателю пространства и только пока не подключено.
	// Читаем loadPublicInfo, а не loadConnection: здесь нужны только портал, владелец и группа,
	// и вебхук незачем расшифровывать — в page data он не уходит никогда.
	let bitrix: BitrixInfo | null = null;
	let bitrixOffer = false;
	if (space && spaceId && spaceViewable && isCreator) {
		const connection = await loadPublicInfo(spaceId);
		if (connection) {
			bitrix = {
				spaceSlug: space.slug,
				portal: connection.portal,
				userName: connection.userName,
				groupId: connection.groupId,
				groupName: connection.groupName
			};
		} else {
			bitrixOffer = spaceCreator;
		}
	}

	// Редирект здесь, а не сразу после canViewSpace: ?admin= выше уже выдал создателю
	// доски его cookie, поэтому после ввода пароля он вернётся сюда ведущим
	if (lockedSpaceSlug) {
		throw redirect(303, `/spaces/${lockedSpaceSlug}?next=${params.slug}`);
	}

	const adminLink = isCreator ? `${url.origin}/${params.slug}?admin=${board.creatorToken}` : null;

	return {
		board: {
			id: board.id,
			slug: board.slug,
			title: board.title,
			format: board.format,
			createdAt: board.createdAt.toISOString()
		},
		space,
		spaceName: space?.name ?? null,
		spaceSlug: space?.slug ?? null,
		isCreator,
		showCreatedToast,
		adminLink,
		analysisEnabled: spaceViewable && !!env.DEEPSEEK_API_KEY,
		analysis,
		bitrix,
		bitrixOffer,
		creatorToken: isCreator ? board.creatorToken : null,
		cards: boardCards.map((c) => ({
			...c,
			content: decrypt(c.content) ?? c.content,
			authorName: decrypt(c.authorName),
			imageWidth: c.imageId ? (imageMeta[c.imageId]?.width ?? null) : null,
			imageHeight: c.imageId ? (imageMeta[c.imageId]?.height ?? null) : null,
			createdAt: c.createdAt.toISOString()
		})),
		votes: boardVotes.map((v) => ({
			...v,
			createdAt: v.createdAt.toISOString()
		})),
		comments: boardComments.map((c) => ({
			...c,
			content: decrypt(c.content) ?? c.content,
			authorName: decrypt(c.authorName),
			imageWidth: c.imageId ? (imageMeta[c.imageId]?.width ?? null) : null,
			imageHeight: c.imageId ? (imageMeta[c.imageId]?.height ?? null) : null,
			createdAt: c.createdAt.toISOString()
		}))
	};
};

export const actions: Actions = {
	// «В задачу Битрикс24». Клиент ветвится только по bitrixError, поэтому
	// никаких throw error(): каждый отказ — fail со своим видом (Секция 3 спеки)
	createTask: async ({ request, params, cookies, getClientAddress }) => {
		const failWith = (kind: ActionErrorKind, extra: { field?: string; message?: string; task?: CardTask } = {}) => {
			metric(`retro.bitrix.task.failed.${kind}`, 1);
			return fail(statusForKind(kind), { bitrixError: kind, ...extra });
		};

		// 1. Права: создатель доски или пространства с доступом к пространству.
		// Доска вне пространства — тоже forbidden: подключения у неё быть не может
		const board = await db.query.boards.findFirst({ where: eq(boards.slug, params.slug) });
		const space = board?.spaceId
			? await db.query.spaces.findFirst({ where: eq(spaces.id, board.spaceId) })
			: undefined;
		if (!board || !space || !canCreateTask(board, space, cookies)) return failWith('forbidden');

		// 2. Пространство подключено к порталу
		const connection = await loadConnection(space.id);
		if (!connection) return failWith('not_connected');

		// 3. Карточка принадлежит этой доске. Регистр приводим как parseTaskForm:
		// произвольная строка не должна доходить до Postgres (invalid input syntax for uuid)
		const form = await request.formData();
		const cardId = String(form.get('cardId') ?? '')
			.trim()
			.toLowerCase();
		const card = isCardId(cardId)
			? await db.query.cards.findFirst({ where: and(eq(cards.id, cardId), eq(cards.boardId, board.id)) })
			: undefined;
		if (!card) return failWith('not_found');

		// 4. Одна задача на карточку: отдаём существующую, клиент покажет бейдж
		if (card.bitrixTaskId !== null) {
			return failWith('exists', { task: { id: card.bitrixTaskId, url: card.bitrixTaskUrl ?? '' } });
		}

		// 5. Второй ведущий уже создаёт задачу по этой карточке. Между has и add
		// нет await, поэтому занятие атомарно в пределах процесса
		if (runningCards.has(card.id)) return failWith('running');
		runningCards.add(card.id);
		try {
			// 6. Лимиты: 10 в минуту с IP, 30 в час на пространство
			if (!createIpLimiter.check(getClientAddress()) || !createSpaceLimiter.check(`space:${space.id}`)) {
				return failWith('rate_limited');
			}

			// 7. Поля формы
			const parsed = parseTaskForm(form);
			if (!parsed.ok) return failWith('invalid', { field: parsed.field });

			metric('retro.bitrix.task.requested', 1);

			// Ключ шифрования сменили или данные испорчены: вебхук не расшифровался
			if (!connection.webhook) {
				await setLastError(space.id, 'invalid_webhook');
				return failWith('invalid_webhook');
			}

			const outcome = await createTaskFlow({
				webhook: connection.webhook,
				connection: {
					userId: connection.userId,
					timeZone: connection.timeZone,
					portalOffset: connection.portalOffset
				},
				card: { id: card.id, imageId: card.imageId },
				fields: parsed.fields,
				source: parsed.source,
				// IS NULL: если карточку удалили, пока шёл запрос, — 0 строк
				saveTask: async (id, task) => {
					const rows = await db
						.update(cards)
						.set({ bitrixTaskId: task.id, bitrixTaskUrl: task.url })
						.where(and(eq(cards.id, id), isNull(cards.bitrixTaskId)))
						.returning({ id: cards.id });
					return rows.length > 0;
				},
				// Размер без чтения байтов: большой GIF не должен попасть в кучу
				imageSize: async (imageId) => {
					const [row] = await db
						.select({ size: sql<number>`octet_length(${images.data})` })
						.from(images)
						.where(eq(images.id, imageId));
					return row ? Number(row.size) : null;
				},
				loadImage: async (imageId) => {
					const [row] = await db
						.select({ mimeType: images.mimeType, data: images.data })
						.from(images)
						.where(eq(images.id, imageId));
					return row ?? null;
				},
				emit: (id, task) => {
					emitBoard(board.slug, 'card:task', { cardId: id, task });
				},
				metric,
				now: Date.now
			});

			if (!outcome.ok) {
				const kind = outcome.kind;
				if (persistsLastError(kind)) await setLastError(space.id, kind);
				// В лог только хост портала и вид ошибки: ни адреса вебхука, ни текста карточки
				console.warn(JSON.stringify({ event: 'bitrix:task_failed', portal: connection.portal, kind }));
				return failWith(kind, { field: outcome.field, message: outcome.message });
			}

			// Успешный экшен стирает предупреждение панели «вебхук перестал работать»
			if (connection.lastError) await setLastError(space.id, null);
			console.info(
				JSON.stringify({
					event: 'bitrix:task_created',
					portal: connection.portal,
					taskId: outcome.task.id,
					imageAttached: outcome.imageAttached
				})
			);
			return { task: outcome.task, imageAttached: outcome.imageAttached };
		} finally {
			runningCards.delete(card.id);
		}
	}
};
