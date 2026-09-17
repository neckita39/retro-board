import { describe, it, expect } from 'vitest';
import {
	BOARD_FORMATS,
	VISIBLE_FORMATS,
	ANALYSIS_FORMAT,
	DEFAULT_FORMAT,
	findBoardFormat,
	isValidFormat,
	isValidColumn,
	TONE
} from './formats.js';
import { FORMATS } from './content/formats.js';

describe('реестр форматов', () => {
	it('classic — дефолт и хранит прежние id колонок', () => {
		expect(DEFAULT_FORMAT).toBe('classic');
		expect(findBoardFormat('classic').columns.map((c) => c.id)).toEqual([
			'went_well',
			'didnt_go_well',
			'improve'
		]);
	});

	it('id форматов и колонок уникальны', () => {
		const ids = BOARD_FORMATS.map((f) => f.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const f of BOARD_FORMATS) {
			const cols = f.columns.map((c) => c.id);
			expect(new Set(cols).size).toBe(cols.length);
			expect(cols.length).toBeGreaterThanOrEqual(3);
		}
	});

	it('у каждой SEO-страницы формата есть доска-формат с тем же id', () => {
		for (const seo of FORMATS) {
			expect(isValidFormat(seo.slug)).toBe(true);
			expect(findBoardFormat(seo.slug).columns).toHaveLength(seo.columns.length);
		}
	});

	it('неизвестный формат падает в classic, неизвестная колонка — невалидна', () => {
		expect(findBoardFormat('nope').id).toBe('classic');
		expect(findBoardFormat(null).id).toBe('classic');
		expect(isValidFormat('nope')).toBe(false);
		expect(isValidColumn('sailboat', 'island')).toBe(true);
		expect(isValidColumn('sailboat', 'went_well')).toBe(false);
		expect(isValidColumn('classic', 'went_well')).toBe(true);
	});

	it('названия classic совпадают со словарём — экспорт и e2e на них завязаны', () => {
		const [well, bad, improve] = findBoardFormat('classic').columns;
		expect(well.title).toEqual({ en: 'Went Well', ru: 'Прошло хорошо' });
		expect(bad.title).toEqual({ en: "Didn't Go Well", ru: 'Не получилось' });
		expect(improve.title).toEqual({ en: 'To Improve', ru: 'Улучшить' });
	});

	it('формат analysis скрыт: пикеры его не видят, форма не принимает, доска рендерится', () => {
		expect(ANALYSIS_FORMAT).toBe('analysis');
		expect(isValidFormat('analysis')).toBe(false);
		expect(VISIBLE_FORMATS.some((f) => f.id === 'analysis')).toBe(false);
		expect(VISIBLE_FORMATS.length).toBe(BOARD_FORMATS.length - 1);
		expect(findBoardFormat('analysis').id).toBe('analysis');
		expect(findBoardFormat('analysis').columns.map((c) => c.id)).toEqual([
			'again_well',
			'again_bad',
			'again_improve'
		]);
		expect(isValidColumn('analysis', 'again_bad')).toBe(true);
		expect(isValidColumn('analysis', 'went_well')).toBe(false);
	});

	it('у каждого тона есть полный набор классов, полоска — сплошная', () => {
		for (const tone of ['well', 'bad', 'improve', 'plum'] as const) {
			expect(TONE[tone].border).toMatch(/^border-/);
			expect(TONE[tone].badge).toContain('bg-');
			expect(TONE[tone].tab).toContain('text-white');
			expect(TONE[tone].bar).toBe(`bg-${tone}`);
			// На плитке с иллюстрацией полоска не зависит от темы — art-токен
			expect(TONE[tone].art).toBe(`bg-art-${tone}`);
		}
	});

	it('четвёртая колонка 4L и Sailboat — сливовая, не терракотовая', () => {
		expect(findBoardFormat('4l').columns.at(-1)).toMatchObject({ id: 'longed', tone: 'plum' });
		expect(findBoardFormat('sailboat').columns.at(-1)).toMatchObject({ id: 'island', tone: 'plum' });
		for (const f of BOARD_FORMATS) {
			for (const c of f.columns) expect(['well', 'bad', 'improve', 'plum']).toContain(c.tone);
		}
	});
});
