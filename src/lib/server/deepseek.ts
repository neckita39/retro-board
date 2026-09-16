// Тонкий клиент DeepSeek (OpenAI-совместимый chat/completions). Ключ и текст
// карточек в ошибки и логи не попадают — только вид ошибки и статус.
import type { ChatMessage } from './analysis.js';

export type DeepSeekErrorKind = 'network' | 'timeout' | 'http' | 'shape';

export class DeepSeekError extends Error {
	constructor(
		public kind: DeepSeekErrorKind,
		message: string,
		public status?: number
	) {
		super(message);
	}
}

export interface DeepSeekOptions {
	apiKey: string;
	apiBase?: string;
	timeoutMs?: number;
	fetchFn?: typeof fetch;
}

export const DEEPSEEK_DEFAULT_BASE = 'https://api.deepseek.com';
const DEFAULT_TIMEOUT_MS = 60_000;

export async function chatCompletion(messages: ChatMessage[], opts: DeepSeekOptions): Promise<string> {
	const base = (opts.apiBase || DEEPSEEK_DEFAULT_BASE).replace(/\/+$/, '');
	const fetchFn = opts.fetchFn ?? fetch;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

	let res: Response;
	try {
		res = await fetchFn(`${base}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${opts.apiKey}`
			},
			body: JSON.stringify({
				model: 'deepseek-chat',
				messages,
				response_format: { type: 'json_object' },
				temperature: 0.3,
				max_tokens: 2000,
				stream: false
			}),
			signal: controller.signal
		});
	} catch (err) {
		const aborted = (err as { name?: string })?.name === 'AbortError';
		throw new DeepSeekError(aborted ? 'timeout' : 'network', aborted ? 'DeepSeek timed out' : 'DeepSeek unreachable');
	} finally {
		clearTimeout(timer);
	}

	if (!res.ok) throw new DeepSeekError('http', `DeepSeek HTTP ${res.status}`, res.status);

	let data: unknown;
	try {
		data = await res.json();
	} catch {
		throw new DeepSeekError('shape', 'DeepSeek returned non-JSON body');
	}
	const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
	if (typeof content !== 'string') throw new DeepSeekError('shape', 'DeepSeek response has no content');
	return content;
}
