import { db } from '$lib/server/db/index.js';
import { boards, cards, votes, comments } from '$lib/server/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { decrypt } from '$lib/server/crypto.js';
import { translate, type Locale } from '$lib/i18n/index.js';
import { createRateLimiter } from '$lib/server/ratelimit.js';
import { findBoardFormat } from '$lib/formats.js';
import { viewCards, visibleComments } from '$lib/blind.js';
import type { CardTask } from '$lib/types.js';

// Shared across export.md / export.json routes: 30 requests per IP per minute
export const exportRateLimiter = createRateLimiter({ max: 30, windowMs: 60_000 });

export interface ExportComment {
	content: string;
	authorName: string | null;
	imageUrl: string | null;
	createdAt: string;
}

export interface ExportCard {
	content: string;
	authorName: string | null;
	likes: number;
	dislikes: number;
	imageUrl: string | null;
	/** Задача Битрикс24 карточки; null — задачи нет */
	task: CardTask | null;
	createdAt: string;
	comments: ExportComment[];
}

export interface BoardExport {
	board: { title: string; slug: string; format: string; createdAt: string };
	columns: Record<string, ExportCard[]>;
}

// Structural row types — compatible with Drizzle rows, keeps assembleExport testable without a DB
interface BoardRow {
	title: string;
	slug: string;
	format: string;
	createdAt: Date;
}
interface CardRow {
	id: string;
	columnType: string;
	content: string;
	authorName: string | null;
	imageId: string | null;
	bitrixTaskId: number | null;
	bitrixTaskUrl: string | null;
	createdAt: Date;
}
interface VoteRow {
	cardId: string;
	type: string;
}
interface CommentRow {
	cardId: string;
	content: string;
	authorName: string | null;
	imageId: string | null;
	createdAt: Date;
}

export function assembleExport(
	board: BoardRow,
	boardCards: CardRow[],
	boardVotes: VoteRow[],
	boardComments: CommentRow[],
	origin: string
): BoardExport {
	const imageUrl = (id: string | null) => (id ? `${origin}/api/image/${id}` : null);
	const format = findBoardFormat(board.format);
	const columns: Record<string, ExportCard[]> = {};
	for (const col of format.columns) {
		columns[col.id] = boardCards
			.filter((c) => c.columnType === col.id)
			.map((card) => ({
				content: decrypt(card.content) ?? card.content,
				authorName: decrypt(card.authorName),
				likes: boardVotes.filter((v) => v.cardId === card.id && v.type === 'like').length,
				dislikes: boardVotes.filter((v) => v.cardId === card.id && v.type === 'dislike').length,
				imageUrl: imageUrl(card.imageId),
				task:
					card.bitrixTaskId !== null && card.bitrixTaskUrl
						? { id: card.bitrixTaskId, url: card.bitrixTaskUrl }
						: null,
				createdAt: card.createdAt.toISOString(),
				comments: boardComments
					.filter((c) => c.cardId === card.id)
					.map((c) => ({
						content: decrypt(c.content) ?? c.content,
						authorName: decrypt(c.authorName),
						imageUrl: imageUrl(c.imageId),
						createdAt: c.createdAt.toISOString()
					}))
			}));
	}
	return {
		board: { title: board.title, slug: board.slug, format: format.id, createdAt: board.createdAt.toISOString() },
		columns
	};
}

export async function loadBoardExport(slug: string, origin: string): Promise<BoardExport | null> {
	const board = await db.query.boards.findFirst({ where: eq(boards.slug, slug) });
	if (!board) return null;

	const boardCards = await db.query.cards.findMany({ where: eq(cards.boardId, board.id) });
	const cardIds = boardCards.map((c) => c.id);
	let boardVotes: (typeof votes.$inferSelect)[] = [];
	let boardComments: (typeof comments.$inferSelect)[] = [];

	if (cardIds.length > 0) {
		[boardVotes, boardComments] = await Promise.all([
			db.select().from(votes).where(inArray(votes.cardId, cardIds)),
			db.select().from(comments).where(inArray(comments.cardId, cardIds))
		]);
	}

	// Пока слепой ввод включён, карточки видны только авторам — значит и в экспорте
	// их текста быть не должно, иначе режим обходится одной ссылкой
	const visible = viewCards(boardCards, board.blind, '');
	return assembleExport(board, visible, boardVotes, visibleComments(boardComments, visible), origin);
}

export function toMarkdown(data: BoardExport, lang: Locale = 'en'): string {
	let md = `# ${data.board.title}\n\n`;
	md += `*${translate(lang, 'apiExport.exported')}: ${new Date().toISOString().slice(0, 10)}*\n\n`;
	md += `---\n\n`;

	for (const col of findBoardFormat(data.board.format).columns) {
		const items = data.columns[col.id] ?? [];
		md += `## ${lang === 'ru' ? col.title.ru : col.title.en}\n\n`;

		if (items.length === 0) {
			md += `*${translate(lang, 'apiExport.noCards')}*\n\n`;
			continue;
		}

		for (const card of items) {
			const author = card.authorName ? ` — *${card.authorName}*` : '';
			const voteParts: string[] = [];
			if (card.likes > 0) voteParts.push(translate(lang, 'apiExport.likes', { n: card.likes }));
			if (card.dislikes > 0) voteParts.push(translate(lang, 'apiExport.dislikes', { n: card.dislikes }));
			const voteSuffix = voteParts.length > 0 ? ` [${voteParts.join(', ')}]` : '';
			md += `- ${card.content}${author}${voteSuffix}\n`;

			if (card.imageUrl) {
				md += `  ![image](${card.imageUrl})\n`;
			}

			if (card.task) {
				md += `  [${translate(lang, 'apiExport.task')} #${card.task.id}](${card.task.url})\n`;
			}

			for (const comment of card.comments) {
				const commentAuthor = comment.authorName ? ` — *${comment.authorName}*` : '';
				const commentImage = comment.imageUrl ? ` ![image](${comment.imageUrl})` : '';
				md += `  - ${comment.content}${commentAuthor}${commentImage}\n`;
			}
		}

		md += `\n`;
	}

	return md;
}
