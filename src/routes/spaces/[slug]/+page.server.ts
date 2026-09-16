import { error, fail, redirect } from '@sveltejs/kit';
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
import { decrypt } from '$lib/server/crypto.js';
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
import { canViewSpace } from '$lib/server/space-access.js';
import type { PageServerLoad, Actions } from './$types.js';

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
		cookies.set(`retro_space_${params.slug}`, 'authenticated', {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		isCreator = true;
		showCreatedToast = true;
	} else if (creatorCookie && creatorCookie === space.creatorToken) {
		isCreator = true;
	}

	const hasPassword = !!space.passwordHash;
	const accessCookie = cookies.get(`retro_space_${params.slug}`);
	if (hasPassword && !accessCookie && !isCreator) {
		return {
			space: { slug: space.slug, name: space.name },
			authenticated: false,
			isCreator: false,
			hasPassword: true,
			boards: [],
			showCreatedToast: false,
			adminLink: null,
			analysisEnabled: false,
			analysis: null,
			animateTiles: false
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

	verify: async ({ request, params, cookies }) => {
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

		cookies.set(`retro_space_${params.slug}`, 'authenticated', {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});

		throw redirect(303, `/spaces/${params.slug}`);
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
		if (!password) return fail(400, { passwordAction: 'enable', passwordError: 'empty_password' });

		const passwordHash = await hashPassword(password);
		await db.update(spaces).set({ passwordHash }).where(eq(spaces.id, space.id));
		return { passwordAction: 'enable', passwordSuccess: true };
	},

	createBoard: async ({ request, params, cookies }) => {
		const accessCookie = cookies.get(`retro_space_${params.slug}`);
		if (!accessCookie) throw error(403, 'Not authenticated');

		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404);

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
	}
};
