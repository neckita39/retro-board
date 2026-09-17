import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import {
	canCreateTask,
	createTaskFlow,
	parseGroupId,
	parseTaskForm,
	persistsLastError,
	statusForKind,
	type ActionErrorKind,
	type CreateTaskDeps
} from './bitrix-flows.js';
import {
	BitrixError,
	IMAGE_MAX_BYTES,
	attachImage,
	createTask,
	idempotencyKey,
	tagTask,
	withUploadSlot,
	type TaskFields,
	type Webhook
} from './bitrix.js';
import type { CardTask } from '$lib/types.js';

// Портал подменяем целиком: оркестрация проверяется без сети и без транспорта
vi.mock('./bitrix.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./bitrix.js')>();
	return { ...actual, createTask: vi.fn(), tagTask: vi.fn(), attachImage: vi.fn(), withUploadSlot: vi.fn() };
});

// Таблица статусов из спеки (Секция 2, «Ошибки экшенов»); invalid_url — ошибка ввода, как invalid
const STATUSES: Record<ActionErrorKind, number> = {
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
const KINDS = Object.keys(STATUSES) as ActionErrorKind[];

describe('statusForKind', () => {
	it('каждому виду ошибки — статус из таблицы', () => {
		const actual = Object.fromEntries(KINDS.map((kind) => [kind, statusForKind(kind)]));
		expect(actual).toEqual(STATUSES);
	});
});

describe('persistsLastError', () => {
	it('в last_error попадают только invalid_webhook, scope и access', () => {
		expect(KINDS.filter((kind) => persistsLastError(kind))).toEqual(['invalid_webhook', 'scope', 'access']);
	});
});

describe('parseGroupId', () => {
	it('пусто, пробелы, null и undefined — без группы', () => {
		expect([parseGroupId(''), parseGroupId('   '), parseGroupId(null), parseGroupId(undefined)]).toEqual([
			null,
			null,
			null,
			null
		]);
	});

	it('целое больше нуля — число, пробелы по краям срезаются', () => {
		expect(parseGroupId('2014')).toBe(2014);
		expect(parseGroupId(' 42 ')).toBe(42);
		expect(parseGroupId('2147483647')).toBe(2147483647);
	});

	it('ноль, минус, дробь, экспонента, буквы и больше integer в БД — invalid', () => {
		const bad = ['0', '-5', '1.5', '1e3', 'abc', '12a', '0x10', '2147483648'];
		expect(bad.map((raw) => parseGroupId(raw))).toEqual(bad.map(() => 'invalid'));
	});

	it('файл вместо строки — invalid', () => {
		expect(parseGroupId(new File(['1'], 'group.txt'))).toBe('invalid');
	});
});

const CARD_ID = '3f0c9a52-7a1e-4d8b-9c55-1b2e3d4f5a6b';

// null в overrides — поле не отправляется вовсе
function taskForm(overrides: Record<string, string | null> = {}): FormData {
	const values: Record<string, string | null> = {
		cardId: CARD_ID,
		title: 'Починить CI',
		description: 'Падает на main',
		groupId: '',
		deadline: '',
		source: 'card',
		...overrides
	};
	const fd = new FormData();
	for (const [name, value] of Object.entries(values)) if (value !== null) fd.append(name, value);
	return fd;
}

describe('parseTaskForm', () => {
	it('валидная форма: название обрезано, группа числом, срок, важная, источник', () => {
		const parsed = parseTaskForm(
			taskForm({ title: '  Починить CI  ', groupId: '2014', deadline: '2026-10-01', important: 'on', source: 'summary' })
		);
		expect(parsed).toEqual({
			ok: true,
			cardId: CARD_ID,
			fields: { title: 'Починить CI', description: 'Падает на main', groupId: 2014, deadline: '2026-10-01', important: true },
			source: 'summary'
		});
	});

	it('пустые группа и срок — null, без important — false', () => {
		expect(parseTaskForm(taskForm())).toEqual({
			ok: true,
			cardId: CARD_ID,
			fields: { title: 'Починить CI', description: 'Падает на main', groupId: null, deadline: null, important: false },
			source: 'card'
		});
	});

	it('неизвестный или пропущенный source — other: клиентская строка в имя метрики не попадает', () => {
		const odd = parseTaskForm(taskForm({ source: 'x.y.z' }));
		const missing = parseTaskForm(taskForm({ source: null }));
		expect(odd.ok && odd.source).toBe('other');
		expect(missing.ok && missing.source).toBe('other');
	});

	it('cardId приводится к нижнему регистру; пропущенный или не uuid — ошибка cardId', () => {
		const upper = parseTaskForm(taskForm({ cardId: CARD_ID.toUpperCase() }));
		expect(upper.ok && upper.cardId).toBe(CARD_ID);
		const bad = [null, '', 'c1', `${CARD_ID}' OR 1=1`];
		expect(bad.map((cardId) => parseTaskForm(taskForm({ cardId })))).toEqual(bad.map(() => ({ ok: false, field: 'cardId' })));
	});

	it('название: пустое после trim, пропущенное или длиннее 250 — ошибка title, ровно 250 — ок', () => {
		const bad = ['   ', null, 'я'.repeat(251)];
		expect(bad.map((title) => parseTaskForm(taskForm({ title })))).toEqual(bad.map(() => ({ ok: false, field: 'title' })));
		expect(parseTaskForm(taskForm({ title: 'я'.repeat(250) })).ok).toBe(true);
	});

	it('описание: CRLF из multipart становится LF, отступы и ссылки не трогаем', () => {
		const parsed = parseTaskForm(taskForm({ description: '  Текст\r\n\r\nИз ретро «Sprint 42»\r\nhttps://retro.test/abc' }));
		expect(parsed.ok && parsed.fields.description).toBe('  Текст\n\nИз ретро «Sprint 42»\nhttps://retro.test/abc');
	});

	it('описание: лимит 20 000 считается после нормализации, больше — ошибка description, пропущенное — пустая строка', () => {
		expect(parseTaskForm(taskForm({ description: 'x\r\n'.repeat(10_000) })).ok).toBe(true);
		expect(parseTaskForm(taskForm({ description: 'x'.repeat(20_001) }))).toEqual({ ok: false, field: 'description' });
		const missing = parseTaskForm(taskForm({ description: null }));
		expect(missing.ok && missing.fields.description).toBe('');
	});

	it('группа не число — ошибка groupId', () => {
		expect(parseTaskForm(taskForm({ groupId: 'Платформа' }))).toEqual({ ok: false, field: 'groupId' });
	});

	it('срок: только настоящая дата YYYY-MM-DD', () => {
		const bad = ['2026-02-30', '2026-13-01', '01.10.2026', '2026-1-5', 'tomorrow'];
		expect(bad.map((deadline) => parseTaskForm(taskForm({ deadline })))).toEqual(
			bad.map(() => ({ ok: false, field: 'deadline' }))
		);
		const leap = parseTaskForm(taskForm({ deadline: '2028-02-29' }));
		expect(leap.ok && leap.fields.deadline).toBe('2028-02-29');
	});

	it('поля проверяются по порядку: cardId раньше title', () => {
		expect(parseTaskForm(taskForm({ cardId: 'bad', title: '' }))).toEqual({ ok: false, field: 'cardId' });
	});
});

describe('canCreateTask', () => {
	const cookieJar = (entries: Record<string, string>) =>
		({ get: (name: string) => entries[name] }) as unknown as Cookies;
	const board = { slug: 'b1', creatorToken: 'board-tok' };
	const open = { slug: 'sp', passwordHash: null, creatorToken: 'space-tok', accessToken: 'access-tok' };
	const locked = { ...open, passwordHash: 'hash' };

	it('создатель доски в открытом пространстве может создавать задачи', () => {
		expect(canCreateTask(board, open, cookieJar({ retro_creator_b1: 'board-tok' }))).toBe(true);
	});

	it('создатель пространства может без cookie доски, в том числе в закрытом пространстве', () => {
		expect(canCreateTask(board, open, cookieJar({ retro_space_creator_sp: 'space-tok' }))).toBe(true);
		expect(canCreateTask(board, locked, cookieJar({ retro_space_creator_sp: 'space-tok' }))).toBe(true);
	});

	it('гость и неверные токены — нет', () => {
		expect(canCreateTask(board, open, cookieJar({}))).toBe(false);
		expect(canCreateTask(board, open, cookieJar({ retro_creator_b1: 'wrong' }))).toBe(false);
		expect(canCreateTask(board, open, cookieJar({ retro_space_creator_sp: 'wrong' }))).toBe(false);
	});

	it('пустые токены старых досок и пространств прав не дают', () => {
		const oldBoard = { ...board, creatorToken: '' };
		const oldSpace = { ...open, creatorToken: '' };
		expect(canCreateTask(oldBoard, oldSpace, cookieJar({ retro_creator_b1: '', retro_space_creator_sp: '' }))).toBe(false);
	});

	it('создатель доски в закрытом пространстве — только с настоящей cookie доступа', () => {
		expect(canCreateTask(board, locked, cookieJar({ retro_creator_b1: 'board-tok' }))).toBe(false);
		expect(
			canCreateTask(board, locked, cookieJar({ retro_creator_b1: 'board-tok', retro_space_sp: 'authenticated' }))
		).toBe(false);
		expect(
			canCreateTask(board, locked, cookieJar({ retro_creator_b1: 'board-tok', retro_space_sp: 'access-tok' }))
		).toBe(true);
	});
});

describe('createTaskFlow', () => {
	const WEBHOOK: Webhook = { url: 'https://portal.example/rest/1/testcode/', portal: 'portal.example', userId: 1 };
	const FIELDS: TaskFields = {
		title: 'Починить CI',
		description: 'CI падает по утрам',
		groupId: 42,
		deadline: '2026-10-01',
		important: true
	};
	const TASK: CardTask = { id: 745181, url: 'https://portal.example/workgroups/group/42/tasks/task/view/745181/' };
	let log: string[] = [];

	function makeDeps(overrides: Partial<CreateTaskDeps> = {}): CreateTaskDeps {
		return {
			webhook: WEBHOOK,
			connection: { userId: 1, timeZone: 'Europe/Kaliningrad', portalOffset: '+02:00' },
			card: { id: 'card-1', imageId: null },
			fields: FIELDS,
			source: 'card',
			saveTask: vi.fn(async () => {
				log.push('saveTask');
				return true;
			}),
			imageSize: vi.fn(async () => {
				log.push('imageSize');
				return 2048;
			}),
			loadImage: vi.fn(async () => {
				log.push('loadImage');
				return { mimeType: 'image/webp', data: Buffer.from('webp-bytes') };
			}),
			emit: vi.fn(() => {
				log.push('emit');
			}),
			metric: vi.fn((name: string) => {
				log.push(`metric:${name}`);
			}),
			now: vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1250),
			...overrides
		};
	}

	beforeEach(() => {
		log = [];
		vi.mocked(createTask)
			.mockReset()
			.mockImplementation(async () => {
				log.push('createTask');
				return TASK;
			});
		vi.mocked(tagTask)
			.mockReset()
			.mockImplementation(async () => {
				log.push('tagTask');
			});
		vi.mocked(attachImage)
			.mockReset()
			.mockImplementation(async () => {
				log.push('attachImage');
			});
		vi.mocked(withUploadSlot)
			.mockReset()
			.mockImplementation(async (fn) => {
				log.push('slot:enter');
				try {
					return await fn();
				} finally {
					log.push('slot:exit');
				}
			});
	});

	it('успех без картинки: задача сохранена, тег поставлен, метрики и рассылка', async () => {
		const deps = makeDeps();
		const outcome = await createTaskFlow(deps);
		expect(outcome).toEqual({ ok: true, task: TASK, imageAttached: null });
		expect(createTask).toHaveBeenCalledWith(
			WEBHOOK,
			FIELDS,
			{ timeZone: 'Europe/Kaliningrad', portalOffset: '+02:00' },
			idempotencyKey('card-1', FIELDS),
			undefined
		);
		expect(deps.saveTask).toHaveBeenCalledWith('card-1', TASK);
		expect(tagTask).toHaveBeenCalledWith(WEBHOOK, 745181, undefined);
		expect(deps.imageSize).not.toHaveBeenCalled();
		expect(withUploadSlot).not.toHaveBeenCalled();
		expect(deps.emit).toHaveBeenCalledWith('card-1', TASK);
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.created.card', 1);
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.duration_ms', 250, 'ms');
		expect(deps.metric).toHaveBeenCalledTimes(2);
	});

	it('картинка читается и грузится внутри слота; ровно IMAGE_MAX_BYTES — ещё не пропуск', async () => {
		const deps = makeDeps({
			card: { id: 'card-1', imageId: 'img-1' },
			imageSize: vi.fn(async () => {
				log.push('imageSize');
				return IMAGE_MAX_BYTES;
			})
		});
		const outcome = await createTaskFlow(deps);
		expect(outcome).toEqual({ ok: true, task: TASK, imageAttached: true });
		expect(deps.imageSize).toHaveBeenCalledWith('img-1');
		expect(deps.loadImage).toHaveBeenCalledWith('img-1');
		expect(attachImage).toHaveBeenCalledWith(
			WEBHOOK,
			1,
			745181,
			{ cardId: 'card-1', mimeType: 'image/webp', data: Buffer.from('webp-bytes') },
			undefined
		);
		expect(log.indexOf('loadImage')).toBeGreaterThan(log.indexOf('slot:enter'));
		expect(log.indexOf('attachImage')).toBeLessThan(log.indexOf('slot:exit'));
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.image_attached', 1);
	});

	it('порядок: создание → запись → тег → картинка → метрики → рассылка последней', async () => {
		const deps = makeDeps({ card: { id: 'card-1', imageId: 'img-1' }, source: 'summary' });
		await createTaskFlow(deps);
		expect(log).toEqual([
			'createTask',
			'saveTask',
			'tagTask',
			'imageSize',
			'slot:enter',
			'loadImage',
			'attachImage',
			'slot:exit',
			'metric:retro.bitrix.task.image_attached',
			'metric:retro.bitrix.task.created.summary',
			'metric:retro.bitrix.task.duration_ms',
			'emit'
		]);
	});

	it('картинка больше IMAGE_MAX_BYTES не читается и не грузится: image_skipped, imageAttached false', async () => {
		const deps = makeDeps({
			card: { id: 'card-1', imageId: 'img-1' },
			imageSize: vi.fn(async () => IMAGE_MAX_BYTES + 1)
		});
		const outcome = await createTaskFlow(deps);
		expect(outcome).toEqual({ ok: true, task: TASK, imageAttached: false });
		expect(withUploadSlot).not.toHaveBeenCalled();
		expect(deps.loadImage).not.toHaveBeenCalled();
		expect(attachImage).not.toHaveBeenCalled();
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.image_skipped', 1);
		expect(deps.emit).toHaveBeenCalledWith('card-1', TASK);
	});

	it('attachImage упал: задача создана, image_failed, слот освобождён', async () => {
		vi.mocked(attachImage).mockRejectedValueOnce(new BitrixError('scope', 'нет права Диск'));
		const deps = makeDeps({ card: { id: 'card-1', imageId: 'img-1' } });
		const outcome = await createTaskFlow(deps);
		expect(outcome).toEqual({ ok: true, task: TASK, imageAttached: false });
		expect(log).toContain('slot:exit');
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.image_failed', 1);
		expect(deps.metric).not.toHaveBeenCalledWith('retro.bitrix.task.image_attached', 1);
		expect(deps.emit).toHaveBeenCalledWith('card-1', TASK);
	});

	it('строки картинки уже нет (imageSize null): image_failed без захода в слот', async () => {
		const deps = makeDeps({ card: { id: 'card-1', imageId: 'img-1' }, imageSize: vi.fn(async () => null) });
		expect(await createTaskFlow(deps)).toEqual({ ok: true, task: TASK, imageAttached: false });
		expect(withUploadSlot).not.toHaveBeenCalled();
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.image_failed', 1);
	});

	it('loadImage вернул null: image_failed, attachImage не зовётся', async () => {
		const deps = makeDeps({ card: { id: 'card-1', imageId: 'img-1' }, loadImage: vi.fn(async () => null) });
		expect(await createTaskFlow(deps)).toEqual({ ok: true, task: TASK, imageAttached: false });
		expect(attachImage).not.toHaveBeenCalled();
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.image_failed', 1);
	});

	it('очередь на загрузку не дождалась слота: image_failed, байты не читаются', async () => {
		vi.mocked(withUploadSlot).mockRejectedValueOnce(new BitrixError('timeout', 'очередь загрузки'));
		const deps = makeDeps({ card: { id: 'card-1', imageId: 'img-1' } });
		expect(await createTaskFlow(deps)).toEqual({ ok: true, task: TASK, imageAttached: false });
		expect(deps.loadImage).not.toHaveBeenCalled();
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.image_failed', 1);
		expect(deps.emit).toHaveBeenCalledWith('card-1', TASK);
	});

	it('тег не поставился: tag_failed, задача создана и разослана', async () => {
		vi.mocked(tagTask).mockRejectedValueOnce(new BitrixError('rejected', 'tags'));
		const deps = makeDeps();
		expect(await createTaskFlow(deps)).toEqual({ ok: true, task: TASK, imageAttached: null });
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.tag_failed', 1);
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.created.card', 1);
		expect(deps.emit).toHaveBeenCalledWith('card-1', TASK);
	});

	it('saveTask вернул false (карточку удалили): orphaned, not_found, дальше ничего', async () => {
		const deps = makeDeps({ card: { id: 'card-1', imageId: 'img-1' }, saveTask: vi.fn(async () => false) });
		expect(await createTaskFlow(deps)).toEqual({ ok: false, kind: 'not_found' });
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.orphaned', 1);
		expect(deps.metric).toHaveBeenCalledTimes(1);
		expect(tagTask).not.toHaveBeenCalled();
		expect(deps.imageSize).not.toHaveBeenCalled();
		expect(deps.emit).not.toHaveBeenCalled();
	});

	it.each([
		[
			'group',
			new BitrixError('group', 'Доступ запрещен', {
				code: 'BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION',
				status: 403,
				field: 'groupId'
			}),
			{ ok: false, kind: 'group', field: 'groupId', message: 'Доступ запрещен' }
		],
		[
			'access',
			new BitrixError('access', 'Портал отказал', { code: 'ACCESS_DENIED', status: 403 }),
			{ ok: false, kind: 'access', message: 'Портал отказал' }
		],
		['network', new BitrixError('network', 'Портал не ответил'), { ok: false, kind: 'network', message: 'Портал не ответил' }]
	])('BitrixError %s из createTask → отказ того же вида без записи, метрик и рассылки', async (_kind, err, expected) => {
		vi.mocked(createTask).mockRejectedValueOnce(err);
		const deps = makeDeps({ card: { id: 'card-1', imageId: 'img-1' } });
		expect(await createTaskFlow(deps)).toEqual(expected);
		expect(deps.saveTask).not.toHaveBeenCalled();
		expect(tagTask).not.toHaveBeenCalled();
		expect(deps.imageSize).not.toHaveBeenCalled();
		expect(deps.metric).not.toHaveBeenCalled();
		expect(deps.emit).not.toHaveBeenCalled();
	});

	it('не-BitrixError из createTask не маскируется под вид ошибки', async () => {
		vi.mocked(createTask).mockRejectedValueOnce(new TypeError('boom'));
		const deps = makeDeps();
		await expect(createTaskFlow(deps)).rejects.toThrow('boom');
		expect(deps.saveTask).not.toHaveBeenCalled();
	});

	it('source other → created.other; callOpts уходят во все вызовы портала', async () => {
		const callOpts = { timeoutMs: 5000 };
		const deps = makeDeps({ source: 'other', callOpts, card: { id: 'card-1', imageId: 'img-1' } });
		await createTaskFlow(deps);
		expect(deps.metric).toHaveBeenCalledWith('retro.bitrix.task.created.other', 1);
		expect(vi.mocked(createTask).mock.calls[0][4]).toBe(callOpts);
		expect(vi.mocked(tagTask).mock.calls[0][2]).toBe(callOpts);
		expect(vi.mocked(attachImage).mock.calls[0][4]).toBe(callOpts);
	});
});
