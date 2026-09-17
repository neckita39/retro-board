import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

import { assembleExport, toMarkdown } from './export.js';

const ORIGIN = 'https://x.test';

const board = { title: 'Sprint 42', slug: 'abc123', format: 'classic', createdAt: new Date('2026-07-01T00:00:00Z') };

const cardRows = [
	{
		id: 'c1',
		columnType: 'went_well',
		content: 'CI is green',
		authorName: 'Maria',
		imageId: 'img-1',
		bitrixTaskId: null,
		bitrixTaskUrl: null,
		createdAt: new Date('2026-07-01T10:00:00Z')
	},
	{
		id: 'c2',
		columnType: 'improve',
		content: 'Fewer meetings',
		authorName: null,
		imageId: null,
		bitrixTaskId: null,
		bitrixTaskUrl: null,
		createdAt: new Date('2026-07-01T11:00:00Z')
	}
];

const voteRows = [
	{ cardId: 'c1', type: 'like' },
	{ cardId: 'c1', type: 'like' },
	{ cardId: 'c1', type: 'dislike' }
];

const commentRows = [
	{
		cardId: 'c1',
		content: 'Huge relief!',
		authorName: 'Peter',
		imageId: null,
		createdAt: new Date('2026-07-01T12:00:00Z')
	}
];

describe('assembleExport', () => {
	it('groups cards by column with likes, dislikes, image urls and dates', () => {
		const data = assembleExport(board, cardRows, voteRows, commentRows, ORIGIN);
		expect(data.board).toEqual({ title: 'Sprint 42', slug: 'abc123', format: 'classic', createdAt: '2026-07-01T00:00:00.000Z' });
		const wentWell = data.columns.went_well;
		expect(wentWell).toHaveLength(1);
		expect(wentWell[0].likes).toBe(2);
		expect(wentWell[0].dislikes).toBe(1);
		expect(wentWell[0].imageUrl).toBe('https://x.test/api/image/img-1');
		expect(wentWell[0].createdAt).toBe('2026-07-01T10:00:00.000Z');
		expect(wentWell[0].comments).toEqual([
			{
				content: 'Huge relief!',
				authorName: 'Peter',
				imageUrl: null,
				createdAt: '2026-07-01T12:00:00.000Z'
			}
		]);
		expect(data.columns.didnt_go_well).toEqual([]);
		expect(data.columns.improve).toHaveLength(1);
		expect(data.columns.improve[0].imageUrl).toBeNull();
	});
});

describe('toMarkdown', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-04T12:00:00Z'));
	});
	afterEach(() => vi.useRealTimers());

	it('renders english markdown with votes, images and comments', () => {
		const md = toMarkdown(assembleExport(board, cardRows, voteRows, commentRows, ORIGIN), 'en');
		expect(md).toContain('# Sprint 42');
		expect(md).toContain('*Exported: 2026-07-04*');
		expect(md).toContain('## Went Well');
		expect(md).toContain('- CI is green — *Maria* [2 likes, 1 dislike]');
		expect(md).toContain('  ![image](https://x.test/api/image/img-1)');
		expect(md).toContain('  - Huge relief! — *Peter*');
		expect(md).toContain("## Didn't Go Well");
		expect(md).toContain('*No cards*');
	});

	it('renders russian headings and plurals with lang=ru', () => {
		const md = toMarkdown(assembleExport(board, cardRows, voteRows, commentRows, ORIGIN), 'ru');
		expect(md).toContain('## Прошло хорошо');
		expect(md).toContain('[2 лайка, 1 дизлайк]');
		expect(md).toContain('*Нет карточек*');
	});

	it('omits the votes bracket when there are no votes', () => {
		const md = toMarkdown(assembleExport(board, cardRows, [], [], ORIGIN), 'en');
		expect(md).toContain('- CI is green — *Maria*\n');
		expect(md).not.toContain('[0');
	});
});

describe('экспорт не-классического формата', () => {
	const sailboat = { ...board, format: 'sailboat' };
	const rows = [
		{ id: 'c1', columnType: 'rocks', content: 'legacy auth expires', authorName: null, imageId: null, bitrixTaskId: null, bitrixTaskUrl: null, createdAt: new Date('2026-07-01T10:00:00Z') }
	];

	it('ключи JSON — колонки формата в его порядке', () => {
		const data = assembleExport(sailboat, rows, [], [], ORIGIN);
		expect(data.board.format).toBe('sailboat');
		expect(Object.keys(data.columns)).toEqual(['wind', 'anchors', 'rocks', 'island']);
		expect(data.columns.rocks[0].content).toBe('legacy auth expires');
	});

	it('заголовки Markdown — названия колонок формата на нужном языке', () => {
		const en = toMarkdown(assembleExport(sailboat, rows, [], [], ORIGIN), 'en');
		expect(en).toContain('## Wind');
		expect(en).toContain('## Island');
		expect(en).not.toContain('## Went Well');
		const ru = toMarkdown(assembleExport(sailboat, rows, [], [], ORIGIN), 'ru');
		expect(ru).toContain('## Рифы');
	});
});

describe('задача Битрикс24 в экспорте', () => {
	const TASK_URL = 'https://bitrix24.team/workgroups/group/2014/tasks/task/view/745181/';
	const rows = [{ ...cardRows[0], bitrixTaskId: 745181, bitrixTaskUrl: TASK_URL }, cardRows[1]];

	it('JSON: у карточки с задачей task = { id, url }, у карточки без задачи — null', () => {
		const data = assembleExport(board, rows, [], [], ORIGIN);
		expect(data.columns.went_well[0].task).toEqual({ id: 745181, url: TASK_URL });
		expect(data.columns.improve[0].task).toBeNull();
	});

	it('JSON: id без ссылки задачей не считается', () => {
		const data = assembleExport(board, [{ ...cardRows[1], bitrixTaskId: 7, bitrixTaskUrl: null }], [], [], ORIGIN);
		expect(data.columns.improve[0].task).toBeNull();
	});

	it('Markdown: строка со ссылкой под карточкой — после картинки, перед комментариями', () => {
		const md = toMarkdown(assembleExport(board, rows, [], commentRows, ORIGIN), 'en');
		expect(md).toContain(
			`- CI is green — *Maria*\n  ![image](https://x.test/api/image/img-1)\n  [Task #745181](${TASK_URL})\n  - Huge relief! — *Peter*\n`
		);
		expect(md.match(/\[Task #/g)).toHaveLength(1);
	});

	it('Markdown: подпись строки задачи на русском', () => {
		const md = toMarkdown(assembleExport(board, rows, [], [], ORIGIN), 'ru');
		expect(md).toContain(`  [Задача #745181](${TASK_URL})\n`);
	});
});
