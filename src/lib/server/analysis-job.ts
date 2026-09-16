// Фоновая часть анализа: DeepSeek → доска с карточками → запись ready, или
// запись failed. Запускается из action без ожидания; о результате всем в
// пространстве сообщает шина. Ключ и текст карточек в логи не попадают.
import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { boards, cards, spaceAnalyses } from './db/schema.js';
import { ANALYSIS_FORMAT } from '$lib/formats.js';
import { encrypt } from './crypto.js';
import { metric } from './statsd.js';
import { emitSpace } from './bus.js';
import { chatCompletion, DeepSeekError } from './deepseek.js';
import {
	ANALYSIS_COLUMNS,
	AnalysisFailure,
	analysisAuthor,
	buildPrompt,
	cardText,
	isEmptyAnalysis,
	parseAnalysis,
	rowToState,
	type AnalysisEntry,
	type AnalysisLocale,
	type AnalysisRow
} from './analysis.js';

export interface AnalysisJobInput {
	row: AnalysisRow & { spaceId: string; creatorToken: string };
	spaceSlug: string;
	entries: AnalysisEntry[];
	locale: AnalysisLocale;
	apiKey: string;
	apiBase?: string;
}

function failureKind(err: unknown): string {
	if (err instanceof DeepSeekError) return err.kind === 'shape' ? 'bad_response' : err.kind;
	if (err instanceof AnalysisFailure) return err.kind;
	return 'network';
}

export async function runAnalysisJob(input: AnalysisJobInput): Promise<void> {
	const { row, spaceSlug, entries, locale } = input;
	const started = Date.now();
	try {
		const raw = await chatCompletion(buildPrompt(entries, locale), { apiKey: input.apiKey, apiBase: input.apiBase });
		const result = parseAnalysis(raw);
		if (!result) throw new AnalysisFailure('bad_response');
		if (isEmptyAnalysis(result)) throw new AnalysisFailure('empty');

		const author = encrypt(analysisAuthor(locale));
		const finishedAt = new Date();
		let boardId = '';
		await db.transaction(async (tx) => {
			const [created] = await tx
				.insert(boards)
				.values({ title: row.title, slug: row.boardSlug, creatorToken: row.creatorToken, spaceId: row.spaceId, format: ANALYSIS_FORMAT })
				.returning({ id: boards.id });
			boardId = created.id;
			const rows = (['well', 'bad', 'improve'] as const).flatMap((key) =>
				result[key].map((item) => ({
					boardId: created.id,
					columnType: ANALYSIS_COLUMNS[key],
					content: encrypt(cardText(item, locale)) ?? '',
					authorName: author
				}))
			);
			if (rows.length) await tx.insert(cards).values(rows);
			await tx.update(spaceAnalyses).set({ state: 'ready', boardId: created.id, finishedAt }).where(eq(spaceAnalyses.id, row.id));
		});

		const ms = Date.now() - started;
		metric('retro.analysis.created', 1);
		metric('retro.analysis.duration_ms', ms, 'ms');
		console.info(JSON.stringify({ event: 'analysis:created', space: spaceSlug, cards: entries.length, ms }));
		emitSpace(spaceSlug, 'analysis:state', rowToState({ ...row, state: 'ready', boardId }, finishedAt));
	} catch (err) {
		const kind = failureKind(err);
		metric(`retro.analysis.failed.${kind}`, 1);
		console.warn(JSON.stringify({ event: 'analysis:failed', space: spaceSlug, kind, status: (err as DeepSeekError)?.status ?? null }));
		const finishedAt = new Date();
		try {
			await db.update(spaceAnalyses).set({ state: 'failed', error: kind, finishedAt }).where(eq(spaceAnalyses.id, row.id));
		} catch (dbErr) {
			console.error(JSON.stringify({ event: 'analysis:failed', space: spaceSlug, kind: 'db', message: (dbErr as Error)?.message }));
		}
		emitSpace(spaceSlug, 'analysis:state', rowToState({ ...row, state: 'failed', error: kind }, finishedAt));
	}
}
