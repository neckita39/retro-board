import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));
import { assembleSpaceBoards, spaceBoardsToMarkdown, spaceAnalysesToMarkdown } from './space-export.js';
import type { BoardExport } from './export.js';

const space = { slug: 'sp-slug', name: 'Team Alpha', createdAt: new Date('2026-08-01T10:00:00Z') };
const rows = [
	{ slug: 'b-old', title: 'Sprint 1', format: 'classic', createdAt: new Date('2026-08-02T10:00:00Z') },
	{ slug: 'b-new', title: 'Sprint 2', format: 'sailboat', createdAt: new Date('2026-08-16T10:00:00Z') },
	{ slug: 'b-ai', title: 'Space analysis for 17.08.2026', format: 'analysis', createdAt: new Date('2026-08-17T10:00:00Z') }
];

describe('assembleSpaceBoards', () => {
	it('пространство и доски от новой к старой, у каждой slug, title, format, createdAt, url', () => {
		const data = assembleSpaceBoards(space, rows, 'https://retro.example');
		expect(data.space).toEqual({ slug: 'sp-slug', name: 'Team Alpha', createdAt: '2026-08-01T10:00:00.000Z' });
		expect(data.boards.map((b) => b.slug)).toEqual(['b-ai', 'b-new', 'b-old']);
		expect(data.boards[1]).toEqual({
			slug: 'b-new',
			title: 'Sprint 2',
			format: 'sailboat',
			createdAt: '2026-08-16T10:00:00.000Z',
			url: 'https://retro.example/b-new'
		});
	});
});

describe('spaceBoardsToMarkdown', () => {
	it('заголовок пространства и список ссылок с датой и форматом', () => {
		const md = spaceBoardsToMarkdown(assembleSpaceBoards(space, rows, 'https://retro.example'), 'en');
		expect(md.startsWith('# Team Alpha\n')).toBe(true);
		expect(md).toContain('- [Sprint 2](https://retro.example/b-new) — 2026-08-16 · sailboat');
		expect(md).toContain('- [Space analysis for 17.08.2026](https://retro.example/b-ai) — 2026-08-17 · analysis');
	});
	it('пустое пространство — пометка вместо списка', () => {
		const md = spaceBoardsToMarkdown(assembleSpaceBoards(space, [], 'https://x'), 'ru');
		expect(md).toContain('*Досок пока нет*');
	});
});

describe('spaceAnalysesToMarkdown', () => {
	const analysis: BoardExport = {
		board: { title: 'Space analysis for 17.08.2026', slug: 'b-ai', format: 'analysis', createdAt: '2026-08-17T10:00:00.000Z' },
		columns: {
			again_well: [{ content: 'Deploys are smooth (in 3 boards)', authorName: 'AI analysis', likes: 0, dislikes: 0, imageUrl: null, createdAt: '2026-08-17T10:00:00.000Z', comments: [] }],
			again_bad: [],
			again_improve: []
		}
	};
	it('заголовок пространства, затем каждый анализ как отдельная доска', () => {
		const md = spaceAnalysesToMarkdown({ space: { slug: 'sp-slug', name: 'Team Alpha', createdAt: '2026-08-01T10:00:00.000Z' }, analyses: [analysis] }, 'en');
		expect(md.startsWith('# Team Alpha — AI analyses\n')).toBe(true);
		expect(md).toContain('## Space analysis for 17.08.2026');
		expect(md).toContain('### Still good');
		expect(md).toContain('- Deploys are smooth (in 3 boards) — *AI analysis*');
	});
	it('без анализов — пометка', () => {
		const md = spaceAnalysesToMarkdown({ space: { slug: 's', name: 'N', createdAt: '2026-08-01T10:00:00.000Z' }, analyses: [] }, 'ru');
		expect(md).toContain('*Анализов пока нет*');
	});
});
