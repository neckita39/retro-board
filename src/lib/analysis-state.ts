// Состояние AI-анализа пространства, общее для сервера и клиента: то, что
// приходит по сокету и из GET /spaces/{slug}/analysis, и правило, когда
// смена состояния заслуживает уведомления.
export type AnalysisState =
	| { state: 'idle' }
	| { state: 'pending'; id: string; title: string; createdAt: string }
	| { state: 'ready'; id: string; title: string; createdAt: string; board: { slug: string; title: string } }
	| { state: 'failed'; id: string; title: string; createdAt: string; error: string };

export type AnalysisTransition = 'started' | 'ready' | 'failed';

/** pending старше этого — сервер перезапустился посреди работы, задача потеряна */
export const PENDING_STALE_MS = 5 * 60_000;

/**
 * null — молчим: первое применение (страница только загрузилась), то же
 * состояние повторно, или переход в idle. Иначе — какое уведомление показать.
 */
export function analysisTransition(prev: AnalysisState | null, next: AnalysisState): AnalysisTransition | null {
	if (!prev) return null;
	if (next.state === 'idle') return null;
	if (prev.state === next.state && 'id' in prev && prev.id === next.id) return null;
	if (next.state === 'pending') return 'started';
	return next.state;
}
