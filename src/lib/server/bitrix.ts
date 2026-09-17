// Клиент Битрикс24: разбор адреса входящего вебхука, защита от SSRF, транспорт
// старого REST и REST 3.0, классификация ошибок портала. Код вебхука — секрет:
// в message, логи и метрики попадают только api, метод, код ошибки и HTTP-статус.

export type BitrixErrorKind =
	| 'invalid_url'
	| 'invalid_webhook'
	| 'scope'
	| 'access'
	| 'limit'
	| 'group'
	| 'rejected'
	| 'network'
	| 'timeout'
	| 'shape';

export class BitrixError extends Error {
	kind: BitrixErrorKind;
	code?: string;
	status?: number;
	field?: string;

	constructor(kind: BitrixErrorKind, message: string, extra: { code?: string; status?: number; field?: string } = {}) {
		super(message);
		this.name = 'BitrixError';
		this.kind = kind;
		this.code = extra.code;
		this.status = extra.status;
		this.field = extra.field;
	}
}

export interface Webhook {
	url: string; // https://host/rest/{userId}/{code}/ — всегда с завершающим '/'
	portal: string;
	userId: number;
}

// ---------- Адрес вебхука ----------

const WEBHOOK_PATH = /^\/rest\/([1-9]\d{0,9})\/([A-Za-z0-9]+)\/?$/;
const MAX_USER_ID = 2_147_483_647; // user_id — integer в Postgres

export function parseWebhookUrl(raw: string, opts: { allowHttp?: boolean } = {}): Webhook | null {
	const allowHttp = opts.allowHttp ?? process.env.BITRIX_ALLOW_HTTP === '1';
	const input = typeof raw === 'string' ? raw.trim() : '';
	// new URL молча выбрасывает пустые '?' и '#', поэтому смотрим на исходную строку
	if (!input || /[?#]/.test(input)) return null;

	let u: URL;
	try {
		u = new URL(input);
	} catch {
		return null;
	}
	if (u.username || u.password) return null;

	// http://localhost:{port} — только для e2e с моком (BITRIX_ALLOW_HTTP=1)
	const local = allowHttp && u.protocol === 'http:' && u.hostname === 'localhost';
	if (!local && (u.protocol !== 'https:' || isBlockedHost(u.hostname))) return null;

	const m = WEBHOOK_PATH.exec(u.pathname);
	if (!m) return null;
	const userId = Number(m[1]);
	if (userId > MAX_USER_ID) return null;

	return { url: `${u.protocol}//${u.host}/rest/${userId}/${m[2]}/`, portal: u.host, userId };
}

// ---------- Защита от SSRF ----------

function ipv4ToInt(host: string): number | null {
	const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
	if (!m) return null;
	const octets = m.slice(1).map(Number);
	if (octets.some((o) => o > 255)) return null;
	return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

const BLOCKED_IPV4 = [
	'0.0.0.0/8',
	'10.0.0.0/8',
	'100.64.0.0/10',
	'127.0.0.0/8',
	'169.254.0.0/16',
	'172.16.0.0/12',
	'192.168.0.0/16'
].map((cidr) => {
	const [ip, bits] = cidr.split('/');
	return { net: ipv4ToInt(ip) as number, shift: 32 - Number(bits) };
});

function isBlockedIpv4(ip: number): boolean {
	return BLOCKED_IPV4.some(({ net, shift }) => ip >>> shift === net >>> shift);
}

// Восемь 16-битных групп канонической записи (new URL отдаёт IPv6 сжатым, в hex, без точек)
function ipv6Groups(host: string): number[] | null {
	const halves = host.split('::');
	if (halves.length > 2) return null;
	const head = halves[0] ? halves[0].split(':') : [];
	const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
	const gap = 8 - head.length - tail.length;
	if (halves.length === 1 ? gap !== 0 : gap < 1) return null;
	const parts = [...head, ...new Array<string>(halves.length === 2 ? gap : 0).fill('0'), ...tail];
	if (!parts.every((p) => /^[0-9a-f]{1,4}$/.test(p))) return null;
	return parts.map((p) => parseInt(p, 16));
}

function isBlockedIpv6(host: string): boolean {
	const g = ipv6Groups(host);
	if (!g) return true;
	const zeroPrefix = g.slice(0, 5).every((x) => x === 0);
	if (zeroPrefix && g[5] === 0) return true; // ::, ::1 и устаревшие ::a.b.c.d
	if (zeroPrefix && g[5] === 0xffff) return isBlockedIpv4(((g[6] << 16) | g[7]) >>> 0); // ::ffff:-mapped
	if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7
	if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10
	return false;
}

// Хост приводим к виду, который отдаёт new URL(...).hostname: так 127.1, 2130706433,
// 0x7f000001 и [::ffff:127.0.0.1] проверяются так же, как 127.0.0.1 и [::ffff:7f00:1]
function canonicalHost(hostname: string): string | null {
	let h = hostname.trim().toLowerCase();
	if (!h || /[/?#@\\\s]/.test(h)) return null;
	if (h.includes(':') && !h.startsWith('[')) h = `[${h}]`;
	try {
		return new URL(`https://${h}/`).hostname.replace(/\.+$/, '');
	} catch {
		return null;
	}
}

// DNS не резолвим: https с проверкой сертификата делает подмену DNS на приватный адрес бесполезной
export function isBlockedHost(hostname: string): boolean {
	const host = canonicalHost(hostname);
	if (!host) return true;
	if (host.startsWith('[')) return isBlockedIpv6(host.slice(1, -1));
	const ipv4 = ipv4ToInt(host);
	if (ipv4 !== null) return isBlockedIpv4(ipv4);
	if (!host.includes('.')) return true; // localhost, db, netdata, app
	return host.endsWith('.local') || host.endsWith('.localhost');
}

// ---------- Ошибки портала ----------

type BitrixApi = 'legacy' | 'v3';

const KIND_BY_CODE = new Map<string, BitrixErrorKind>([
	['INVALID_CREDENTIALS', 'invalid_webhook'],
	['NO_AUTH_FOUND', 'invalid_webhook'],
	['INSUFFICIENT_SCOPE', 'scope'],
	['ACCESS_DENIED', 'access'],
	['OVERLOAD_LIMIT', 'access'],
	['PORTAL_DELETED', 'access'],
	['QUERY_LIMIT_EXCEEDED', 'limit'],
	['OPERATION_TIME_LIMIT', 'limit']
]);

function kindForCode(code: string, api: BitrixApi): BitrixErrorKind {
	const upper = code.toUpperCase();
	const known = KIND_BY_CODE.get(upper);
	if (known) return known;
	if (upper.endsWith('INSUFFICIENTSCOPEEXCEPTION')) return 'scope';
	if (upper.endsWith('ACCESSDENIEDEXCEPTION')) return 'access';
	// на v3-адресе метод «не найден», когда у вебхука нет права или портал без REST 3.0
	if (upper === 'ERROR_METHOD_NOT_FOUND') return api === 'v3' ? 'scope' : 'rejected';
	return 'rejected'; // BITRIX_REST_V3_EXCEPTION_VALIDATION_*, ERROR_CORE, пустой код и прочее
}

const MESSAGE_MAX = 300;

function portalMessage(text: string, secret: string | undefined): string {
	const redacted = secret ? text.split(secret).join('***') : text;
	return redacted
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, MESSAGE_MAX);
}

// Ошибку определяет ключ error в теле, а не статус. Старый REST и системные ошибки:
// { error: 'CODE', error_description }; REST 3.0: { error: { code, message, validation? } }.
// Контекстный вид group (ACCESSDENIEDEXCEPTION при выставленной группе) решает createTask.
export function classifyBitrixError(
	body: Record<string, unknown>,
	status: number,
	api: BitrixApi,
	secret?: string
): BitrixError {
	const raw = body.error;
	let code = '';
	let text = '';
	let field: string | undefined;

	if (raw && typeof raw === 'object') {
		const e = raw as { code?: unknown; message?: unknown; validation?: unknown };
		code = typeof e.code === 'string' ? e.code : '';
		text = typeof e.message === 'string' ? e.message : '';
		const first: unknown = Array.isArray(e.validation) ? e.validation[0] : undefined;
		if (first && typeof first === 'object') {
			const v = first as { field?: unknown; message?: unknown };
			if (typeof v.field === 'string' && v.field) field = v.field;
			if (typeof v.message === 'string' && v.message && !text.includes(v.message)) {
				text = text ? `${text.replace(/[\s.:]+$/, '')}: ${v.message}` : v.message;
			}
		}
	} else {
		code = typeof raw === 'string' ? raw : '';
		text = typeof body.error_description === 'string' ? body.error_description : '';
	}

	return new BitrixError(kindForCode(code, api), portalMessage(text || code || 'Bitrix24 error', secret), {
		code: code || undefined,
		status,
		field
	});
}

// ---------- Транспорт ----------

export interface CallOptions {
	fetchFn?: typeof fetch;
	timeoutMs?: number;
	idempotencyKey?: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 1024 * 1024;

function webhookSecret(webhook: Webhook): string | undefined {
	return /\/rest\/\d+\/([^/]+)\/$/.exec(webhook.url)?.[1];
}

async function readLimitedBody(res: Response, signal: AbortSignal, where: string): Promise<string> {
	const tooLarge = () => new BitrixError('shape', `${where}: response is larger than 1 MB`, { status: res.status });
	if (Number(res.headers.get('content-length')) > MAX_BODY_BYTES) {
		res.body?.cancel().catch(() => {});
		throw tooLarge();
	}
	if (!res.body) return '';

	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const next = await reader.read().catch(() => {
			throw signal.aborted
				? new BitrixError('timeout', `${where}: timed out while reading the body`)
				: new BitrixError('network', `${where}: connection dropped`);
		});
		if (next.done) break;
		size += next.value.byteLength;
		if (size > MAX_BODY_BYTES) {
			reader.cancel().catch(() => {});
			throw tooLarge();
		}
		chunks.push(next.value);
	}
	return Buffer.concat(chunks).toString('utf8');
}

// Полный разобранный ответ: result и time.date_finish (смещение сервера портала для verifyWebhook)
export async function bitrixRequest(
	webhook: Webhook,
	method: string,
	params: unknown,
	api: BitrixApi,
	opts: CallOptions = {}
): Promise<{ result: unknown; time?: { date_finish?: string } }> {
	const base = api === 'v3' ? webhook.url.replace('/rest/', '/rest/api/') : webhook.url;
	const where = `Bitrix ${api} ${method}`;
	const fetchFn = opts.fetchFn ?? fetch;
	const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
	if (api === 'v3' && opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

	const controller = new AbortController();
	// Таймер живёт до конца чтения тела, как в deepseek.ts
	const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

	try {
		const payload = JSON.stringify(params ?? {});
		let res: Response;
		try {
			res = await fetchFn(base + method, {
				method: 'POST',
				headers,
				body: payload,
				redirect: 'manual',
				signal: controller.signal
			});
		} catch {
			// текст исходной ошибки не берём: в нём может оказаться адрес вебхука
			throw controller.signal.aborted
				? new BitrixError('timeout', `${where}: timed out`)
				: new BitrixError('network', `${where}: portal unreachable`);
		}

		// Следовать редиректу нельзя: это путь к внутренним сервисам, в том числе https → http
		if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
			res.body?.cancel().catch(() => {});
			throw new BitrixError('invalid_webhook', `${where}: redirect ${res.status}`, { status: res.status });
		}

		const text = await readLimitedBody(res, controller.signal, where);
		let data: unknown;
		try {
			data = JSON.parse(text);
		} catch {
			throw new BitrixError('shape', `${where}: non-JSON response`, { status: res.status });
		}
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			throw new BitrixError('shape', `${where}: response is not an object`, { status: res.status });
		}

		const body = data as Record<string, unknown>;
		if ('error' in body) throw classifyBitrixError(body, res.status, api, webhookSecret(webhook));
		if (!('result' in body)) throw new BitrixError('shape', `${where}: response has no result`, { status: res.status });

		const time = body.time;
		const dateFinish = time && typeof time === 'object' ? (time as { date_finish?: unknown }).date_finish : undefined;
		return { result: body.result, time: typeof dateFinish === 'string' ? { date_finish: dateFinish } : undefined };
	} finally {
		clearTimeout(timer);
	}
}

export async function callLegacy(webhook: Webhook, method: string, params: unknown, opts?: CallOptions): Promise<unknown> {
	return (await bitrixRequest(webhook, method, params, 'legacy', opts)).result;
}

export async function callV3(webhook: Webhook, method: string, params: unknown, opts?: CallOptions): Promise<unknown> {
	return (await bitrixRequest(webhook, method, params, 'v3', opts)).result;
}
