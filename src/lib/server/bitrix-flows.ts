// Чистая часть интеграции с Битрикс24: статусы видов ошибок, разбор форм и
// (задача 8) оркестрация создания задачи с внедрёнными зависимостями.
// Без БД и $env — тестируется напрямую.
import type { BitrixErrorKind, TaskFields } from './bitrix.js';

export type ActionErrorKind =
	| BitrixErrorKind
	| 'forbidden'
	| 'not_found'
	| 'not_connected'
	| 'exists'
	| 'running'
	| 'invalid'
	| 'rate_limited'
	| 'encryption';

// Record заставляет TypeScript требовать статус для каждого нового вида.
// Клиент ветвится по bitrixError, статус — только для HTTP-семантики.
const STATUS: Record<ActionErrorKind, number> = {
	invalid_url: 422,
	invalid_webhook: 401,
	forbidden: 403,
	scope: 403,
	access: 403,
	not_found: 404,
	not_connected: 409,
	exists: 409,
	running: 409,
	group: 409,
	invalid: 422,
	rejected: 422,
	rate_limited: 429,
	network: 502,
	timeout: 502,
	shape: 502,
	limit: 502,
	encryption: 503
};

export function statusForKind(kind: ActionErrorKind): number {
	return STATUS[kind];
}

/** Виды, которые экшены на пути fail пишут в space_bitrix.last_error */
export function persistsLastError(kind: ActionErrorKind): kind is 'invalid_webhook' | 'scope' | 'access' {
	return kind === 'invalid_webhook' || kind === 'scope' || kind === 'access';
}

// group_id — integer в Postgres: больше не влезет
const INT4_MAX = 2_147_483_647;

/** '' / пробелы / null → без группы; целое 1..INT4_MAX → число; остальное → 'invalid' */
export function parseGroupId(raw: FormDataEntryValue | string | null | undefined): number | null | 'invalid' {
	if (raw === null || raw === undefined) return null;
	if (typeof raw !== 'string') return 'invalid';
	const value = raw.trim();
	if (!value) return null;
	if (!/^\d+$/.test(value)) return 'invalid';
	const id = Number(value);
	return id > 0 && id <= INT4_MAX ? id : 'invalid';
}

// UUID карточки: cardId в форме преформы и ключ runningCards/идемпотентности
const CARD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Задача 8 использует её же в маршруте доски для тех же проверок */
export function isCardId(value: string): boolean {
	return CARD_ID_RE.test(value);
}

export type TaskSource = 'card' | 'summary' | 'other';

export type ParsedTaskForm =
	| { ok: true; cardId: string; fields: TaskFields; source: TaskSource }
	| { ok: false; field: 'cardId' | 'title' | 'description' | 'groupId' | 'deadline' };

const TITLE_MAX = 250;
const DESCRIPTION_MAX = 20_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Файл вместо строки считаем пустым полем
function text(value: FormDataEntryValue | null): string {
	return typeof value === 'string' ? value : '';
}

// '' → без срока; YYYY-MM-DD настоящей даты → как есть; иначе 'invalid'
function parseDeadline(raw: string): string | null | 'invalid' {
	const value = raw.trim();
	if (!value) return null;
	const match = ISO_DATE.exec(value);
	if (!match) return 'invalid';
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const date = new Date(Date.UTC(year, month - 1, day));
	const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
	return real ? value : 'invalid';
}

/** Форма преформы → поля задачи. Первая ошибка по порядку cardId → title → description → groupId → deadline */
export function parseTaskForm(form: FormData): ParsedTaskForm {
	// Ключ runningCards и идемпотентности — всегда в одном регистре; не-uuid уронил бы запрос к cards.id
	const cardId = text(form.get('cardId')).trim().toLowerCase();
	if (!isCardId(cardId)) return { ok: false, field: 'cardId' };

	const title = text(form.get('title')).trim();
	if (!title || title.length > TITLE_MAX) return { ok: false, field: 'title' };

	// multipart приносит переносы textarea как CRLF — в портал и в ключ идемпотентности уходит LF
	const description = text(form.get('description')).replace(/\r\n?/g, '\n');
	if (description.length > DESCRIPTION_MAX) return { ok: false, field: 'description' };

	const groupId = parseGroupId(form.get('groupId'));
	if (groupId === 'invalid') return { ok: false, field: 'groupId' };

	const deadline = parseDeadline(text(form.get('deadline')));
	if (deadline === 'invalid') return { ok: false, field: 'deadline' };

	// В имя метрики попадает только серверное перечисление
	const rawSource = form.get('source');
	const source: TaskSource = rawSource === 'card' || rawSource === 'summary' ? rawSource : 'other';

	return {
		ok: true,
		cardId,
		fields: { title, description, groupId, deadline, important: form.get('important') === 'on' },
		source
	};
}
