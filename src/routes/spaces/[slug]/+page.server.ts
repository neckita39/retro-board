import { error, fail, redirect, type Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isValidFormat, DEFAULT_FORMAT } from '$lib/formats.js';
import { moodCounts, type ColumnCount } from '$lib/mood.js';
import { normalizeTitle } from '$lib/titles.js';
import { db } from '$lib/server/db/index.js';
import { spaces, boards, cards, votes, spaceAnalyses } from '$lib/server/db/schema.js';
import { eq, sql, desc, inArray, and, or, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { hashPassword, verifyPassword } from '$lib/server/password.js';
import { metric } from '$lib/server/statsd.js';
import { decrypt, encryptionEnabled } from '$lib/server/crypto.js';
import {
	ANALYSIS_DAILY_LIMIT,
	analysesInWindow,
	analysisTitle,
	cacheState,
	collectCards,
	isAnalysisBoard,
	latestReady,
	limitRows,
	livePending,
	parseClientDate,
	PENDING_STALE_MS,
	retryInHours,
	rowToState,
	statePayload,
	type AnalysisLocale
} from '$lib/server/analysis.js';
import { emitSpace } from '$lib/server/bus.js';
import { runAnalysisJob } from '$lib/server/analysis-job.js';
import {
	canViewSpace,
	grantSpaceAccess,
	safeNextBoardSlug,
	spacePasswordError
} from '$lib/server/space-access.js';
import { spaceVerifyLimiter } from '$lib/server/space-limits.js';
import {
	allowHttpEnabled,
	BitrixError,
	checkTasksScope,
	parseWebhookUrl,
	resolveGroup,
	verifyWebhook
} from '$lib/server/bitrix.js';
import {
	deleteConnection,
	loadConnection,
	publicInfo,
	saveConnection,
	setLastError,
	updateGroup
} from '$lib/server/bitrix-connection.js';
import { connectLimiter, groupLimiter } from '$lib/server/bitrix-limits.js';
import { parseGroupId, persistsLastError, statusForKind, type ActionErrorKind } from '$lib/server/bitrix-flows.js';
import type { PageServerLoad, Actions } from './$types.js';

type BitrixAction = 'connect' | 'disconnect' | 'setGroup';
type BitrixField = 'webhook' | 'groupId';

// Панель Битрикс24 — только создателю пространства; чужому 403, как у rename
async function spaceForCreator(slug: string, cookies: Cookies) {
	const token = cookies.get(`retro_space_creator_${slug}`) ?? '';
	const space = await db.query.spaces.findFirst({ where: eq(spaces.slug, slug) });
	if (!space) throw error(404);
	if (!space.creatorToken || token !== space.creatorToken) throw error(403, 'Forbidden');
	return space;
}

// Один контракт отказа на три экшена панели: клиент ветвится по bitrixError, не по статусу
function bitrixFail(bitrixAction: BitrixAction, kind: ActionErrorKind, field?: BitrixField) {
	return fail(statusForKind(kind), { bitrixAction, bitrixError: kind, ...(field ? { field } : {}) });
}

// В лог — только вид, код и HTTP-статус портала: ни адреса, ни кода вебхука
function logBitrixFailure(event: string, spaceSlug: string, err: BitrixError) {
	console.warn(
		JSON.stringify({ event, space: spaceSlug, kind: err.kind, code: err.code ?? null, status: err.status ?? null })
	);
}

export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const space = await db.query.spaces.findFirst({
		where: eq(spaces.slug, params.slug)
	});

	if (!space) throw error(404, 'Space not found');

	const adminParam = url.searchParams.get('admin') ?? '';
	const creatorCookie = cookies.get(`retro_space_creator_${params.slug}`) ?? '';
	let isCreator = false;
	let showCreatedToast = false;

	if (adminParam && adminParam === space.creatorToken) {
		cookies.set(`retro_space_creator_${params.slug}`, adminParam, {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		// Значение cookie доступа — секрет пространства, а не константа:
		// canViewSpace и server.js сравнивают его с access_token
		cookies.set(`retro_space_${params.slug}`, space.accessToken, {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		isCreator = true;
		showCreatedToast = true;
	} else if (creatorCookie && creatorCookie === space.creatorToken) {
		isCreator = true;
	}

	const hasPassword = !!space.passwordHash;
	// Без пароля canViewSpace пускает всех; с паролем — создателя или cookie, равную access_token
	if (!isCreator && !canViewSpace(space, cookies)) {
		return {
			space: { slug: space.slug, name: space.name },
			authenticated: false,
			isCreator: false,
			hasPassword: true,
			// Пришли по ссылке на доску внутри пространства — вернём на неё после пароля
			next: safeNextBoardSlug(url.searchParams.get('next')),
			boards: [],
			showCreatedToast: false,
			adminLink: null,
			analysisEnabled: false,
			analysis: null,
			animateTiles: false,
			bitrix: null,
			encryptionEnabled: false
		};
	}

	const spaceBoards = await db
		.select({
			id: boards.id,
			slug: boards.slug,
			title: boards.title,
			format: boards.format,
			createdAt: boards.createdAt
		})
		.from(boards)
		.where(eq(boards.spaceId, space.id))
		.orderBy(desc(boards.createdAt));

	// Полоса настроения на плитках: карточки считаем по (доска, колонка), а в тон
	// их переводит формат доски (mood.ts) — иначе у любой не-classic доски и у
	// доски-анализа полоса была бы пустой
	const boardIds = spaceBoards.map((b) => b.id);
	const columnCounts = boardIds.length
		? await db
				.select({
					boardId: cards.boardId,
					columnType: cards.columnType,
					count: sql<number>`cast(count(*) as integer)`
				})
				.from(cards)
				.where(inArray(cards.boardId, boardIds))
				.groupBy(cards.boardId, cards.columnType)
		: [];
	const countsByBoard = new Map<string, ColumnCount[]>();
	for (const row of columnCounts) {
		const list = countsByBoard.get(row.boardId) ?? [];
		list.push({ columnType: row.columnType, count: Number(row.count) });
		countsByBoard.set(row.boardId, list);
	}

	const analysisRows = await db
		.select()
		.from(spaceAnalyses)
		.where(eq(spaceAnalyses.spaceId, space.id))
		.orderBy(desc(spaceAnalyses.createdAt));

	// Плитки «влетают» только при первом показе списка за сессию браузера: при
	// каждом следующем заходе или перезагрузке анимация уже раздражает.
	// Решаем на сервере, чтобы HTML сразу пришёл без анимации и ничего не дёргалось.
	const animateTiles = !cookies.get('retro_tiles_seen');
	if (animateTiles) cookies.set('retro_tiles_seen', '1', { path: '/', httpOnly: true, sameSite: 'lax' });

	// Панель Битрикс24 видит только создатель; вебхук в page data не попадает — только publicInfo.
	// Здесь нужен именно loadConnection, а не loadPublicInfo: панель показывает «подключите заново»,
	// когда вебхук не расшифровался (сменили ENCRYPTION_KEY), а это видно только после decrypt
	const bitrixConnection = isCreator ? await loadConnection(space.id) : null;

	const adminLink = isCreator
		? `${url.origin}/spaces/${params.slug}?admin=${space.creatorToken}`
		: null;

	return {
		space: {
			id: space.id,
			slug: space.slug,
			name: space.name,
			lastFormat: space.lastFormat,
			createdAt: space.createdAt.toISOString()
		},
		authenticated: true,
		isCreator,
		hasPassword,
		showCreatedToast,
		adminLink,
		analysisEnabled: !!env.DEEPSEEK_API_KEY,
		analysis: statePayload(analysisRows, new Date()),
		animateTiles,
		bitrix: bitrixConnection ? publicInfo(bitrixConnection) : null,
		encryptionEnabled: isCreator && encryptionEnabled,
		boards: spaceBoards.map((b) => {
			const rows = countsByBoard.get(b.id) ?? [];
			const mood = moodCounts(b.format, rows);
			return {
				...b,
				createdAt: b.createdAt.toISOString(),
				cardCount: rows.reduce((sum, r) => sum + r.count, 0),
				wellCount: mood.well,
				badCount: mood.bad,
				improveCount: mood.improve,
				plumCount: mood.plum
			};
		})
	};
};

export const actions: Actions = {
	rename: async ({ request, params, cookies }) => {
		const token = cookies.get(`retro_space_creator_${params.slug}`) ?? '';
		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404);
		if (!space.creatorToken || token !== space.creatorToken) throw error(403, 'Forbidden');

		const formData = await request.formData();
		const name = normalizeTitle(formData.get('name'));
		if (!name) return fail(400, { renameError: 'empty_name' });

		await db.update(spaces).set({ name }).where(eq(spaces.id, space.id));
		return { renamed: true };
	},

	verify: async ({ request, params, cookies, getClientAddress }) => {
		// Пароль закрывает и доски пространства, поэтому перебор ограничен:
		// scrypt на каждую попытку — ещё и нагрузка на процессор
		if (!spaceVerifyLimiter.check(getClientAddress())) {
			return fail(429, { error: 'too_many' });
		}

		const formData = await request.formData();
		const password = formData.get('password') as string;

		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});

		if (!space) throw error(404);

		// Password could have been disabled while the form was open — let them in
		if (space.passwordHash) {
			const valid = await verifyPassword(password || '', space.passwordHash);
			if (!valid) {
				return fail(400, { error: 'wrong_password' });
			}
		}

		// Пароль верный — выдаём текущий токен доступа; после следующего enablePassword он перестанет действовать
		grantSpaceAccess(space, cookies);

		// Пришёл по ссылке на доску — возвращаем на неё, а не на витрину пространства.
		// Значение валидируется как слаг доски: произвольный путь тут был бы open redirect
		const next = safeNextBoardSlug(formData.get('next') as string | null);
		throw redirect(303, next ? `/${next}` : `/spaces/${params.slug}`);
	},

	disablePassword: async ({ request, params, cookies }) => {
		const token = cookies.get(`retro_space_creator_${params.slug}`) ?? '';
		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404);
		if (!space.creatorToken || token !== space.creatorToken) throw error(403, 'Forbidden');
		if (!space.passwordHash) return fail(400, { passwordAction: 'disable', passwordError: 'no_password' });

		const formData = await request.formData();
		const password = formData.get('password') as string;
		const valid = await verifyPassword(password || '', space.passwordHash);
		if (!valid) return fail(400, { passwordAction: 'disable', passwordError: 'wrong_password' });

		// access_token не трогаем: без пароля cookie не проверяется, а включение
		// пароля (enablePassword) всё равно выдаёт новый токен
		await db.update(spaces).set({ passwordHash: null }).where(eq(spaces.id, space.id));
		return { passwordAction: 'disable', passwordSuccess: true };
	},

	enablePassword: async ({ request, params, cookies }) => {
		const token = cookies.get(`retro_space_creator_${params.slug}`) ?? '';
		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404);
		if (!space.creatorToken || token !== space.creatorToken) throw error(403, 'Forbidden');

		const formData = await request.formData();
		const password = (formData.get('password') as string)?.trim();
		const policyError = spacePasswordError(password);
		if (policyError) return fail(400, { passwordAction: 'enable', passwordError: policyError });

		const passwordHash = await hashPassword(password);
		// Новый пароль — новый токен доступа: cookie, выданные раньше (в том числе
		// под прошлым паролем), перестают открывать пространство сами
		const accessToken = nanoid(32);
		await db.update(spaces).set({ passwordHash, accessToken }).where(eq(spaces.id, space.id));
		cookies.set(`retro_space_${params.slug}`, accessToken, {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		return { passwordAction: 'enable', passwordSuccess: true };
	},

	createBoard: async ({ request, params, cookies }) => {
		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404);
		// Раньше хватало любой cookie retro_space_{slug}: подделав её, гость создавал
		// доску в закрытом пространстве и становился её создателем
		if (!canViewSpace(space, cookies)) throw error(403, 'Not authenticated');

		const formData = await request.formData();
		const locale = formData.get('locale') === 'ru' ? 'ru' : 'en';
		const title = (formData.get('title') as string)?.trim() || (locale === 'ru' ? 'Ретро' : 'Retro');

		const requested = formData.get('format');
		const format = isValidFormat(requested) ? (requested as string) : DEFAULT_FORMAT;

		const slug = nanoid(21);
		const creatorToken = nanoid(32);

		await db.insert(boards).values({ title, slug, creatorToken, spaceId: space.id, format });
		// Пространство помнит последний выбор — он станет предвыбором для следующей доски
		await db.update(spaces).set({ lastFormat: format }).where(eq(spaces.id, space.id));

		cookies.set(`retro_creator_${slug}`, creatorToken, {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});

		metric('retro.board.created', 1);

		throw redirect(303, `/${slug}?admin=${creatorToken}`);
	},

	// Крестик на плитке «Анализ не удался»: убираем упавшие (и брошенные) попытки,
	// всем в пространстве уходит состояние без них
	dismissAnalysis: async ({ params, cookies }) => {
		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404);
		if (!canViewSpace(space, cookies)) throw error(403, 'Not authenticated');

		const now = new Date();
		await db.delete(spaceAnalyses).where(
			and(
				eq(spaceAnalyses.spaceId, space.id),
				or(
					eq(spaceAnalyses.state, 'failed'),
					and(eq(spaceAnalyses.state, 'pending'), lt(spaceAnalyses.createdAt, new Date(now.getTime() - PENDING_STALE_MS)))
				)
			)
		);
		const rows = await db
			.select()
			.from(spaceAnalyses)
			.where(eq(spaceAnalyses.spaceId, space.id))
			.orderBy(desc(spaceAnalyses.createdAt));
		emitSpace(params.slug, 'analysis:state', statePayload(rows, now));
		return { analysis: 'dismissed' as const };
	},

	// AI-анализ пространства: только запускает фоновую задачу и сразу отвечает.
	// О ходе дела всем в пространстве сообщает сокет (см. analysis-job.ts и bus.ts).
	analyze: async ({ request, params, cookies }) => {
		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404);
		if (!canViewSpace(space, cookies)) throw error(403, 'Not authenticated');

		metric('retro.analysis.requested', 1);
		const failWith = (status: number, kind: string, extra: Record<string, unknown> = {}) => {
			metric(`retro.analysis.failed.${kind}`, 1);
			return fail(status, { analysis: kind, ...extra });
		};

		const apiKey = env.DEEPSEEK_API_KEY || '';
		if (!apiKey) return failWith(503, 'not_configured');

		const formData = await request.formData();
		const locale: AnalysisLocale = formData.get('locale') === 'ru' ? 'ru' : 'en';
		const now = new Date();

		const rows = await db
			.select()
			.from(spaceAnalyses)
			.where(eq(spaceAnalyses.spaceId, space.id))
			.orderBy(desc(spaceAnalyses.createdAt));
		if (livePending(rows, now)) return failWith(409, 'running');

		const regular = (
			await db
				.select({ id: boards.id, slug: boards.slug, title: boards.title, format: boards.format, createdAt: boards.createdAt })
				.from(boards)
				.where(eq(boards.spaceId, space.id))
				.orderBy(desc(boards.createdAt))
		).filter((b) => !isAnalysisBoard(b));

		const ready = latestReady(rows);
		if (ready && cacheState(regular[0]?.createdAt ?? null, ready.createdAt) === 'fresh') {
			metric('retro.analysis.cached', 1);
			return { analysis: 'cached' as const, boardSlug: ready.boardSlug };
		}

		const window = analysesInWindow(limitRows(rows, now), now);
		if (window.count >= ANALYSIS_DAILY_LIMIT && window.oldestAt) {
			return failWith(429, 'limit', { retryInHours: retryInHours(window.oldestAt, now) });
		}

		const regularIds = regular.map((b) => b.id);
		const spaceCards = regularIds.length
			? await db
					.select({ id: cards.id, boardId: cards.boardId, columnType: cards.columnType, content: cards.content, createdAt: cards.createdAt })
					.from(cards)
					.where(inArray(cards.boardId, regularIds))
			: [];
		const cardIds = spaceCards.map((c) => c.id);
		const spaceVotes = cardIds.length
			? await db.select({ cardId: votes.cardId, type: votes.type }).from(votes).where(inArray(votes.cardId, cardIds))
			: [];
		const entries = collectCards(
			regular,
			spaceCards.map((c) => ({ ...c, content: decrypt(c.content) ?? '' })),
			spaceVotes
		);
		if (entries.length === 0) return failWith(400, 'no_cards');

		// Упавшие и брошенные (устаревшие pending) попытки убираем: показывается
		// только текущая. Живой pending не трогаем — его мог только что вставить
		// параллельный клик; тогда наш insert упрётся в частичный уникальный индекс.
		await db.delete(spaceAnalyses).where(
			and(
				eq(spaceAnalyses.spaceId, space.id),
				or(
					eq(spaceAnalyses.state, 'failed'),
					and(eq(spaceAnalyses.state, 'pending'), lt(spaceAnalyses.createdAt, new Date(now.getTime() - PENDING_STALE_MS)))
				)
			)
		);

		const boardSlug = nanoid(21);
		const creatorToken = nanoid(32);
		const title = analysisTitle(parseClientDate(formData.get('localDate'), now), locale);
		let row: typeof spaceAnalyses.$inferSelect;
		try {
			// createdAt = момент чтения досок: кеш сравнивает его с датой последней доски
			[row] = await db
				.insert(spaceAnalyses)
				.values({ spaceId: space.id, state: 'pending', title, locale, boardSlug, creatorToken, createdAt: now })
				.returning();
		} catch (err) {
			// 23505 — space_analyses_one_pending: кто-то нажал одновременно с нами
			if ((err as { code?: string })?.code === '23505') return failWith(409, 'running');
			throw err;
		}

		// Нажавший — создатель будущей доски, cookie ставим сразу
		cookies.set(`retro_creator_${boardSlug}`, creatorToken, {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		metric('retro.analysis.started', 1);
		emitSpace(params.slug, 'analysis:state', rowToState(row, now));

		void runAnalysisJob({
			row,
			spaceSlug: params.slug,
			entries,
			locale,
			apiKey,
			apiBase: env.DEEPSEEK_API_BASE || undefined
		});

		return { analysis: 'started' as const };
	},

	// Подключение вебхука. Порядок из спеки (Секция 3): создатель → лимитер (до любого
	// исходящего вызова — сервер не должен стать прокси для перебора чужих вебхуков) →
	// шифрование → адрес → profile → право «Задачи» → группа → upsert.
	// Любой шаг упал — ничего не сохраняем.
	bitrixConnect: async ({ request, params, cookies, getClientAddress }) => {
		const space = await spaceForCreator(params.slug, cookies);
		const failWith = (kind: ActionErrorKind, field?: BitrixField) => {
			metric(`retro.bitrix.connect_failed.${kind}`, 1);
			return bitrixFail('connect', kind, field);
		};

		if (!connectLimiter.check(getClientAddress())) return failWith('rate_limited');
		if (!encryptionEnabled) return failWith('encryption');

		const formData = await request.formData();
		const raw = formData.get('webhook');
		// allowHttpEnabled — общий источник флага с bitrix.ts и bitrix-connection.ts: адрес,
		// принятый здесь, должен расшифровываться в рабочий вебхук и при чтении строки
		const webhook = typeof raw === 'string' ? parseWebhookUrl(raw.trim(), { allowHttp: allowHttpEnabled() }) : null;
		if (!webhook) return failWith('invalid_url', 'webhook');
		const groupId = parseGroupId(formData.get('groupId'));
		if (groupId === 'invalid') return failWith('invalid', 'groupId');

		try {
			const profile = await verifyWebhook(webhook);
			await checkTasksScope(webhook);

			let groupName: string | null = null;
			let groupNameUnavailable = false;
			if (groupId !== null) {
				const group = await resolveGroup(webhook, groupId);
				if (group.status === 'notFound') return failWith('group', 'groupId');
				if (group.status === 'ok') groupName = group.name;
				// noScope: нет права «Рабочие группы соцсети» — сохраняем id без названия
				else groupNameUnavailable = true;
			}

			await saveConnection({
				spaceId: space.id,
				webhookUrl: webhook.url,
				portal: webhook.portal,
				userId: profile.userId,
				userName: profile.userName,
				timeZone: profile.timeZone,
				portalOffset: profile.portalOffset,
				groupId,
				groupName
			});
			metric('retro.bitrix.connected', 1);
			console.info(JSON.stringify({ event: 'bitrix:connected', space: params.slug, portal: webhook.portal }));
			return {
				bitrixAction: 'connect' as const,
				bitrixSuccess: true as const,
				...(groupNameUnavailable ? { groupNameUnavailable: true as const } : {})
			};
		} catch (err) {
			if (!(err instanceof BitrixError)) throw err;
			logBitrixFailure('bitrix:connect_failed', params.slug, err);
			const kind = err.kind;
			// Подключения ещё нет — UPDATE ничего не создаст; есть (переподключают сломанный) — панель покажет предупреждение
			if (persistsLastError(kind)) await setLastError(space.id, kind);
			return failWith(kind, kind === 'group' ? 'groupId' : 'webhook');
		}
	},

	// Отключение: строка уходит, задачи на карточках остаются ссылками
	bitrixDisconnect: async ({ params, cookies }) => {
		const space = await spaceForCreator(params.slug, cookies);
		await deleteConnection(space.id);
		metric('retro.bitrix.disconnected', 1);
		return { bitrixAction: 'disconnect' as const, bitrixSuccess: true as const };
	},

	// Смена группы по умолчанию без повторного ввода вебхука (мы его не показываем).
	// Лимитер общий с GET /[slug]/bitrix/group.
	bitrixSetGroup: async ({ request, params, cookies, getClientAddress }) => {
		const space = await spaceForCreator(params.slug, cookies);
		if (!groupLimiter.check(getClientAddress())) return bitrixFail('setGroup', 'rate_limited');

		const formData = await request.formData();
		const groupId = parseGroupId(formData.get('groupId'));
		if (groupId === 'invalid') return bitrixFail('setGroup', 'invalid', 'groupId');

		const connection = await loadConnection(space.id);
		if (!connection) return bitrixFail('setGroup', 'not_connected');

		// Пустое поле — «без группы»: портал не спрашиваем, last_error не трогаем
		if (groupId === null) {
			await updateGroup(space.id, null, null);
			return { bitrixAction: 'setGroup' as const, bitrixSuccess: true as const };
		}

		// Не расшифровался (ключ сменили) — просим подключить заново
		if (!connection.webhook) {
			await setLastError(space.id, 'invalid_webhook');
			return bitrixFail('setGroup', 'invalid_webhook');
		}

		try {
			const group = await resolveGroup(connection.webhook, groupId);
			if (group.status === 'notFound') return bitrixFail('setGroup', 'group', 'groupId');
			await updateGroup(space.id, groupId, group.status === 'ok' ? group.name : null);
			// Портал ответил — вебхук жив, старое предупреждение снимаем
			if (connection.lastError) await setLastError(space.id, null);
			return {
				bitrixAction: 'setGroup' as const,
				bitrixSuccess: true as const,
				...(group.status === 'noScope' ? { groupNameUnavailable: true as const } : {})
			};
		} catch (err) {
			if (!(err instanceof BitrixError)) throw err;
			logBitrixFailure('bitrix:set_group_failed', params.slug, err);
			const kind = err.kind;
			if (persistsLastError(kind)) await setLastError(space.id, kind);
			return bitrixFail('setGroup', kind, kind === 'group' ? 'groupId' : undefined);
		}
	}
};
