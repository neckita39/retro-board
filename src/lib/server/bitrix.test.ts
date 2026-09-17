import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	BitrixError,
	bitrixRequest,
	callLegacy,
	callV3,
	classifyBitrixError,
	isBlockedHost,
	parseWebhookUrl,
	verifyWebhook,
	checkTasksScope,
	resolveGroup,
	deadlineIso,
	idempotencyKey,
	createTask,
	tagTask,
	IMAGE_MAX_BYTES,
	withUploadSlot,
	attachImage,
	type BitrixErrorKind,
	type TaskFields,
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

describe('Битрикс24: функции портала', () => {
	const hook: Webhook = { url: 'https://bitrix24.team/rest/1/abc123secret/', portal: 'bitrix24.team', userId: 1 };
	const time = { start: 1, finish: 2, duration: 1, date_start: '2026-09-17T12:36:12+03:00', date_finish: '2026-09-17T12:36:12+03:00' };

	interface PortalCall {
		url: string;
		body: Record<string, any>;
		headers: Headers;
	}

	function reply(body: unknown, status = 200) {
		return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
	}

	// Подменный fetch: пишет вызовы и отвечает по имени метода (последний сегмент адреса).
	// init передаётся обработчику, чтобы тест мог дождаться обрыва по signal
	function portal(
		handler: (method: string, body: Record<string, any>, init?: RequestInit) => Response | Promise<Response>
	) {
		const calls: PortalCall[] = [];
		const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			const url = String(input);
			const body = JSON.parse(String(init?.body ?? '{}'));
			calls.push({ url, body, headers: new Headers(init?.headers) });
			return handler(url.slice(url.lastIndexOf('/') + 1), body, init);
		});
		return { calls, opts: { fetchFn: fetchFn as unknown as typeof fetch } };
	}

	const fields = (over: Partial<TaskFields> = {}): TaskFields => ({
		title: 'Починить деплой',
		description: 'Деплой падает по пятницам\n\nИз ретро «Спринт 42»',
		groupId: null,
		deadline: null,
		important: false,
		...over
	});

	describe('verifyWebhook', () => {
		it('берёт владельца, зону и смещение портала из profile старым REST', async () => {
			const { calls, opts } = portal(() =>
				reply({ result: { ID: '1', NAME: 'Анна', LAST_NAME: 'Петрова', TIME_ZONE: 'Europe/Kaliningrad' }, time })
			);
			await expect(verifyWebhook(hook, opts)).resolves.toEqual({
				userId: 1,
				userName: 'Анна Петрова',
				timeZone: 'Europe/Kaliningrad',
				portalOffset: '+03:00'
			});
			expect(calls).toHaveLength(1);
			expect(calls[0].url).toBe('https://bitrix24.team/rest/1/abc123secret/profile');
		});

		it('пустая зона → null, нет time → portalOffset null, имя без фамилии', async () => {
			const { opts } = portal(() => reply({ result: { ID: '7', NAME: 'Анна', LAST_NAME: '', TIME_ZONE: '' } }));
			await expect(verifyWebhook(hook, opts)).resolves.toEqual({
				userId: 7,
				userName: 'Анна',
				timeZone: null,
				portalOffset: null
			});
		});

		it('date_finish в UTC с Z → +00:00', async () => {
			const { opts } = portal(() =>
				reply({ result: { ID: '1', NAME: 'Анна', TIME_ZONE: '' }, time: { date_finish: '2026-09-17T09:36:12Z' } })
			);
			expect((await verifyWebhook(hook, opts)).portalOffset).toBe('+00:00');
		});

		it.each([[{}], [[]], [{ NAME: 'Анна' }]])('profile %j без ID → invalid_webhook, секрета в сообщении нет', async (result) => {
			const { opts } = portal(() => reply({ result, time }));
			const err = await verifyWebhook(hook, opts).catch((e) => e);
			expect(err).toBeInstanceOf(BitrixError);
			expect(err.kind).toBe('invalid_webhook');
			expect(err.message).not.toContain('abc123secret');
		});
	});

	describe('checkTasksScope', () => {
		it('пробует tasks.task.field.list через REST 3.0', async () => {
			const { calls, opts } = portal(() => reply({ result: { items: [{ name: 'title' }] }, time }));
			await expect(checkTasksScope(hook, opts)).resolves.toBeUndefined();
			expect(calls[0].url).toBe('https://bitrix24.team/rest/api/1/abc123secret/tasks.task.field.list');
			expect(calls[0].body).toEqual({ select: ['name'] });
		});

		it('без права «Задачи» → scope', async () => {
			const { opts } = portal(() =>
				reply({ error: 'insufficient_scope', error_description: 'The request requires higher privileges' }, 401)
			);
			await expect(checkTasksScope(hook, opts)).rejects.toMatchObject({ kind: 'scope' });
		});
	});

	describe('resolveGroup', () => {
		it('находит название группы старым REST', async () => {
			const { calls, opts } = portal(() => reply({ result: [{ ID: '2014', NAME: 'Платформа' }], time }));
			await expect(resolveGroup(hook, 2014, opts)).resolves.toEqual({ status: 'ok', name: 'Платформа' });
			expect(calls[0].url).toBe('https://bitrix24.team/rest/1/abc123secret/sonet_group.get');
			expect(calls[0].body).toEqual({ FILTER: { ID: 2014 } });
		});

		it('пустой массив → notFound', async () => {
			const { opts } = portal(() => reply({ result: [], time }));
			await expect(resolveGroup(hook, 99, opts)).resolves.toEqual({ status: 'notFound' });
		});

		it('нет права «Рабочие группы соцсети» → noScope, а не ошибка', async () => {
			const { opts } = portal(() =>
				reply({ error: 'insufficient_scope', error_description: 'The request requires higher privileges' }, 401)
			);
			await expect(resolveGroup(hook, 2014, opts)).resolves.toEqual({ status: 'noScope' });
		});

		it('прочие ошибки пробрасываются', async () => {
			const { opts } = portal(() => reply({ error: 'INVALID_CREDENTIALS', error_description: 'Invalid' }, 401));
			await expect(resolveGroup(hook, 2014, opts)).rejects.toMatchObject({ kind: 'invalid_webhook' });
		});

		it('не массив → shape', async () => {
			const { opts } = portal(() => reply({ result: { ID: '2014' }, time }));
			await expect(resolveGroup(hook, 2014, opts)).rejects.toMatchObject({ kind: 'shape' });
		});
	});

	describe('deadlineIso', () => {
		it.each([
			['2026-10-01', 'Europe/Kaliningrad', '2026-10-01T19:00:00+02:00'],
			['2026-10-01', 'Europe/Moscow', '2026-10-01T19:00:00+03:00'],
			['2026-07-15', 'America/New_York', '2026-07-15T19:00:00-04:00'],
			['2026-01-15', 'America/New_York', '2026-01-15T19:00:00-05:00'],
			['2026-01-15', 'UTC', '2026-01-15T19:00:00+00:00'],
			['2026-01-15', 'Asia/Kolkata', '2026-01-15T19:00:00+05:30'],
			// накануне перехода на летнее время (4 октября) вечер ещё +10:00
			['2026-10-03', 'Australia/Sydney', '2026-10-03T19:00:00+10:00'],
			['2026-10-04', 'Australia/Sydney', '2026-10-04T19:00:00+11:00']
		])('%s в зоне %s → %s', (date, zone, expected) => {
			expect(deadlineIso(date, zone, '+09:00')).toBe(expected);
		});

		it('пустая или неизвестная зона → смещение портала', () => {
			expect(deadlineIso('2026-10-01', '', '+05:00')).toBe('2026-10-01T19:00:00+05:00');
			expect(deadlineIso('2026-10-01', null, '+05:00')).toBe('2026-10-01T19:00:00+05:00');
			expect(deadlineIso('2026-10-01', 'Mars/Olympus', '+05:00')).toBe('2026-10-01T19:00:00+05:00');
		});

		it('нет ни зоны, ни смещения портала → +03:00', () => {
			expect(deadlineIso('2026-10-01', '', null)).toBe('2026-10-01T19:00:00+03:00');
			expect(deadlineIso('2026-10-01', null, null)).toBe('2026-10-01T19:00:00+03:00');
		});
	});

	describe('idempotencyKey', () => {
		it('sha256 в hex, не зависит от порядка ключей объекта', () => {
			const a = fields({ groupId: 2014, deadline: '2026-10-01', important: true });
			const b: TaskFields = { important: true, deadline: '2026-10-01', groupId: 2014, description: a.description, title: a.title };
			const key = idempotencyKey('card-1', a);
			expect(key).toMatch(/^[0-9a-f]{64}$/);
			expect(idempotencyKey('card-1', b)).toBe(key);
		});

		it.each([
			['title', { title: 'Другое название' }],
			['description', { description: 'Другое описание' }],
			['groupId', { groupId: 2014 }],
			['deadline', { deadline: '2026-10-01' }],
			['important', { important: true }]
		] as [string, Partial<TaskFields>][])('меняется при правке %s', (_name, over) => {
			expect(idempotencyKey('card-1', fields(over))).not.toBe(idempotencyKey('card-1', fields()));
		});

		it('меняется при другой карточке', () => {
			expect(idempotencyKey('card-2', fields())).not.toBe(idempotencyKey('card-1', fields()));
		});
	});

	describe('createTask', () => {
		const item = (over: Record<string, unknown> = {}) => ({
			result: { item: { id: 745181, link: '/workgroups/group/2014/tasks/task/view/745181/', ...over } },
			time
		});

		it('шлёт поля v3 с ключом идемпотентности и склеивает ссылку с порталом', async () => {
			const { calls, opts } = portal(() => reply(item()));
			const f = fields({ groupId: 2014, deadline: '2026-10-01', important: true });
			const task = await createTask(hook, f, { timeZone: 'Europe/Kaliningrad', portalOffset: '+03:00' }, 'key-1', opts);
			expect(task).toEqual({ id: 745181, url: 'https://bitrix24.team/workgroups/group/2014/tasks/task/view/745181/' });
			expect(calls).toHaveLength(1);
			expect(calls[0].url).toBe('https://bitrix24.team/rest/api/1/abc123secret/tasks.task.add');
			expect(calls[0].headers.get('Idempotency-Key')).toBe('key-1');
			expect(calls[0].body).toEqual({
				fields: {
					title: 'Починить деплой',
					description: 'Деплой падает по пятницам\n\nИз ретро «Спринт 42»',
					creatorId: 1,
					responsibleId: 1,
					groupId: 2014,
					deadline: '2026-10-01T19:00:00+02:00',
					priority: 'high'
				}
			});
		});

		it('без группы, срока и важности эти поля не передаёт', async () => {
			const { calls, opts } = portal(() => reply(item({ link: '/company/personal/user/1/tasks/task/view/745181/' })));
			await createTask(hook, fields(), { timeZone: null, portalOffset: null }, 'key-2', opts);
			expect(Object.keys(calls[0].body.fields).sort()).toEqual(['creatorId', 'description', 'responsibleId', 'title']);
		});

		it('в тестовом http-режиме ссылка берёт протокол и порт вебхука', async () => {
			const local: Webhook = { url: 'http://localhost:4779/rest/1/testcode/', portal: 'localhost:4779', userId: 1 };
			const { opts } = portal(() => reply(item()));
			const task = await createTask(local, fields(), { timeZone: null, portalOffset: null }, 'k', opts);
			expect(task.url).toBe('http://localhost:4779/workgroups/group/2014/tasks/task/view/745181/');
		});

		it.each([
			['ссылка на чужой хост через @', { link: '@evil.com/tasks/1/' }],
			['protocol-relative ссылка', { link: '//evil.com/tasks/1/' }],
			['ссылки нет', { link: undefined }],
			['ссылка не строка', { link: 42 }],
			['id не число', { id: '745181' }],
			['id ноль', { id: 0 }]
		])('%s → shape, секрета в сообщении нет', async (_name, over) => {
			const { opts } = portal(() => reply(item(over)));
			const err = await createTask(hook, fields(), { timeZone: null, portalOffset: null }, 'k', opts).catch((e) => e);
			expect(err).toBeInstanceOf(BitrixError);
			expect(err.kind).toBe('shape');
			expect(err.message).not.toContain('abc123secret');
		});

		it('ответ без item → shape', async () => {
			const { opts } = portal(() => reply({ result: {}, time }));
			await expect(
				createTask(hook, fields(), { timeZone: null, portalOffset: null }, 'k', opts)
			).rejects.toMatchObject({ kind: 'shape' });
		});

		const accessDenied = { error: { code: 'BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION', message: 'Доступ запрещен' } };

		it('ACCESSDENIEDEXCEPTION при выставленной группе → group с полем groupId', async () => {
			const { opts } = portal(() => reply(accessDenied, 403));
			await expect(
				createTask(hook, fields({ groupId: 999 }), { timeZone: null, portalOffset: null }, 'k', opts)
			).rejects.toMatchObject({ kind: 'group', field: 'groupId' });
		});

		it('ACCESSDENIEDEXCEPTION без группы остаётся access', async () => {
			const { opts } = portal(() => reply(accessDenied, 403));
			await expect(
				createTask(hook, fields(), { timeZone: null, portalOffset: null }, 'k', opts)
			).rejects.toMatchObject({ kind: 'access' });
		});

		it('OVERLOAD_LIMIT при выставленной группе остаётся access', async () => {
			const { opts } = portal(() => reply({ error: 'OVERLOAD_LIMIT', error_description: 'Blocked' }, 401));
			await expect(
				createTask(hook, fields({ groupId: 2014 }), { timeZone: null, portalOffset: null }, 'k', opts)
			).rejects.toMatchObject({ kind: 'access' });
		});

		it('валидация поля groupId при выставленной группе → group', async () => {
			const { opts } = portal(() =>
				reply(
					{
						error: {
							code: 'BITRIX_REST_V3_EXCEPTION_VALIDATION_REQUESTVALIDATIONEXCEPTION',
							message: 'Неверное значение',
							validation: [{ field: 'groupId', message: 'Неверное значение' }]
						}
					},
					400
				)
			);
			await expect(
				createTask(hook, fields({ groupId: 2014 }), { timeZone: null, portalOffset: null }, 'k', opts)
			).rejects.toMatchObject({ kind: 'group', field: 'groupId' });
		});
	});

	describe('tagTask', () => {
		it('ставит тег retro старым REST', async () => {
			const { calls, opts } = portal(() => reply({ result: { task: { id: '745181' } }, time }));
			await tagTask(hook, 745181, opts);
			expect(calls[0].url).toBe('https://bitrix24.team/rest/1/abc123secret/tasks.task.update');
			expect(calls[0].body).toEqual({ taskId: 745181, fields: { TAGS: ['retro'] } });
		});
	});

	describe('IMAGE_MAX_BYTES', () => {
		afterEach(() => vi.unstubAllEnvs());

		// Модуль читает BITRIX_IMAGE_MAX_BYTES при импорте — грузим его заново под каждым окружением
		async function load(value: string) {
			vi.resetModules();
			vi.stubEnv('BITRIX_IMAGE_MAX_BYTES', value);
			return (await import('./bitrix.js')).IMAGE_MAX_BYTES;
		}

		it('по умолчанию 4 МБ', () => {
			expect(IMAGE_MAX_BYTES).toBe(4 * 1024 * 1024);
		});

		it('берёт целое > 0 из окружения', async () => {
			expect(await load('1048576')).toBe(1048576);
		});

		it.each(['', '0', '-5', '1.5', 'много'])('мусор %j → 4 МБ', async (value) => {
			expect(await load(value)).toBe(4 * 1024 * 1024);
		});
	});

	describe('attachImage и слот загрузки', () => {
		const image = { cardId: '3f2b8c1e-0000-4000-8000-000000000001', mimeType: 'image/webp', data: Buffer.from('webp-bytes') };

		function disk(uploadResult: unknown = { ID: 9011, FILE_ID: 32877, NAME: 'retro.webp' }) {
			return portal((method) => {
				if (method === 'disk.storage.getlist') return reply({ result: [{ ID: '11', ROOT_OBJECT_ID: '101', ENTITY_TYPE: 'user' }], time });
				if (method === 'disk.storage.uploadFile') return reply({ result: uploadResult, time });
				if (method === 'tasks.task.file.attach') return reply({ result: true, time });
				return reply({ error: 'ERROR_METHOD_NOT_FOUND', error_description: 'Method not found!' }, 404);
			});
		}

		// Часы, которыми управляет тест; setImmediate остаётся настоящим
		const fakeClock = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

		// Настоящие макрозадачи, пока не выполнится условие (не больше 100): промисы успевают пройти, часы стоят
		async function settle(done: () => boolean) {
			for (let i = 0; i < 100 && !done(); i++) await new Promise((resolve) => setImmediate(resolve));
		}

		it('хранилище → загрузка с уникальным именем → прикрепление ID объекта Диска', async () => {
			const { calls, opts } = disk();
			await attachImage(hook, 1, 745181, image, opts);
			expect(calls.map((c) => c.url)).toEqual([
				'https://bitrix24.team/rest/1/abc123secret/disk.storage.getlist',
				'https://bitrix24.team/rest/1/abc123secret/disk.storage.uploadFile',
				'https://bitrix24.team/rest/api/1/abc123secret/tasks.task.file.attach'
			]);
			expect(calls[0].body).toEqual({ filter: { ENTITY_TYPE: 'user', ENTITY_ID: 1 } });
			const name = 'retro-3f2b8c1e-0000-4000-8000-000000000001.webp';
			expect(calls[1].body).toEqual({
				id: '11',
				data: { NAME: name },
				fileContent: [name, Buffer.from('webp-bytes').toString('base64')],
				generateUniqueName: true
			});
			expect(calls[2].body).toEqual({ taskId: 745181, fileIds: [9011] });
		});

		it('ID строкой приводится к числу, FILE_ID не используется', async () => {
			const { calls, opts } = disk({ ID: '9011', FILE_ID: '32877' });
			await attachImage(hook, 1, 745181, image, opts);
			expect(calls[2].body.fileIds).toEqual([9011]);
		});

		it('без ID в ответе загрузки → shape, прикрепления нет', async () => {
			const { calls, opts } = disk({ FILE_ID: 32877 });
			await expect(attachImage(hook, 1, 745181, image, opts)).rejects.toMatchObject({ kind: 'shape' });
			expect(calls).toHaveLength(2);
		});

		it.each([
			['image/gif', 'gif'],
			['image/png', 'png'],
			['image/jpeg', 'jpg'],
			['application/octet-stream', 'bin'],
			['constructor', 'bin']
		])('%s → расширение .%s', async (mimeType, ext) => {
			const { calls, opts } = disk();
			await attachImage(hook, 1, 745181, { ...image, mimeType }, opts);
			expect(calls[1].body.data.NAME).toBe(`retro-${image.cardId}.${ext}`);
			expect(calls[1].body.fileContent[0]).toBe(`retro-${image.cardId}.${ext}`);
		});

		it('нет личного хранилища → shape, загрузки нет', async () => {
			const { calls, opts } = portal(() => reply({ result: [], time }));
			await expect(attachImage(hook, 1, 745181, image, opts)).rejects.toMatchObject({ kind: 'shape' });
			expect(calls).toHaveLength(1);
		});

		it('ошибка загрузки пробрасывается, прикрепления нет', async () => {
			const { calls, opts } = portal((method) =>
				method === 'disk.storage.getlist'
					? reply({ result: [{ ID: '11' }], time })
					: reply({ error: 'insufficient_scope', error_description: 'No disk scope' }, 401)
			);
			await expect(attachImage(hook, 1, 745181, image, opts)).rejects.toBeInstanceOf(BitrixError);
			expect(calls).toHaveLength(2);
		});

		it('слот пропускает загрузки по одной', async () => {
			let releaseFirstUpload!: () => void;
			const gate = new Promise<void>((resolve) => (releaseFirstUpload = resolve));
			let uploads = 0;
			const { calls, opts } = portal(async (method) => {
				if (method === 'disk.storage.getlist') return reply({ result: [{ ID: '11' }], time });
				if (method === 'disk.storage.uploadFile') {
					uploads += 1;
					if (uploads === 1) await gate;
					return reply({ result: { ID: 9000 + uploads }, time });
				}
				return reply({ result: true, time });
			});

			const first = withUploadSlot(() => attachImage(hook, 1, 1, image, opts));
			const second = withUploadSlot(() => attachImage(hook, 1, 2, image, opts));
			await vi.waitFor(() => expect(calls).toHaveLength(2));
			await new Promise((resolve) => setTimeout(resolve, 20));
			// первая загрузка висит — вторая даже не спросила хранилище
			expect(calls.map((c) => c.url.split('/').pop())).toEqual(['disk.storage.getlist', 'disk.storage.uploadFile']);

			releaseFirstUpload();
			await Promise.all([first, second]);
			expect(calls.map((c) => c.url.split('/').pop())).toEqual([
				'disk.storage.getlist',
				'disk.storage.uploadFile',
				'tasks.task.file.attach',
				'disk.storage.getlist',
				'disk.storage.uploadFile',
				'tasks.task.file.attach'
			]);
			expect(calls[2].body).toEqual({ taskId: 1, fileIds: [9001] });
			expect(calls[5].body).toEqual({ taskId: 2, fileIds: [9002] });
		});

		it('упавшая работа освобождает слот и отдаёт свою ошибку', async () => {
			await expect(withUploadSlot(async () => Promise.reject(new Error('упало')))).rejects.toThrow('упало');
			await expect(withUploadSlot(async () => 'дальше')).resolves.toBe('дальше');
		});

		it('ждать слот дольше 30 с → timeout, работа не запускается, очередь не рвётся', async () => {
			fakeClock();
			let releaseFirst!: () => void;
			const gate = new Promise<void>((resolve) => (releaseFirst = resolve));
			try {
				const first = withUploadSlot(async () => {
					await gate;
					return 'первая';
				});
				const secondWork = vi.fn(async () => 'вторая');
				const second = withUploadSlot(secondWork).catch((e) => e);

				await vi.advanceTimersByTimeAsync(29_999);
				expect(secondWork).not.toHaveBeenCalled();
				await vi.advanceTimersByTimeAsync(1);
				const err = await second;
				expect(err).toBeInstanceOf(BitrixError);
				expect(err.kind).toBe('timeout');

				// первая всё ещё держит слот: третья ждёт её, а не проскакивает на место отвалившейся второй
				const thirdWork = vi.fn(async () => 'третья');
				const third = withUploadSlot(thirdWork);
				await settle(() => thirdWork.mock.calls.length > 0);
				expect(thirdWork).not.toHaveBeenCalled();

				releaseFirst();
				await expect(first).resolves.toBe('первая');
				await expect(third).resolves.toBe('третья');
				expect(secondWork).not.toHaveBeenCalled();
			} finally {
				releaseFirst();
				vi.useRealTimers();
			}
		});

		it('на загрузку идёт остаток 30 с от постановки в очередь', async () => {
			fakeClock();
			let releaseFirst!: () => void;
			const gate = new Promise<void>((resolve) => (releaseFirst = resolve));
			try {
				const enqueuedAt = Date.now();
				let abortedAt: number | null = null;
				const { calls, opts } = portal((method, _body, init) => {
					if (method === 'disk.storage.getlist') return reply({ result: [{ ID: '11' }], time });
					// загрузка висит, пока транспорт не оборвёт её по своему таймауту
					return new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener('abort', () => {
							abortedAt = Date.now();
							reject(new DOMException('aborted', 'AbortError'));
						});
					});
				});
				const first = withUploadSlot(() => gate);
				const second = withUploadSlot(() => attachImage(hook, 1, 745181, image, opts)).catch((e) => e);

				// слот освобождается через 20 с после постановки второй в очередь
				await vi.advanceTimersByTimeAsync(20_000);
				releaseFirst();
				await first;
				await settle(() => calls.length === 2);
				expect(calls.map((c) => c.url.split('/').pop())).toEqual(['disk.storage.getlist', 'disk.storage.uploadFile']);

				await vi.advanceTimersByTimeAsync(9_999);
				expect(abortedAt).toBeNull();
				await vi.advanceTimersByTimeAsync(1);
				expect(abortedAt).toBe(enqueuedAt + 30_000);
				expect(await second).toMatchObject({ kind: 'timeout' });
			} finally {
				releaseFirst();
				vi.useRealTimers();
			}
		});

		it('слот освободился за полсекунды до срока → timeout без загрузки файла', async () => {
			fakeClock();
			let releaseFirst!: () => void;
			const gate = new Promise<void>((resolve) => (releaseFirst = resolve));
			try {
				const { calls, opts } = disk();
				const first = withUploadSlot(() => gate);
				const second = withUploadSlot(() => attachImage(hook, 1, 745181, image, opts)).catch((e) => e);

				await vi.advanceTimersByTimeAsync(29_500);
				releaseFirst();
				await first;
				const err = await second;
				expect(err).toBeInstanceOf(BitrixError);
				expect(err.kind).toBe('timeout');
				// base64 не строился, файл на Диск не ушёл
				expect(calls.map((c) => c.url.split('/').pop())).toEqual(['disk.storage.getlist']);
			} finally {
				releaseFirst();
				vi.useRealTimers();
			}
		});
	});
});
