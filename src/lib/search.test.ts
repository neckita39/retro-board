import { describe, it, expect } from 'vitest';
import { cardMatches, normalizeQuery } from './search.js';

const card = (content: string, authorName: string | null = null) => ({ content, authorName });

describe('normalizeQuery', () => {
	it('регистр не важен', () => {
		expect(normalizeQuery('  ФлаКи  ТЕСТЫ ')).toBe('флаки тесты');
	});
	it('ё и е — одна буква: «ещё» должно находиться по «еще»', () => {
		expect(normalizeQuery('ещё')).toBe(normalizeQuery('еще'));
	});
	it('пустой и пробельный запрос сводятся к пустому', () => {
		expect(normalizeQuery('')).toBe('');
		expect(normalizeQuery('   \n\t ')).toBe('');
	});
});

describe('cardMatches', () => {
	it('пустой запрос подходит всем — поиск выключен', () => {
		expect(cardMatches(card('что угодно'), [], '')).toBe(true);
		expect(cardMatches(card('что угодно'), [], '   ')).toBe(true);
	});

	it('находит по тексту карточки', () => {
		expect(cardMatches(card('Тесты стали флаки'), [], 'флаки')).toBe(true);
		expect(cardMatches(card('Тесты стали флаки'), [], 'релиз')).toBe(false);
	});

	it('находит по части слова', () => {
		expect(cardMatches(card('Тестирование выросло'), [], 'тест')).toBe(true);
	});

	it('слова запроса могут идти в любом порядке и не подряд', () => {
		expect(cardMatches(card('Тесты стали флаки'), [], 'флаки тесты')).toBe(true);
		expect(cardMatches(card('Тесты стали флаки'), [], 'тесты релиз')).toBe(false);
	});

	it('находит по имени автора', () => {
		expect(cardMatches(card('CI зелёный', 'Мария'), [], 'мария')).toBe(true);
	});

	it('находит по тексту комментария — обсуждение часто уходит туда', () => {
		expect(cardMatches(card('CI зелёный'), [{ content: 'наконец-то, спасибо' }], 'спасибо')).toBe(true);
	});

	it('находит по автору комментария', () => {
		expect(cardMatches(card('CI зелёный'), [{ content: 'ок', authorName: 'Пётр' }], 'петр')).toBe(true);
	});

	it('ё в карточке находится по е в запросе и наоборот', () => {
		expect(cardMatches(card('CI зелёный'), [], 'зеленый')).toBe(true);
		expect(cardMatches(card('CI зеленый'), [], 'зелёный')).toBe(true);
	});

	it('пустое имя автора и пустые комментарии не ломают поиск', () => {
		expect(cardMatches(card('текст', null), [], 'текст')).toBe(true);
		expect(cardMatches(card('текст'), [{ content: '' }], 'текст')).toBe(true);
	});

	it('слова из разных источников считаются вместе', () => {
		// «мария» из автора, «флаки» из комментария — карточка подходит
		expect(
			cardMatches(card('CI', 'Мария'), [{ content: 'а вот тесты флаки' }], 'мария флаки')
		).toBe(true);
	});
});
