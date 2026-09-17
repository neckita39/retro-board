import { describe, it, expect } from 'vitest';
import { parseGroupId, parseTaskForm, persistsLastError, statusForKind, type ActionErrorKind } from './bitrix-flows.js';

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
