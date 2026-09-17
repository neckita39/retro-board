// Клиент Битрикс24: разбор адреса входящего вебхука, защита от SSRF, транспорт
// старого REST и REST 3.0, классификация ошибок портала. Код вебхука — секрет:
// в message, логи и метрики попадают только api, метод, код ошибки и HTTP-статус.

import { createHash } from 'node:crypto';
import type { CardTask } from '$lib/types.js';

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

/**
 * Единственный источник флага BITRIX_ALLOW_HTTP (http://localhost только для e2e с моком).
 * Читает process.env при каждом вызове: одно и то же значение видят и parseWebhookUrl,
 * и bitrix-connection.ts, и экшен подключения — иначе адрес, принятый при подключении,
 * потом не расшифровался бы в рабочий вебхук.
 */
export function allowHttpEnabled(): boolean {
	return process.env.BITRIX_ALLOW_HTTP === '1';
}

export function parseWebhookUrl(raw: string, opts: { allowHttp?: boolean } = {}): Webhook | null {
	const allowHttp = opts.allowHttp ?? allowHttpEnabled();
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

const CAUSE_CODE = /^[A-Z0-9_]+$/;

// undici кладёт машинную причину в err.cause.code (ENOTFOUND, ECONNRESET, CERT_HAS_EXPIRED),
// системные ошибки — в err.code. Берём только сам код и только в этом виде: текст undici
// копировать нельзя никогда, в нём бывает адрес вебхука
function causeCode(err: unknown): string | undefined {
	const e = err as { code?: unknown; cause?: { code?: unknown } | null } | null | undefined;
	const raw = e?.cause?.code ?? e?.code;
	return typeof raw === 'string' && CAUSE_CODE.test(raw) ? raw : undefined;
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
		const next = await reader.read().catch((err: unknown) => {
			throw signal.aborted
				? new BitrixError('timeout', `${where}: timed out while reading the body`, { code: causeCode(err) })
				: new BitrixError('network', `${where}: connection dropped`, { code: causeCode(err) });
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
		} catch (err) {
			// текст исходной ошибки не берём: в нём может оказаться адрес вебхука.
			// В code уходит только машинный код причины: по нему видно ENOTFOUND или протухший сертификат
			throw controller.signal.aborted
				? new BitrixError('timeout', `${where}: timed out`, { code: causeCode(err) })
				: new BitrixError('network', `${where}: portal unreachable`, { code: causeCode(err) });
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

// ---- Функции портала ----

export type GroupResolution = { status: 'ok'; name: string } | { status: 'notFound' } | { status: 'noScope' };

// '2026-09-17T12:36:12+03:00' → '+03:00'; смещение сервера портала, резерв для дедлайна
function offsetFromIso(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	if (value.endsWith('Z')) return '+00:00';
	const match = /([+-]\d{2}:\d{2})$/.exec(value);
	return match ? match[1] : null;
}

export async function verifyWebhook(
	webhook: Webhook,
	opts?: CallOptions
): Promise<{ userId: number; userName: string; timeZone: string | null; portalOffset: string | null }> {
	// profile работает без прав; нужен bitrixRequest, а не callLegacy, — смещение лежит в time, рядом с result
	const { result, time } = await bitrixRequest(webhook, 'profile', {}, 'legacy', opts);
	const profile = (result && typeof result === 'object' && !Array.isArray(result) ? result : {}) as Record<string, unknown>;
	const userId = Number(profile.ID);
	// Пустой объект — владелец вебхука неактивен
	if (!Number.isInteger(userId) || userId <= 0) {
		throw new BitrixError('invalid_webhook', 'Bitrix24 profile is empty');
	}
	// Профиль без имени и фамилии (приглашение по почте) — показываем «#id»,
	// иначе панель и преформа рисуют «Задачи создаёт:» с пустотой после двоеточия
	const userName =
		[profile.NAME, profile.LAST_NAME]
			.map((part) => (typeof part === 'string' ? part.trim() : ''))
			.filter(Boolean)
			.join(' ') || `#${userId}`;
	const timeZone = typeof profile.TIME_ZONE === 'string' && profile.TIME_ZONE ? profile.TIME_ZONE : null;
	const portalOffset = offsetFromIso((time as { date_finish?: unknown } | null | undefined)?.date_finish);
	return { userId, userName, timeZone, portalOffset };
}

export async function checkTasksScope(webhook: Webhook, opts?: CallOptions): Promise<void> {
	// Пробный вызов v3: без права «Задачи» или без REST 3.0 транспорт бросит BitrixError('scope')
	await callV3(webhook, 'tasks.task.field.list', { select: ['name'] }, opts);
}

export async function resolveGroup(webhook: Webhook, groupId: number, opts?: CallOptions): Promise<GroupResolution> {
	let result: unknown;
	try {
		result = await callLegacy(webhook, 'sonet_group.get', { FILTER: { ID: groupId } }, opts);
	} catch (err) {
		// Нет права «Рабочие группы соцсети» — не ошибка: id остаётся без названия
		if (err instanceof BitrixError && err.kind === 'scope') return { status: 'noScope' };
		throw err;
	}
	if (!Array.isArray(result)) throw new BitrixError('shape', 'Bitrix24 sonet_group.get returned no list');
	if (result.length === 0) return { status: 'notFound' };
	const name = (result[0] as { NAME?: unknown } | null)?.NAME;
	if (typeof name !== 'string' || !name) throw new BitrixError('shape', 'Bitrix24 group has no name');
	return { status: 'ok', name };
}

export interface TaskFields {
	title: string;
	description: string;
	groupId: number | null;
	deadline: string | null; // YYYY-MM-DD
	important: boolean;
}

const DEADLINE_TIME = '19:00:00';
const FALLBACK_OFFSET = '+03:00';

// Смещение зоны в момент epochMs: 'GMT+02:00' → '+02:00', голое 'GMT' (UTC) → '+00:00'.
// Пустая или неизвестная зона — RangeError из Intl
function zoneOffset(timeZone: string, epochMs: number): string {
	const label = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
		.formatToParts(new Date(epochMs))
		.find((part) => part.type === 'timeZoneName')?.value;
	const match = label ? /^GMT(?:([+-]\d{2}:\d{2}))?$/.exec(label) : null;
	if (!match) throw new RangeError('Unsupported time zone offset');
	return match[1] ?? '+00:00';
}

function offsetMinutes(offset: string): number {
	const sign = offset.startsWith('-') ? -1 : 1;
	return sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
}

export function deadlineIso(date: string, timeZone: string | null, portalOffset: string | null): string {
	const fallback = `${date}T${DEADLINE_TIME}${portalOffset ?? FALLBACK_OFFSET}`;
	if (!timeZone) return fallback;
	const [year, month, day] = date.split('-').map(Number);
	const utcEvening = Date.UTC(year, month - 1, day, 19);
	try {
		// Смещение на саму дату дедлайна (летнее время). Первая оценка — по 19:00 UTC,
		// вторая — по моменту, когда в зоне 19:00: иначе у зон далеко от UTC
		// (Сидней накануне перехода) смещение взялось бы уже со следующего дня
		const guess = zoneOffset(timeZone, utcEvening);
		const offset = zoneOffset(timeZone, utcEvening - offsetMinutes(guess) * 60_000);
		return `${date}T${DEADLINE_TIME}${offset}`;
	} catch {
		return fallback;
	}
}

export function idempotencyKey(cardId: string, fields: TaskFields): string {
	// Порядок ключей задан явно: ключ не зависит от того, как собран объект полей
	const canonical = JSON.stringify({
		title: fields.title,
		description: fields.description,
		groupId: fields.groupId,
		deadline: fields.deadline,
		important: fields.important
	});
	return createHash('sha256').update(`${cardId}\n${canonical}`).digest('hex');
}

// Живой портал на несуществующую или чужую groupId отвечает ACCESSDENIEDEXCEPTION.
// Прочие отказы доступа (тариф, OVERLOAD_LIMIT, PORTAL_DELETED) остаются access
function isGroupRefusal(err: unknown): err is BitrixError {
	if (!(err instanceof BitrixError)) return false;
	if (err.kind === 'access') return err.code === 'BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION';
	return err.kind === 'rejected' && /(^|\.)groupId$/.test(err.field ?? '');
}

export async function createTask(
	webhook: Webhook,
	fields: TaskFields,
	tz: { timeZone: string | null; portalOffset: string | null },
	key: string,
	opts?: CallOptions
): Promise<CardTask> {
	const taskFields: Record<string, unknown> = {
		title: fields.title,
		description: fields.description,
		creatorId: webhook.userId,
		responsibleId: webhook.userId
	};
	if (fields.groupId !== null) taskFields.groupId = fields.groupId;
	if (fields.deadline) taskFields.deadline = deadlineIso(fields.deadline, tz.timeZone, tz.portalOffset);
	if (fields.important) taskFields.priority = 'high';

	let result: unknown;
	try {
		result = await callV3(webhook, 'tasks.task.add', { fields: taskFields }, { ...opts, idempotencyKey: key });
	} catch (err) {
		if (fields.groupId !== null && isGroupRefusal(err)) {
			throw new BitrixError('group', 'Bitrix24 group not found or unavailable', {
				code: err.code,
				status: err.status,
				field: 'groupId'
			});
		}
		throw err;
	}

	const item = (result as { item?: { id?: unknown; link?: unknown } } | null)?.item;
	const id = item?.id;
	if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
		throw new BitrixError('shape', 'Bitrix24 task has no id');
	}
	// Только путь от корня портала: '@evil.com/…' или '//evil.com/…' увели бы ссылку на чужой хост.
	// Задача в портале уже есть, терять её нельзя: негодную ссылку заменяем на карточку задачи
	// в личном разделе владельца вебхука — этот путь есть на любом портале
	const link = item?.link;
	const path =
		typeof link === 'string' && link.startsWith('/') && !link.startsWith('//')
			? link
			: `/company/personal/user/${webhook.userId}/tasks/task/view/${id}/`;
	// origin = https://{portal}; в e2e (BITRIX_ALLOW_HTTP) — http://localhost:{port}
	return { id, url: `${new URL(webhook.url).origin}${path}` };
}

export async function tagTask(webhook: Webhook, taskId: number, opts?: CallOptions): Promise<void> {
	// v3 поле tags не принимает (проверено на живом портале) — тег ставит только старый REST
	await callLegacy(webhook, 'tasks.task.update', { taskId, fields: { TAGS: ['retro'] } }, opts);
}

const DEFAULT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

function readImageMaxBytes(raw: string | undefined): number {
	const value = Number(raw);
	return Number.isInteger(value) && value > 0 ? value : DEFAULT_IMAGE_MAX_BYTES;
}

// Анимированный GIF после Sharp бывает до 20 МБ, а процесс живёт в 256 МБ кучи
export const IMAGE_MAX_BYTES = readImageMaxBytes(process.env.BITRIX_IMAGE_MAX_BYTES);

const UPLOAD_TIMEOUT_MS = 30_000;
// Меньше секунды на загрузку — заведомый обрыв: не строим base64 и не шлём файл
const UPLOAD_MIN_BUDGET_MS = 1_000;

// Семафор на одну загрузку: один attach стоит около трёх размеров файла в куче.
// Вызывающий захватывает слот ДО чтения байтов картинки из БД.
// 30 с считаются с постановки в очередь: кто не дождался слота — получает timeout,
// а загрузке внутри слота достаётся остаток этих 30 с
let uploadTail: Promise<void> = Promise.resolve();
// Срок текущего держателя слота. Держатель всегда один, поэтому хватает одной переменной;
// attachImage читает её и потому вызывается только внутри withUploadSlot (или вовсе без слота)
let slotDeadline: number | null = null;

export function withUploadSlot<T>(fn: () => Promise<T>): Promise<T> {
	const deadline = Date.now() + UPLOAD_TIMEOUT_MS;
	const previous = uploadTail;
	let release!: () => void;
	const released = new Promise<void>((resolve) => (release = resolve));
	// Следующий в очереди ждёт и предыдущего держателя, и этот вызов:
	// отвалившийся по таймауту вызов не открывает дорогу параллельной загрузке
	uploadTail = previous.then(() => released);

	return new Promise<T>((resolve, reject) => {
		let expired = false;
		const timer = setTimeout(() => {
			expired = true;
			release();
			reject(new BitrixError('timeout', 'Bitrix24 upload queue timed out'));
		}, UPLOAD_TIMEOUT_MS);

		void previous.then(async () => {
			if (expired) return;
			clearTimeout(timer);
			slotDeadline = deadline;
			try {
				resolve(await fn());
			} catch (err) {
				reject(err);
			} finally {
				slotDeadline = null;
				release();
			}
		});
	});
}

// Остаток 30 с держателя слота; прямой вызов без слота получает полные 30 с
function uploadBudgetMs(): number {
	return slotDeadline === null ? UPLOAD_TIMEOUT_MS : slotDeadline - Date.now();
}

const IMAGE_EXTENSIONS = new Map([
	['image/webp', 'webp'],
	['image/gif', 'gif'],
	['image/png', 'png'],
	['image/jpeg', 'jpg']
]);

export async function attachImage(
	webhook: Webhook,
	userId: number,
	taskId: number,
	image: { cardId: string; mimeType: string; data: Buffer },
	opts?: CallOptions
): Promise<void> {
	// Методы Диска в v3 не переведены — хранилище и загрузка идут старым REST
	const storages = await callLegacy(
		webhook,
		'disk.storage.getlist',
		{ filter: { ENTITY_TYPE: 'user', ENTITY_ID: userId } },
		opts
	);
	const storageId = Array.isArray(storages) ? (storages[0] as { ID?: unknown } | undefined)?.ID : undefined;
	if (storageId === undefined || storageId === null || storageId === '') {
		throw new BitrixError('shape', 'Bitrix24 user storage not found');
	}

	const budget = uploadBudgetMs();
	if (budget < UPLOAD_MIN_BUDGET_MS) {
		throw new BitrixError('timeout', 'Bitrix24 upload slot deadline passed');
	}

	const name = `retro-${image.cardId}.${IMAGE_EXTENSIONS.get(image.mimeType) ?? 'bin'}`;
	const uploaded = await callLegacy(
		webhook,
		'disk.storage.uploadFile',
		{
			id: storageId,
			data: { NAME: name },
			fileContent: [name, image.data.toString('base64')],
			generateUniqueName: true
		},
		{ ...opts, timeoutMs: budget }
	);
	// ID — объект Диска; FILE_ID — внутренний id, его tasks.task.file.attach не находит
	const fileId = Number((uploaded as { ID?: unknown } | null)?.ID);
	if (!Number.isInteger(fileId) || fileId <= 0) {
		throw new BitrixError('shape', 'Bitrix24 upload returned no object id');
	}

	await callV3(webhook, 'tasks.task.file.attach', { taskId, fileIds: [fileId] }, opts);
}
