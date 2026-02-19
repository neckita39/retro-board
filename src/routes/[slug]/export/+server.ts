import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { boards, cards, votes, comments } from '$lib/server/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params, url }) => {
	const format = url.searchParams.get('format') || 'json';
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

	const columnTypes = ['went_well', 'didnt_go_well', 'improve'] as const;
	const columns: Record<string, Array<{
		content: string;
		authorName: string | null;
		likes: number;
		comments: Array<{ content: string; authorName: string | null }>
	}>> = {};

	for (const col of columnTypes) {
		columns[col] = boardCards
			.filter((c) => c.columnType === col)
			.map((card) => ({
				content: card.content,
				authorName: card.authorName,
				likes: boardVotes.filter((v) => v.cardId === card.id && v.type === 'like').length,
				comments: boardComments
					.filter((c) => c.cardId === card.id)
					.map((c) => ({ content: c.content, authorName: c.authorName }))
			}));
	}

	const exported = {
		board: {
			title: board.title,
			slug: board.slug,
			createdAt: board.createdAt.toISOString()
		},
		columns
	};

	const safeTitle = board.title.replace(/[^a-zA-Z0-9_-]/g, '_');

	if (format === 'md') {
		const columnTitles: Record<string, string> = {
			went_well: 'Went Well',
			didnt_go_well: "Didn't Go Well",
			improve: 'To Improve'
		};

		let md = `# ${board.title}\n\n`;
		md += `*Exported: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*\n\n`;
		md += `---\n\n`;

		for (const col of columnTypes) {
			const items = columns[col];
			md += `## ${columnTitles[col]}\n\n`;

			if (items.length === 0) {
				md += `*No cards*\n\n`;
				continue;
			}

			for (const card of items) {
				const author = card.authorName ? ` — *${card.authorName}*` : '';
				const likes = card.likes > 0 ? ` [${card.likes} like${card.likes !== 1 ? 's' : ''}]` : '';
				md += `- ${card.content}${author}${likes}\n`;

				for (const comment of card.comments) {
					const commentAuthor = comment.authorName ? ` — *${comment.authorName}*` : '';
					md += `  - ${comment.content}${commentAuthor}\n`;
				}
			}

			md += `\n`;
		}

		return new Response(md, {
			headers: {
				'Content-Type': 'text/markdown; charset=utf-8',
				'Content-Disposition': `attachment; filename="board-${safeTitle}.md"`
			}
		});
	}

	return new Response(JSON.stringify(exported, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="board-${safeTitle}.json"`
		}
	});
};
