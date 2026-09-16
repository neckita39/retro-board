import { describe, it, expect } from 'vitest';
import { moodCounts } from './mood.js';

describe('moodCounts — полоса настроения на плитке пространства', () => {
	it('classic: колонки маппятся в well/bad/improve, plum пустой', () => {
		expect(
			moodCounts('classic', [
				{ columnType: 'went_well', count: 3 },
				{ columnType: 'didnt_go_well', count: 2 },
				{ columnType: 'improve', count: 5 }
			])
		).toEqual({ well: 3, bad: 2, improve: 5, plum: 0 });
	});

	it('start-stop-continue: тон берётся из формата, а не из id колонки', () => {
		expect(
			moodCounts('start-stop-continue', [
				{ columnType: 'start', count: 4 },
				{ columnType: 'stop', count: 1 },
				{ columnType: 'continue', count: 2 }
			])
		).toEqual({ well: 2, bad: 1, improve: 4, plum: 0 });
	});

	it('sailboat: четвёртая колонка «Остров» — plum', () => {
		expect(
			moodCounts('sailboat', [
				{ columnType: 'wind', count: 1 },
				{ columnType: 'anchors', count: 2 },
				{ columnType: 'rocks', count: 3 },
				{ columnType: 'island', count: 4 }
			])
		).toEqual({ well: 1, bad: 2, improve: 3, plum: 4 });
	});

	it('доска-анализ считается как обычная: её колонки — well/bad/improve', () => {
		expect(
			moodCounts('analysis', [
				{ columnType: 'again_well', count: 6 },
				{ columnType: 'again_bad', count: 4 },
				{ columnType: 'again_improve', count: 5 }
			])
		).toEqual({ well: 6, bad: 4, improve: 5, plum: 0 });
	});

	it('неизвестная колонка не попадает ни в один тон', () => {
		expect(
			moodCounts('classic', [
				{ columnType: 'went_well', count: 2 },
				{ columnType: 'island', count: 7 },
				{ columnType: '', count: 1 }
			])
		).toEqual({ well: 2, bad: 0, improve: 0, plum: 0 });
	});

	it('пустой список и неизвестный формат дают нули (формат падает в classic)', () => {
		expect(moodCounts('classic', [])).toEqual({ well: 0, bad: 0, improve: 0, plum: 0 });
		expect(moodCounts('nope', [{ columnType: 'went_well', count: 1 }])).toEqual({ well: 1, bad: 0, improve: 0, plum: 0 });
		expect(moodCounts(null, [{ columnType: 'improve', count: 2 }])).toEqual({ well: 0, bad: 0, improve: 2, plum: 0 });
	});

	it('несколько строк одной колонки суммируются', () => {
		expect(
			moodCounts('4l', [
				{ columnType: 'longed', count: 1 },
				{ columnType: 'longed', count: 2 }
			])
		).toEqual({ well: 0, bad: 0, improve: 0, plum: 3 });
	});
});
