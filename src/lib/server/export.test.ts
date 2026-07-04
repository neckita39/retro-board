import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

import { assembleExport, toMarkdown } from './export.js';

const ORIGIN = 'https://x.test';

const board = { title: 'Sprint 42', slug: 'abc123', createdAt: new Date('2026-07-01T00:00:00Z') };

const cardRows = [
	{
		id: 'c1',
		columnType: 'went_well',
		content: 'CI is green',
		authorName: 'Maria',
		imageId: 'img-1',
		createdAt: new Date('2026-07-01T10:00:00Z')
	},
	{
		id: 'c2',
		columnType: 'improve',
		content: 'Fewer meetings',
		authorName: null,
		imageId: null,
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
		expect(data.board).toEqual({ title: 'Sprint 42', slug: 'abc123', createdAt: '2026-07-01T00:00:00.000Z' });
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
