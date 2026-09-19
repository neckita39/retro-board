import { describe, it, expect } from 'vitest';
import { viewCard, viewCards, isHidden, visibleComments } from './blind.js';

interface MaskableCard {
	id: string;
	columnType: string;
	content: string;
	authorName: string | null;
	authorSession?: string | null;
	imageId?: string | null;
	imageWidth?: number | null;
	imageHeight?: number | null;
	bitrixTaskId?: number | null;
	bitrixTaskUrl?: string | null;
	createdAt?: string;
}

const card = (over: Partial<MaskableCard> = {}): MaskableCard => ({
	id: 'c1',
	columnType: 'went_well',
	content: 'релизы стали быстрее',
	authorName: 'Мария',
	authorSession: 'sess-A',
	imageId: 'img-1',
	imageWidth: 100,
	imageHeight: 50,
	bitrixTaskId: 42,
	bitrixTaskUrl: 'https://portal/task/42',
	createdAt: '2026-09-19T10:00:00.000Z',
	...over
});

describe('viewCard', () => {
	it('режим выключен — карточка видна всем целиком', () => {
		const v = viewCard(card(), false, 'sess-B');
		expect(v.content).toBe('релизы стали быстрее');
		expect(v.authorName).toBe('Мария');
		expect(isHidden(v)).toBe(false);
	});

	it('author_session не уходит клиенту никогда — даже владельцу', () => {
		expect(viewCard(card(), false, 'sess-A')).not.toHaveProperty('authorSession');
		expect(viewCard(card(), true, 'sess-A')).not.toHaveProperty('authorSession');
		expect(viewCard(card(), true, 'sess-B')).not.toHaveProperty('authorSession');
	});

	it('слепой ввод: свою карточку автор видит', () => {
		const v = viewCard(card(), true, 'sess-A');
		expect(v.content).toBe('релизы стали быстрее');
		expect(isHidden(v)).toBe(false);
	});

	it('слепой ввод: чужая карточка приходит рубашкой', () => {
		const v = viewCard(card(), true, 'sess-B');
		expect(v.content).toBe('');
		expect(v.authorName).toBe(null);
		expect(isHidden(v)).toBe(true);
	});

	it('рубашка сохраняет место в колонке: id, колонка и время остаются', () => {
		const v = viewCard(card(), true, 'sess-B');
		expect(v.id).toBe('c1');
		expect(v.columnType).toBe('went_well');
		expect(v.createdAt).toBe('2026-09-19T10:00:00.000Z');
	});

	it('рубашка не протекает картинкой и задачей', () => {
		const v = viewCard(card(), true, 'sess-B');
		expect(v.imageId).toBe(null);
		expect(v.imageWidth).toBe(null);
		expect(v.bitrixTaskId).toBe(null);
		expect(v.bitrixTaskUrl).toBe(null);
	});

	it('карточка без author_session (создана до режима) скрыта от всех', () => {
		const old = card({ authorSession: null });
		expect(isHidden(viewCard(old, true, 'sess-A'))).toBe(true);
		expect(isHidden(viewCard(old, true, ''))).toBe(true);
	});

	it('пустой сессионный идентификатор зрителя не открывает чужие карточки', () => {
		expect(isHidden(viewCard(card(), true, ''))).toBe(true);
	});
});

describe('viewCards и комментарии', () => {
	const cards = [card({ id: 'mine', authorSession: 'sess-A' }), card({ id: 'theirs', authorSession: 'sess-B' })];

	it('в списке своя открыта, чужая — рубашкой', () => {
		const v = viewCards(cards, true, 'sess-A');
		expect(isHidden(v[0])).toBe(false);
		expect(isHidden(v[1])).toBe(true);
	});

	it('комментарии скрытых карточек не отдаются — по ним видно содержимое', () => {
		const v = viewCards(cards, true, 'sess-A');
		const comments = [
			{ id: 'k1', cardId: 'mine', content: 'мой' },
			{ id: 'k2', cardId: 'theirs', content: 'чужой' }
		];
		expect(visibleComments(comments, v).map((c) => c.id)).toEqual(['k1']);
	});

	it('режим выключен — комментарии все', () => {
		const v = viewCards(cards, false, 'sess-A');
		const comments = [
			{ id: 'k1', cardId: 'mine', content: 'мой' },
			{ id: 'k2', cardId: 'theirs', content: 'чужой' }
		];
		expect(visibleComments(comments, v)).toHaveLength(2);
	});
});
