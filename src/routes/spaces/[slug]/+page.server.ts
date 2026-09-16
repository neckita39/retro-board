import { error, fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isValidFormat, DEFAULT_FORMAT, ANALYSIS_FORMAT } from '$lib/formats.js';
import { normalizeTitle } from '$lib/titles.js';
import { db } from '$lib/server/db/index.js';
import { spaces, boards, cards, votes } from '$lib/server/db/schema.js';
import { eq, sql, desc, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { hashPassword, verifyPassword } from '$lib/server/password.js';
import { metric } from '$lib/server/statsd.js';
import { decrypt, encrypt } from '$lib/server/crypto.js';
import {
	ANALYSIS_COLUMNS,
	ANALYSIS_DAILY_LIMIT,
	AnalysisFailure,
	analysesInWindow,
	analysisAuthor,
	analysisTitle,
	buildPrompt,
	cacheState,
	cardText,
	collectCards,
	isAnalysisBoard,
	isEmptyAnalysis,
	parseAnalysis,
	retryInHours,
	runOnce,
	type AnalysisLocale
} from '$lib/server/analysis.js';
import { chatCompletion, DeepSeekError } from '$lib/server/deepseek.js';
import type { PageServerLoad, Actions } from './$types.js';

export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const space = await db.query.spaces.findFirst({
		where: eq(spaces.slug, params.slug)
	});

	if (!space) throw error(404, 'Space not found');

	const adminParam = url.searchParams.get('admin') ?? '';
	const creatorCookie = cookies.get(`retro_space_creator_${params.slug}`) ?? '';
	let isCreator = false;
	let showAdminBanner = false;

	if (adminParam && adminParam === space.creatorToken) {
		cookies.set(`retro_space_creator_${params.slug}`, adminParam, {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		cookies.set(`retro_space_${params.slug}`, 'authenticated', {
			path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
		});
		isCreator = true;
		showAdminBanner = true;
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
			showAdminBanner: false,
			adminLink: null,
			analysisEnabled: false
		};
	}

	const spaceBoards = await db
		.select({
			id: boards.id,
			slug: boards.slug,
			title: boards.title,
			format: boards.format,
			createdAt: boards.createdAt,
			cardCount: sql<number>`cast(count(${cards.id}) as integer)`,
			// Per-column counts feed the mood bar on board tiles
			wellCount: sql<number>`cast(count(${cards.id}) filter (where ${cards.columnType} = 'went_well') as integer)`,
			badCount: sql<number>`cast(count(${cards.id}) filter (where ${cards.columnType} = 'didnt_go_well') as integer)`,
			improveCount: sql<number>`cast(count(${cards.id}) filter (where ${cards.columnType} = 'improve') as integer)`
		})
		.from(boards)
		.leftJoin(cards, eq(cards.boardId, boards.id))
		.where(eq(boards.spaceId, space.id))
		.groupBy(boards.id, boards.slug, boards.title, boards.format, boards.createdAt)
		.orderBy(desc(boards.createdAt));

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
		showAdminBanner,
		adminLink,
		analysisEnabled: !!env.DEEPSEEK_API_KEY,
		boards: spaceBoards.map(b => ({
			...b,
			createdAt: b.createdAt.toISOString(),
			cardCount: Number(b.cardCount),
			wellCount: Number(b.wellCount),
			badCount: Number(b.badCount),
			improveCount: Number(b.improveCount)
		}))
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

	// AI-анализ пространства. Доска-анализ — и результат, и запись кеша, и
	// счётчик лимита: см. docs/superpowers/specs/2026-09-16-space-analysis-design.md
	analyze: async ({ request, params, cookies }) => {
		const space = await db.query.spaces.findFirst({
			where: eq(spaces.slug, params.slug)
		});
		if (!space) throw error(404);

		// Доступ как к самому пространству: пароль введён, пароля нет или это создатель
		const creatorCookie = cookies.get(`retro_space_creator_${params.slug}`) ?? '';
		const isCreator = !!space.creatorToken && creatorCookie === space.creatorToken;
		if (space.passwordHash && !cookies.get(`retro_space_${params.slug}`) && !isCreator) {
			throw error(403, 'Not authenticated');
		}

		metric('retro.analysis.requested', 1);
		const failWith = (status: number, kind: string, extra: Record<string, unknown> = {}) => {
			metric(`retro.analysis.failed.${kind}`, 1);
			return fail(status, { analysis: kind, ...extra });
		};

		const apiKey = env.DEEPSEEK_API_KEY || '';
		if (!apiKey) return failWith(503, 'not_configured');

		const formData = await request.formData();
		const locale: AnalysisLocale = formData.get('locale') === 'ru' ? 'ru' : 'en';

		const spaceBoards = await db
			.select({ id: boards.id, slug: boards.slug, title: boards.title, format: boards.format, createdAt: boards.createdAt })
			.from(boards)
			.where(eq(boards.spaceId, space.id))
			.orderBy(desc(boards.createdAt));
		const regular = spaceBoards.filter((b) => !isAnalysisBoard(b));
		const analyses = spaceBoards.filter(isAnalysisBoard);

		// Кеш: новых досок с последнего анализа не было — открываем его
		if (cacheState(regular[0]?.createdAt ?? null, analyses[0]?.createdAt ?? null) === 'fresh') {
			metric('retro.analysis.cached', 1);
			throw redirect(303, `/${analyses[0].slug}`);
		}

		const now = new Date();
		const window = analysesInWindow(analyses, now);
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

		let slug: string;
		try {
			slug = await runOnce(space.id, async () => {
				const started = Date.now();
				const raw = await chatCompletion(buildPrompt(entries, locale), {
					apiKey,
					apiBase: env.DEEPSEEK_API_BASE || undefined
				});
				const result = parseAnalysis(raw);
				if (!result) throw new AnalysisFailure('bad_response');
				if (isEmptyAnalysis(result)) throw new AnalysisFailure('empty');

				const boardSlug = nanoid(21);
				const creatorToken = nanoid(32);
				const author = encrypt(analysisAuthor(locale));
				await db.transaction(async (tx) => {
					const [created] = await tx
						.insert(boards)
						.values({ title: analysisTitle(now, locale), slug: boardSlug, creatorToken, spaceId: space.id, format: ANALYSIS_FORMAT })
						.returning({ id: boards.id });
					const rows = (['well', 'bad', 'improve'] as const).flatMap((key) =>
						result[key].map((item) => ({
							boardId: created.id,
							columnType: ANALYSIS_COLUMNS[key],
							content: encrypt(cardText(item, locale)) ?? '',
							authorName: author
						}))
					);
					if (rows.length) await tx.insert(cards).values(rows);
				});

				// Cookie получает тот, чей запрос реально создал доску; кто ждал замок —
				// просто редиректится на неё
				cookies.set(`retro_creator_${boardSlug}`, creatorToken, {
					path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365
				});
				const ms = Date.now() - started;
				metric('retro.analysis.created', 1);
				metric('retro.analysis.duration_ms', ms, 'ms');
				console.info(JSON.stringify({ event: 'analysis:created', space: params.slug, cards: entries.length, ms }));
				return boardSlug;
			});
		} catch (err) {
			if (err instanceof DeepSeekError) {
				console.warn(JSON.stringify({ event: 'analysis:failed', space: params.slug, kind: err.kind, status: err.status ?? null }));
				return failWith(502, err.kind === 'shape' ? 'bad_response' : err.kind);
			}
			if (err instanceof AnalysisFailure) {
				console.warn(JSON.stringify({ event: 'analysis:failed', space: params.slug, kind: err.kind }));
				return failWith(err.kind === 'empty' ? 422 : 502, err.kind);
			}
			console.error(JSON.stringify({ event: 'analysis:failed', space: params.slug, kind: 'unknown', message: (err as Error)?.message }));
			return failWith(500, 'network');
		}

		throw redirect(303, `/${slug}`);
	}
};
