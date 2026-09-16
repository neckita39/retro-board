// Read-only API пространства: список досок и все AI-анализы, JSON или Markdown.
// Сборка чистая (тестируется без БД), загрузка и охрана паролем — ниже.
import { error } from '@sveltejs/kit';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from './db/index.js';
import { boards, cards, comments, spaces, votes } from './db/schema.js';
import { translate, type Locale } from '$lib/i18n/index.js';
import { ANALYSIS_FORMAT } from '$lib/formats.js';
import { verifyPassword } from './password.js';
import { assembleExport, exportRateLimiter, toMarkdown, type BoardExport } from './export.js';

export interface SpaceInfo {
	slug: string;
	name: string;
	createdAt: string;
}

export interface SpaceBoardItem {
	slug: string;
	title: string;
	format: string;
	createdAt: string;
	url: string;
}

export interface SpaceBoardsExport {
	space: SpaceInfo;
	boards: SpaceBoardItem[];
}

export interface SpaceAnalysesExport {
	space: SpaceInfo;
	analyses: BoardExport[];
}

interface SpaceRow {
	slug: string;
	name: string;
	createdAt: Date;
}

interface BoardRow {
	slug: string;
	title: string;
	format: string;
	createdAt: Date;
}

function spaceInfo(space: SpaceRow): SpaceInfo {
	return { slug: space.slug, name: space.name, createdAt: space.createdAt.toISOString() };
}

export function assembleSpaceBoards(space: SpaceRow, rows: BoardRow[], origin: string): SpaceBoardsExport {
	const sorted = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	return {
		space: spaceInfo(space),
		boards: sorted.map((b) => ({
			slug: b.slug,
			title: b.title,
			format: b.format,
			createdAt: b.createdAt.toISOString(),
			url: `${origin}/${b.slug}`
		}))
	};
}

export function spaceBoardsToMarkdown(data: SpaceBoardsExport, lang: Locale = 'en'): string {
	let md = `# ${data.space.name}\n\n`;
	md += `*${translate(lang, 'apiExport.exported')}: ${new Date().toISOString().slice(0, 10)}*\n\n`;
	if (data.boards.length === 0) return md + `*${translate(lang, 'apiExport.noBoards')}*\n`;
	for (const b of data.boards) {
		md += `- [${b.title}](${b.url}) — ${b.createdAt.slice(0, 10)} · ${b.format}\n`;
	}
	return md;
}

export function spaceAnalysesToMarkdown(data: SpaceAnalysesExport, lang: Locale = 'en'): string {
	let md = `# ${data.space.name} — ${translate(lang, 'apiExport.analyses')}\n\n`;
	if (data.analyses.length === 0) return md + `*${translate(lang, 'apiExport.noAnalyses')}*\n`;
	// Каждый анализ — обычный экспорт доски с заголовками на уровень ниже
	return (
		md +
		data.analyses
			.map((a) => toMarkdown(a, lang).replace(/^(#+ )/gm, '#$1'))
			.join('\n---\n\n')
	);
}

/**
 * Пространство для API: лимит запросов, 404, и пароль там, где он есть.
 * Пароль — заголовок X-Space-Password или ?password=; без него 401, неверный — 403.
 */
export async function spaceForApi(opts: {
	slug: string;
	request: Request;
	url: URL;
	ip: string;
}): Promise<typeof spaces.$inferSelect> {
	if (!exportRateLimiter.check(opts.ip)) throw error(429, 'Too many requests');
	const space = await db.query.spaces.findFirst({ where: eq(spaces.slug, opts.slug) });
	if (!space) throw error(404, 'Space not found');
	if (space.passwordHash) {
		const password = opts.request.headers.get('x-space-password') ?? opts.url.searchParams.get('password') ?? '';
		if (!password) throw error(401, 'Password required');
		if (!(await verifyPassword(password, space.passwordHash))) throw error(403, 'Wrong password');
	}
	return space;
}

export async function loadSpaceBoards(space: SpaceRow & { id: string }, origin: string): Promise<SpaceBoardsExport> {
	const rows = await db
		.select({ slug: boards.slug, title: boards.title, format: boards.format, createdAt: boards.createdAt })
		.from(boards)
		.where(eq(boards.spaceId, space.id))
		.orderBy(desc(boards.createdAt));
	return assembleSpaceBoards(space, rows, origin);
}

export async function loadSpaceAnalyses(space: SpaceRow & { id: string }, origin: string): Promise<SpaceAnalysesExport> {
	const analysisBoards = await db
		.select()
		.from(boards)
		.where(and(eq(boards.spaceId, space.id), eq(boards.format, ANALYSIS_FORMAT)))
		.orderBy(desc(boards.createdAt));
	const boardIds = analysisBoards.map((b) => b.id);
	const allCards = boardIds.length ? await db.select().from(cards).where(inArray(cards.boardId, boardIds)) : [];
	const cardIds = allCards.map((c) => c.id);
	const [allVotes, allComments] = cardIds.length
		? await Promise.all([
				db.select().from(votes).where(inArray(votes.cardId, cardIds)),
				db.select().from(comments).where(inArray(comments.cardId, cardIds))
			])
		: [[], []];

	return {
		space: spaceInfo(space),
		analyses: analysisBoards.map((b) => {
			const own = allCards.filter((c) => c.boardId === b.id);
			const ownIds = new Set(own.map((c) => c.id));
			return assembleExport(
				b,
				own,
				allVotes.filter((v) => ownIds.has(v.cardId)),
				allComments.filter((c) => ownIds.has(c.cardId)),
				origin
			);
		})
	};
}
