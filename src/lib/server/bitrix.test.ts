import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	BitrixError,
	bitrixRequest,
	callLegacy,
	callV3,
	classifyBitrixError,
	isBlockedHost,
	parseWebhookUrl,
	type BitrixErrorKind,
	type Webhook
} from './bitrix.js';

const CODE = 'k3yS3cr3tC0de9xy';
const WH: Webhook = { url: `https://portal.bitrix24.ru/rest/7/${CODE}/`, portal: 'portal.bitrix24.ru', userId: 7 };

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const legacyError = (code: string, description = 'Ошибка') => ({ error: code, error_description: description });
const v3Error = (code: string, message = 'Ошибка', validation?: { field: string; message: string }[]) => ({
	error: { code, message, ...(validation ? { validation } : {}) }
});

// Подменный fetch: запоминает адрес и init каждого вызова
function fakeFetch(reply: (url: string, init: RequestInit) => Response | Promise<Response>) {
	const calls: { url: string; init: RequestInit }[] = [];
	const fetchFn = (async (url: string, init: RequestInit) => {
		calls.push({ url, init });
		return reply(url, init);
	}) as unknown as typeof fetch;
	return { fetchFn, calls };
}

// fetch, который не отвечает и падает только по отмене сигнала
function hangingFetch() {
	return fakeFetch(
		(_url, init) =>
			new Promise<Response>((_, reject) => {
				init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
			})
	).fetchFn;
}

async function failure(fetchFn: typeof fetch, api: 'legacy' | 'v3' = 'legacy', timeoutMs?: number): Promise<BitrixError> {
	try {
		await bitrixRequest(WH, 'tasks.task.add', {}, api, { fetchFn, timeoutMs });
	} catch (err) {
		if (err instanceof BitrixError) return err;
		throw err;
	}
	throw new Error('ожидали BitrixError');
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.useRealTimers();
});

describe('parseWebhookUrl', () => {
	it('принимает входящий вебхук, приводит хост к нижнему регистру и добавляет завершающий слэш', () => {
		const expected = { url: 'https://portal.bitrix24.ru/rest/7/AbC123xyz/', portal: 'portal.bitrix24.ru', userId: 7 };
		expect(parseWebhookUrl('  https://Portal.Bitrix24.RU/rest/7/AbC123xyz  ', { allowHttp: false })).toEqual(expected);
		expect(parseWebhookUrl('https://portal.bitrix24.ru/rest/7/AbC123xyz/', { allowHttp: false })).toEqual(expected);
	});

	it('нестандартный порт остаётся в адресе и в portal, стандартный — выбрасывается', () => {
		expect(parseWebhookUrl('https://b24.example.com:8443/rest/2/abc/', { allowHttp: false })).toEqual({
			url: 'https://b24.example.com:8443/rest/2/abc/',
			portal: 'b24.example.com:8443',
			userId: 2
		});
		expect(parseWebhookUrl('https://b24.example.com:443/rest/2/abc/', { allowHttp: false })?.portal).toBe('b24.example.com');
	});

	it('http без флага — отказ; с флагом разрешён только http://localhost', () => {
		const local = 'http://localhost:4779/rest/1/testcode/';
		expect(parseWebhookUrl('http://portal.bitrix24.ru/rest/1/abc/', { allowHttp: false })).toBeNull();
		expect(parseWebhookUrl('http://portal.bitrix24.ru/rest/1/abc/', { allowHttp: true })).toBeNull();
		expect(parseWebhookUrl(local, { allowHttp: false })).toBeNull();
		expect(parseWebhookUrl(local, { allowHttp: true })).toEqual({ url: local, portal: 'localhost:4779', userId: 1 });
		expect(parseWebhookUrl('https://localhost:4779/rest/1/testcode/', { allowHttp: true })).toBeNull();
		expect(parseWebhookUrl('http://127.0.0.1:4779/rest/1/testcode/', { allowHttp: true })).toBeNull();
	});

	it('без opts флаг берётся из BITRIX_ALLOW_HTTP', () => {
		const local = 'http://localhost:4779/rest/1/testcode/';
		vi.stubEnv('BITRIX_ALLOW_HTTP', '');
		expect(parseWebhookUrl(local)).toBeNull();
		vi.stubEnv('BITRIX_ALLOW_HTTP', '1');
		expect(parseWebhookUrl(local)).toEqual({ url: local, portal: 'localhost:4779', userId: 1 });
	});

	it.each([
		'https://127.0.0.1/rest/1/abc/',
		'https://2130706433/rest/1/abc/',
		'https://0x7f000001/rest/1/abc/',
		'https://127.1/rest/1/abc/',
		'https://0177.0.0.1/rest/1/abc/',
		'https://10.1.2.3/rest/1/abc/',
		'https://172.20.0.5/rest/1/abc/',
		'https://192.168.0.10/rest/1/abc/',
		'https://169.254.169.254/rest/1/abc/',
		'https://100.100.0.1/rest/1/abc/',
		'https://0.0.0.0/rest/1/abc/',
		'https://[::1]/rest/1/abc/',
		'https://[::]/rest/1/abc/',
		'https://[::ffff:7f00:1]/rest/1/abc/',
		'https://[::ffff:192.168.0.1]/rest/1/abc/',
		'https://[fd12:3456::1]/rest/1/abc/',
		'https://[fe80::1]/rest/1/abc/',
		'https://localhost/rest/1/abc/',
		'https://db/rest/1/abc/',
		'https://netdata./rest/1/abc/',
		'https://printer.local/rest/1/abc/'
	])('приватный или служебный хост %s — отказ', (raw) => {
		expect(parseWebhookUrl(raw, { allowHttp: false })).toBeNull();
	});

	it.each([
		'https://portal.bitrix24.ru/rest/1/abc/profile',
		'https://portal.bitrix24.ru/rest/1/abc/extra/',
		'https://portal.bitrix24.ru/rest/api/1/abc/',
		'https://portal.bitrix24.ru/rest/abc/',
		'https://portal.bitrix24.ru/rest/0/abc/',
		'https://portal.bitrix24.ru/rest/3000000000/abc/',
		'https://portal.bitrix24.ru/rest/1/ab-c/',
		'https://portal.bitrix24.ru/rest/1/abc/?x=1',
		'https://portal.bitrix24.ru/rest/1/abc/?',
		'https://portal.bitrix24.ru/rest/1/abc/#top',
		'https://portal.bitrix24.ru/api/1/abc/',
		'https://user:pass@portal.bitrix24.ru/rest/1/abc/',
		'ftp://portal.bitrix24.ru/rest/1/abc/',
		'portal.bitrix24.ru/rest/1/abc/',
		'не ссылка',
		''
	])('адрес не той формы %s — отказ', (raw) => {
		expect(parseWebhookUrl(raw, { allowHttp: false })).toBeNull();
	});
});

describe('isBlockedHost', () => {
	it.each([
		'localhost',
		'LOCALHOST',
		'db',
		'netdata',
		'app',
		'printer.local',
		'printer.local.',
		'dev.localhost',
		'127.0.0.1',
		'127.1',
		'2130706433',
		'0x7f000001',
		'0.0.0.0',
		'10.0.0.1',
		'100.64.0.1',
		'100.127.255.255',
		'127.255.255.254',
		'169.254.169.254',
		'172.16.0.1',
		'172.31.255.255',
		'192.168.1.1',
		'[::]',
		'[::1]',
		'::1',
		'[::ffff:7f00:1]',
		'[::ffff:a00:1]',
		'[::ffff:c0a8:1]',
		'[fc00::1]',
		'[fdff::1]',
		'[fe80::1]',
		'[febf::1]',
		'',
		'evil.com:80',
		'bad host.ru'
	])('%s — закрыт', (host) => {
		expect(isBlockedHost(host)).toBe(true);
	});

	it.each([
		'portal.bitrix24.ru',
		'bitrix24.team',
		'b24-abc123.bitrix24.com',
		'8.8.8.8',
		'11.0.0.1',
		'100.63.255.255',
		'100.128.0.1',
		'169.255.0.1',
		'172.15.255.255',
		'172.32.0.1',
		'192.169.0.1',
		'[2a00:1450:4001::1]',
		'[::ffff:808:808]',
		'[fec0::1]'
	])('%s — открыт', (host) => {
		expect(isBlockedHost(host)).toBe(false);
	});

	it('localhost закрыт и в тестовом режиме: пропускает его только parseWebhookUrl с allowHttp', () => {
		vi.stubEnv('BITRIX_ALLOW_HTTP', '1');
		expect(isBlockedHost('localhost')).toBe(true);
	});
});

describe('транспорт', () => {
	it('callLegacy: POST JSON на адрес вебхука с redirect manual, возвращает result', async () => {
		const { fetchFn, calls } = fakeFetch(() => json({ result: { ID: '7' } }));
		const out = await callLegacy(WH, 'profile', { a: 1 }, { fetchFn, idempotencyKey: 'ignored' });

		expect(out).toEqual({ ID: '7' });
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(`https://portal.bitrix24.ru/rest/7/${CODE}/profile`);
		expect(calls[0].init.method).toBe('POST');
		expect(calls[0].init.redirect).toBe('manual');
		expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
		const headers = calls[0].init.headers as Record<string, string>;
		expect(headers['Content-Type']).toBe('application/json');
		expect(headers.Accept).toBe('application/json');
		expect(headers['Idempotency-Key']).toBeUndefined();
		expect(JSON.parse(calls[0].init.body as string)).toEqual({ a: 1 });
	});

	it('callV3: адрес с /rest/api/, заголовок Idempotency-Key, возвращает result целиком', async () => {
		const item = { id: 745181, link: '/workgroups/group/2014/tasks/task/view/745181/' };
		const { fetchFn, calls } = fakeFetch(() => json({ result: { item } }));
		const out = await callV3(WH, 'tasks.task.add', { fields: { title: 'Починить CI' } }, { fetchFn, idempotencyKey: 'abc123' });

		expect(out).toEqual({ item });
		expect(calls[0].url).toBe(`https://portal.bitrix24.ru/rest/api/7/${CODE}/tasks.task.add`);
		expect(calls[0].init.method).toBe('POST');
		expect(calls[0].init.redirect).toBe('manual');
		expect((calls[0].init.headers as Record<string, string>)['Idempotency-Key']).toBe('abc123');
		expect(JSON.parse(calls[0].init.body as string)).toEqual({ fields: { title: 'Починить CI' } });
	});

	it('callV3 без ключа идемпотентности заголовок не шлёт', async () => {
		const { fetchFn, calls } = fakeFetch(() => json({ result: { item: { id: 1 } } }));
		await callV3(WH, 'tasks.task.field.list', {}, { fetchFn });
		expect((calls[0].init.headers as Record<string, string>)['Idempotency-Key']).toBeUndefined();
	});

	it('bitrixRequest отдаёт result и time.date_finish; result false — тоже успех', async () => {
		const { fetchFn } = fakeFetch(() =>
			json({ result: { ID: '1' }, time: { start: 1, date_finish: '2026-09-17T12:00:00+02:00' } })
		);
		await expect(bitrixRequest(WH, 'profile', {}, 'legacy', { fetchFn })).resolves.toEqual({
			result: { ID: '1' },
			time: { date_finish: '2026-09-17T12:00:00+02:00' }
		});

		const noTime = fakeFetch(() => json({ result: false }));
		const res = await bitrixRequest(WH, 'tasks.task.file.attach', {}, 'v3', { fetchFn: noTime.fetchFn });
		expect(res.result).toBe(false);
		expect(res.time).toBeUndefined();
	});

	it('ошибка определяется по ключу error, а не по статусу', async () => {
		const at200 = await failure(fakeFetch(() => json(legacyError('QUERY_LIMIT_EXCEEDED', 'Too many requests'), 200)).fetchFn);
		expect(at200).toMatchObject({ kind: 'limit', code: 'QUERY_LIMIT_EXCEEDED', status: 200, message: 'Too many requests' });

		const emptyCode = await failure(fakeFetch(() => json(legacyError('', 'Not found'), 400)).fetchFn);
		expect(emptyCode).toMatchObject({ kind: 'rejected', status: 400, message: 'Not found' });
		expect(emptyCode.code).toBeUndefined();
	});

	it('3xx → invalid_webhook, за редиректом не идём', async () => {
		const { fetchFn, calls } = fakeFetch(() => new Response(null, { status: 301, headers: { location: 'http://10.0.0.1/' } }));
		expect(await failure(fetchFn)).toMatchObject({ kind: 'invalid_webhook', status: 301 });
		expect(calls).toHaveLength(1);
	});

	it('тело больше 1 МБ → shape: по заголовку и по фактическому размеру', async () => {
		const declared = await failure(
			fakeFetch(() => new Response('{"result":1}', { headers: { 'content-length': String(5 * 1024 * 1024) } })).fetchFn
		);
		expect(declared.kind).toBe('shape');

		const streamed = await failure(fakeFetch(() => json({ result: 'x'.repeat(1024 * 1024) })).fetchFn);
		expect(streamed.kind).toBe('shape');
	});

	it('не-JSON → shape со статусом', async () => {
		const err = await failure(fakeFetch(() => new Response('<html>502 Bad Gateway</html>', { status: 502 })).fetchFn);
		expect(err).toMatchObject({ kind: 'shape', status: 502 });
	});

	it('JSON без result и без error → shape', async () => {
		expect((await failure(fakeFetch(() => json({ foo: 1 })).fetchFn)).kind).toBe('shape');
		expect((await failure(fakeFetch(() => json([1, 2])).fetchFn)).kind).toBe('shape');
		expect((await failure(fakeFetch(() => json(null)).fetchFn)).kind).toBe('shape');
	});

	it('сетевой сбой → network', async () => {
		const { fetchFn } = fakeFetch(() => {
			throw new TypeError('fetch failed');
		});
		expect((await failure(fetchFn)).kind).toBe('network');
	});

	it('нет ответа до таймаута → timeout', async () => {
		expect((await failure(hangingFetch(), 'legacy', 10)).kind).toBe('timeout');
	});

	it('заголовки пришли, а тело не дочитано до таймаута → timeout', async () => {
		const { fetchFn } = fakeFetch(
			(_url, init) =>
				new Response(
					new ReadableStream({
						start(ctrl) {
							init.signal?.addEventListener('abort', () => ctrl.error(new DOMException('aborted', 'AbortError')));
						}
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
		);
		expect((await failure(fetchFn, 'v3', 20)).kind).toBe('timeout');
	});

	it('таймаут по умолчанию — 15 секунд', async () => {
		vi.useFakeTimers();
		let settled = false;
		const pending = callLegacy(WH, 'profile', {}, { fetchFn: hangingFetch() }).catch((err: unknown) => err);
		void pending.then(() => (settled = true));

		await vi.advanceTimersByTimeAsync(14_999);
		expect(settled).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		const err = await pending;
		expect(err).toBeInstanceOf(BitrixError);
		expect((err as BitrixError).kind).toBe('timeout');
	});

	it('после ответа таймер снят', async () => {
		vi.useFakeTimers();
		await callLegacy(WH, 'profile', {}, { fetchFn: fakeFetch(() => json({ result: {} })).fetchFn });
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('коды портала → виды ошибок', () => {
	interface CodeCase {
		name: string;
		body: Record<string, unknown>;
		status: number;
		api: 'legacy' | 'v3';
		kind: BitrixErrorKind;
	}
	const V3 = 'BITRIX_REST_V3_EXCEPTION_';
	const cases: CodeCase[] = [
		{ name: 'INVALID_CREDENTIALS', body: legacyError('INVALID_CREDENTIALS'), status: 401, api: 'legacy', kind: 'invalid_webhook' },
		{ name: 'NO_AUTH_FOUND', body: legacyError('NO_AUTH_FOUND'), status: 401, api: 'v3', kind: 'invalid_webhook' },
		{ name: 'insufficient_scope', body: legacyError('insufficient_scope'), status: 401, api: 'legacy', kind: 'scope' },
		{ name: 'INSUFFICIENTSCOPEEXCEPTION', body: v3Error(`${V3}INSUFFICIENTSCOPEEXCEPTION`), status: 403, api: 'v3', kind: 'scope' },
		{ name: 'ERROR_METHOD_NOT_FOUND на v3', body: legacyError('ERROR_METHOD_NOT_FOUND'), status: 404, api: 'v3', kind: 'scope' },
		{ name: 'ERROR_METHOD_NOT_FOUND на старом REST', body: legacyError('ERROR_METHOD_NOT_FOUND'), status: 404, api: 'legacy', kind: 'rejected' },
		{ name: 'ACCESS_DENIED', body: legacyError('ACCESS_DENIED'), status: 401, api: 'legacy', kind: 'access' },
		{ name: 'ACCESSDENIEDEXCEPTION', body: v3Error(`${V3}ACCESSDENIEDEXCEPTION`, 'Доступ запрещен'), status: 403, api: 'v3', kind: 'access' },
		{ name: 'OVERLOAD_LIMIT', body: legacyError('OVERLOAD_LIMIT'), status: 401, api: 'legacy', kind: 'access' },
		{ name: 'PORTAL_DELETED', body: legacyError('PORTAL_DELETED'), status: 403, api: 'legacy', kind: 'access' },
		{ name: 'QUERY_LIMIT_EXCEEDED', body: legacyError('QUERY_LIMIT_EXCEEDED'), status: 503, api: 'v3', kind: 'limit' },
		{ name: 'OPERATION_TIME_LIMIT', body: legacyError('OPERATION_TIME_LIMIT'), status: 429, api: 'legacy', kind: 'limit' },
		{ name: 'VALIDATION_DTOVALIDATIONEXCEPTION', body: v3Error(`${V3}VALIDATION_DTOVALIDATIONEXCEPTION`), status: 400, api: 'v3', kind: 'rejected' },
		{ name: 'ERROR_CORE', body: legacyError('ERROR_CORE'), status: 400, api: 'legacy', kind: 'rejected' },
		{ name: 'неизвестный код', body: v3Error('SOMETHING_NEW'), status: 422, api: 'v3', kind: 'rejected' }
	];

	it.each(cases)('$name ($api, $status) → $kind', async ({ body, status, api, kind }) => {
		const err = await failure(fakeFetch(() => json(body, status)).fetchFn, api);
		expect(err).toBeInstanceOf(BitrixError);
		expect(err.kind).toBe(kind);
		expect(err.status).toBe(status);
	});

	it('ошибка строкой: code из error, текст из error_description', async () => {
		const err = await failure(fakeFetch(() => json(legacyError('ERROR_CORE', 'Задача не найдена'), 400)).fetchFn);
		expect(err).toMatchObject({ kind: 'rejected', code: 'ERROR_CORE', message: 'Задача не найдена' });
	});

	it('ошибка объектом v3: code, message и field из validation[0]', async () => {
		const body = v3Error(`${V3}VALIDATION_DTOVALIDATIONEXCEPTION`, 'Ошибка валидации.', [
			{ field: 'title', message: 'Поле "title" обязательно' }
		]);
		const err = await failure(fakeFetch(() => json(body, 400)).fetchFn, 'v3');
		expect(err).toMatchObject({
			kind: 'rejected',
			code: `${V3}VALIDATION_DTOVALIDATIONEXCEPTION`,
			field: 'title',
			message: 'Ошибка валидации: Поле "title" обязательно'
		});
	});

	it('текст портала без <br>, обрезан до 300 символов', async () => {
		const br = await failure(fakeFetch(() => json(legacyError('ERROR_CORE', 'Первая строка<br>Вторая<BR />третья'), 400)).fetchFn);
		expect(br.message).toBe('Первая строка Вторая третья');

		const long = await failure(fakeFetch(() => json(legacyError('ERROR_CORE', 'я'.repeat(500)), 400)).fetchFn);
		expect(long.message).toHaveLength(300);
	});

	it('classifyBitrixError работает и без транспорта', () => {
		const err = classifyBitrixError(legacyError('ACCESS_DENIED', 'REST is available only by subscription'), 401, 'v3');
		expect(err).toBeInstanceOf(BitrixError);
		expect(err).toMatchObject({ kind: 'access', code: 'ACCESS_DENIED', status: 401 });
		expect(err.field).toBeUndefined();
	});
});

describe('секрет вебхука', () => {
	it('не попадает в message, stack и сериализацию ни при одном виде ошибки', async () => {
		const failures = [
			await failure(
				fakeFetch(() => {
					throw new TypeError(`fetch failed: ${WH.url}profile`);
				}).fetchFn
			),
			await failure(fakeFetch(() => new Response(null, { status: 302, headers: { location: WH.url } })).fetchFn),
			await failure(fakeFetch(() => new Response(`<html>${WH.url}</html>`, { status: 500 })).fetchFn),
			await failure(fakeFetch(() => json({ foo: WH.url })).fetchFn),
			await failure(fakeFetch(() => json(legacyError('INVALID_CREDENTIALS', `Webhook ${WH.url} (${CODE}) not found`), 401)).fetchFn),
			await failure(
				fakeFetch(() => json(v3Error('BITRIX_REST_V3_EXCEPTION_VALIDATION_X', CODE, [{ field: 'title', message: WH.url }]), 400))
					.fetchFn,
				'v3'
			),
			await failure(hangingFetch(), 'v3', 5)
		];

		expect(failures.map((e) => e.kind)).toEqual([
			'network',
			'invalid_webhook',
			'shape',
			'shape',
			'invalid_webhook',
			'rejected',
			'timeout'
		]);
		for (const err of failures) {
			expect(err.message).not.toContain(CODE);
			expect(String(err.stack)).not.toContain(CODE);
			expect(JSON.stringify(err)).not.toContain(CODE);
		}
	});
});

describe('BitrixError', () => {
	it('это Error с kind, code, status и field', () => {
		const err = new BitrixError('rejected', 'Портал отклонил', { code: 'ERROR_CORE', status: 400, field: 'title' });
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe('BitrixError');
		expect(err).toMatchObject({ kind: 'rejected', code: 'ERROR_CORE', status: 400, field: 'title', message: 'Портал отклонил' });
		expect(new BitrixError('network', 'нет связи').code).toBeUndefined();
	});
});
