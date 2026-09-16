import { describe, it, expect } from 'vitest';
import {
	collectCards,
	isAnalysisBoard,
	ANALYSIS_MAX_CARDS,
	ANALYSIS_CHAR_BUDGET,
	type SourceBoard,
	type SourceCard,
	type SourceVote
} from './analysis.js';

const d = (iso: string) => new Date(iso);

function board(id: string, title: string, createdAt: string, format = 'classic'): SourceBoard {
	return { id, title, format, createdAt: d(createdAt) };
}
function card(id: string, boardId: string, columnType: string, content: string, createdAt: string): SourceCard {
	return { id, boardId, columnType, content, createdAt: d(createdAt) };
}

describe('collectCards — вход для модели', () => {
	const boards = [
		board('b1', 'Sprint 1', '2026-08-01T10:00:00Z'),
		board('b2', 'Sprint 2', '2026-08-15T10:00:00Z', 'sailboat'),
		board('a1', 'Analysis', '2026-08-20T10:00:00Z', 'analysis')
	];
	const cards = [
		card('c1', 'b1', 'went_well', 'ci is green', '2026-08-01T10:01:00Z'),
		card('c2', 'b1', 'didnt_go_well', 'flaky tests', '2026-08-01T10:02:00Z'),
		card('c3', 'b2', 'anchors', 'slow reviews', '2026-08-15T10:01:00Z'),
		card('c4', 'b2', 'wind', 'pairing helped', '2026-08-15T10:02:00Z'),
		card('c5', 'a1', 'again_bad', 'flaky tests again', '2026-08-20T10:01:00Z')
	];
	const votes: SourceVote[] = [
		{ cardId: 'c2', type: 'like' },
		{ cardId: 'c2', type: 'like' },
		{ cardId: 'c2', type: 'dislike' },
		{ cardId: 'c3', type: 'dislike' }
	];

	it('идёт от новой доски и новой карточки, пропускает доски-анализы', () => {
		const entries = collectCards(boards, cards, votes);
		expect(entries.map((e) => e.text)).toEqual(['pairing helped', 'slow reviews', 'flaky tests', 'ci is green']);
		expect(entries.every((e) => e.text !== 'flaky tests again')).toBe(true);
	});

	it('тон берётся из формата доски, дата и название доски прилагаются', () => {
		const entries = collectCards(boards, cards, votes);
		const anchors = entries.find((e) => e.text === 'slow reviews')!;
		expect(anchors).toMatchObject({ tone: 'bad', boardTitle: 'Sprint 2', boardDate: '2026-08-15' });
		expect(entries.find((e) => e.text === 'pairing helped')!.tone).toBe('well');
		expect(entries.find((e) => e.text === 'ci is green')!.tone).toBe('well');
	});

	it('счёт голосов: лайки минус дизлайки', () => {
		const entries = collectCards(boards, cards, votes);
		expect(entries.find((e) => e.text === 'flaky tests')!.score).toBe(1);
		expect(entries.find((e) => e.text === 'slow reviews')!.score).toBe(-1);
		expect(entries.find((e) => e.text === 'ci is green')!.score).toBe(0);
	});

	it('не больше max карточек', () => {
		const many = Array.from({ length: 10 }, (_, i) =>
			card(`m${i}`, 'b1', 'went_well', `card ${i}`, `2026-08-01T10:${String(i).padStart(2, '0')}:00Z`)
		);
		const entries = collectCards([boards[0]], many, [], { max: 3 });
		expect(entries.map((e) => e.text)).toEqual(['card 9', 'card 8', 'card 7']);
	});

	it('бюджет символов режет хвост: карточка, не влезшая целиком, и всё после неё отбрасываются', () => {
		const entries = collectCards(boards, cards, votes, { budget: 26 });
		// 'pairing helped' (14) + 'slow reviews' (12) = 26, 'flaky tests' уже не влезает
		expect(entries.map((e) => e.text)).toEqual(['pairing helped', 'slow reviews']);
	});

	it('неизвестная колонка получает тон accent, пустой текст пропускается', () => {
		const odd = [
			card('o1', 'b1', 'mystery', 'weird column', '2026-08-01T11:00:00Z'),
			card('o2', 'b1', 'went_well', '   ', '2026-08-01T11:01:00Z')
		];
		const entries = collectCards([boards[0]], odd, []);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ text: 'weird column', tone: 'accent' });
	});

	it('дефолты: 150 карточек и 60 000 символов', () => {
		expect(ANALYSIS_MAX_CARDS).toBe(150);
		expect(ANALYSIS_CHAR_BUDGET).toBe(60_000);
		expect(isAnalysisBoard({ format: 'analysis' })).toBe(true);
		expect(isAnalysisBoard({ format: 'classic' })).toBe(false);
	});
});
