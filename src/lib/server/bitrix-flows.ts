// Чистая часть интеграции с Битрикс24: статусы видов ошибок, разбор форм и
// (задача 8) оркестрация создания задачи с внедрёнными зависимостями.
// Без БД и $env — тестируется напрямую.
import type { BitrixErrorKind, CallOptions, TaskFields, Webhook } from './bitrix.js';
import type { CardTask } from '$lib/types.js';
import {
	BitrixError,
	IMAGE_MAX_BYTES,
	attachImage,
	createTask,
	idempotencyKey,
	tagTask,
	withUploadSlot
} from './bitrix.js';
import type { Cookies } from '@sveltejs/kit';
import { canViewSpace } from './space-access.js';

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

/**
 * Кто может создавать задачи с доски и проверять группу: создатель доски или
 * пространства, и только с доступом к пространству (cookie retro_space_{slug}
 * сверяется с access_token). Пустые токены старых записей прав не дают.
 * Общая проверка для экшена createTask и GET /[slug]/bitrix/group.
 */
export function canCreateTask(
	board: { slug: string; creatorToken: string },
	space: { slug: string; passwordHash: string | null; creatorToken: string; accessToken: string },
	cookies: Cookies
): boolean {
	const boardCookie = cookies.get(`retro_creator_${board.slug}`) ?? '';
	const spaceCookie = cookies.get(`retro_space_creator_${space.slug}`) ?? '';
	const lead =
		(!!board.creatorToken && boardCookie === board.creatorToken) ||
		(!!space.creatorToken && spaceCookie === space.creatorToken);
	return lead && canViewSpace(space, cookies);
}

export interface CreateTaskDeps {
	webhook: Webhook;
	connection: { userId: number; timeZone: string | null; portalOffset: string | null };
	card: { id: string; imageId: string | null };
	fields: TaskFields;
	source: TaskSource;
	callOpts?: CallOptions;
	saveTask(cardId: string, task: CardTask): Promise<boolean>; // UPDATE ... WHERE bitrix_task_id IS NULL; false — 0 строк
	imageSize(imageId: string): Promise<number | null>; // octet_length без чтения байтов; null — нет строки
	loadImage(imageId: string): Promise<{ mimeType: string; data: Buffer } | null>;
	emit(cardId: string, task: CardTask): void; // emitBoard(slug, 'card:task', ...)
	metric(name: string, value: number, type?: string): void;
	now(): number;
}

export type CreateTaskOutcome =
	| { ok: true; task: CardTask; imageAttached: boolean | null }
	| { ok: false; kind: ActionErrorKind; field?: string; message?: string };

/**
 * Картинка карточки: best-effort. Любая неудача даёт false и метрику, задачу не отменяет.
 * Размер проверяем без чтения байтов; слот загрузки берём до loadImage, чтобы в куче
 * одновременно жила не больше одной картинки (контейнер с --max-old-space-size=256).
 */
async function attachCardImage(deps: CreateTaskDeps, imageId: string, taskId: number): Promise<boolean> {
	try {
		const size = await deps.imageSize(imageId);
		if (size !== null && size > IMAGE_MAX_BYTES) {
			deps.metric('retro.bitrix.task.image_skipped', 1);
			return false;
		}
		const attached =
			size !== null &&
			(await withUploadSlot(async () => {
				const image = await deps.loadImage(imageId);
				if (!image) return false;
				await attachImage(
					deps.webhook,
					deps.connection.userId,
					taskId,
					{ cardId: deps.card.id, mimeType: image.mimeType, data: image.data },
					deps.callOpts
				);
				return true;
			}));
		deps.metric(attached ? 'retro.bitrix.task.image_attached' : 'retro.bitrix.task.image_failed', 1);
		return attached;
	} catch {
		deps.metric('retro.bitrix.task.image_failed', 1);
		return false;
	}
}

/**
 * Создание задачи из карточки после всех проверок экшена. Порядок важен:
 * задача → запись на карточку → тег → картинка → метрики → рассылка card:task.
 * Рассылка последней: сокет создателя тоже в комнате, и бейдж не должен
 * появиться под ещё крутящейся модалкой.
 */
export async function createTaskFlow(deps: CreateTaskDeps): Promise<CreateTaskOutcome> {
	const started = deps.now();
	const { webhook, connection, card, fields, callOpts } = deps;

	let task: CardTask;
	try {
		task = await createTask(
			webhook,
			fields,
			{ timeZone: connection.timeZone, portalOffset: connection.portalOffset },
			idempotencyKey(card.id, fields),
			callOpts
		);
	} catch (err) {
		if (err instanceof BitrixError) return { ok: false, kind: err.kind, field: err.field, message: err.message };
		throw err;
	}

	// 0 строк — карточку удалили, пока шёл запрос: задача в портале осталась сиротой
	if (!(await deps.saveTask(card.id, task))) {
		deps.metric('retro.bitrix.task.orphaned', 1);
		return { ok: false, kind: 'not_found' };
	}

	// Тег best-effort: v3 его не принимает, ставим старым REST после создания
	try {
		await tagTask(webhook, task.id, callOpts);
	} catch {
		deps.metric('retro.bitrix.task.tag_failed', 1);
	}

	const imageAttached = card.imageId ? await attachCardImage(deps, card.imageId, task.id) : null;

	deps.metric(`retro.bitrix.task.created.${deps.source}`, 1);
	deps.metric('retro.bitrix.task.duration_ms', deps.now() - started, 'ms');
	deps.emit(card.id, task);
	return { ok: true, task, imageAttached };
}
