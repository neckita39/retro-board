import { describe, it, expect, vi } from 'vitest';
import { chatCompletion, DeepSeekError, DEEPSEEK_DEFAULT_BASE } from './deepseek.js';

const messages = [
	{ role: 'system' as const, content: 'sys' },
	{ role: 'user' as const, content: 'usr' }
];

function okResponse(content: string) {
	return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
}

describe('chatCompletion', () => {
	it('шлёт OpenAI-совместимый запрос с ключом, json-режимом и возвращает content', async () => {
		const fetchFn = vi.fn(async () => okResponse('{"well":[]}'));
		const out = await chatCompletion(messages, { apiKey: 'sk-test', fetchFn });
		expect(out).toBe('{"well":[]}');
		expect(fetchFn).toHaveBeenCalledTimes(1);
		const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe(`${DEEPSEEK_DEFAULT_BASE}/chat/completions`);
		expect(init.method).toBe('POST');
		expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
		const body = JSON.parse(init.body as string);
		expect(body.model).toBe('deepseek-chat');
		expect(body.messages).toEqual(messages);
		expect(body.response_format).toEqual({ type: 'json_object' });
		expect(body.stream).toBe(false);
	});

	it('apiBase без хвостового слэша и с ним даёт один URL', async () => {
		const fetchFn = vi.fn(async () => okResponse('x'));
		await chatCompletion(messages, { apiKey: 'k', apiBase: 'http://localhost:4778/', fetchFn });
		expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe('http://localhost:4778/chat/completions');
	});

	it('HTTP-ошибка → DeepSeekError http со статусом', async () => {
		const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }));
		await expect(chatCompletion(messages, { apiKey: 'k', fetchFn })).rejects.toMatchObject({
			kind: 'http',
			status: 500
		});
	});

	it('ответ без choices → DeepSeekError shape', async () => {
		const fetchFn = vi.fn(async () => new Response('{"foo":1}', { status: 200 }));
		await expect(chatCompletion(messages, { apiKey: 'k', fetchFn })).rejects.toMatchObject({ kind: 'shape' });
	});

	it('сетевая ошибка → DeepSeekError network', async () => {
		const fetchFn = vi.fn(async () => {
			throw new TypeError('fetch failed');
		});
		await expect(chatCompletion(messages, { apiKey: 'k', fetchFn })).rejects.toMatchObject({ kind: 'network' });
	});

	it('таймаут → DeepSeekError timeout', async () => {
		const fetchFn = vi.fn(
			(_url: string, init?: RequestInit) =>
				new Promise<Response>((_, reject) => {
					init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
				})
		);
		await expect(
			chatCompletion(messages, { apiKey: 'k', fetchFn: fetchFn as unknown as typeof fetch, timeoutMs: 10 })
		).rejects.toMatchObject({ kind: 'timeout' });
	});

	it('заголовки пришли, а тело не приходит → тоже timeout, а не зависание', async () => {
		// DeepSeek под нагрузкой отдаёт 200 сразу, а потом долго шлёт пустые строки
		const fetchFn = vi.fn((_url: string, init?: RequestInit) =>
			Promise.resolve(
				new Response(
					new ReadableStream({
						start(ctrl) {
							init?.signal?.addEventListener('abort', () => ctrl.error(new DOMException('aborted', 'AbortError')));
						}
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			)
		);
		await expect(
			chatCompletion(messages, { apiKey: 'k', fetchFn: fetchFn as unknown as typeof fetch, timeoutMs: 20 })
		).rejects.toMatchObject({ kind: 'timeout' });
	});

	it('DeepSeekError — это Error с kind', () => {
		const e = new DeepSeekError('http', 'bad', 502);
		expect(e).toBeInstanceOf(Error);
		expect(e.kind).toBe('http');
		expect(e.status).toBe(502);
	});
});
