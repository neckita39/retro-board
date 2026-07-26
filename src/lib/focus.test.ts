import { describe, it, expect } from 'vitest';
import { focusIndex, nextCardId, prevCardId } from './focus.js';

const agenda = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('focusIndex', () => {
	it('returns the position of the card in the agenda', () => {
		expect(focusIndex(agenda, 'a')).toBe(0);
		expect(focusIndex(agenda, 'c')).toBe(2);
	});

	it('returns -1 for a card that is not in the agenda', () => {
		expect(focusIndex(agenda, 'gone')).toBe(-1);
	});

	it('returns -1 when nothing is focused', () => {
		expect(focusIndex(agenda, null)).toBe(-1);
	});

	it('returns -1 for an empty agenda', () => {
		expect(focusIndex([], 'a')).toBe(-1);
	});
});

describe('nextCardId', () => {
	it('moves to the following card', () => {
		expect(nextCardId(agenda, 'a', ['a'])).toBe('b');
		expect(nextCardId(agenda, 'b', ['a', 'b'])).toBe('c');
	});

	it('returns null at the end of the agenda', () => {
		expect(nextCardId(agenda, 'c', ['a', 'b', 'c'])).toBeNull();
	});

	it('returns the first card when nothing is focused yet', () => {
		expect(nextCardId(agenda, null, [])).toBe('a');
	});

	it('falls back to the first undiscussed card when the focused card was deleted', () => {
		// 'b' was being discussed and got deleted; 'a' is already done
		expect(nextCardId([{ id: 'a' }, { id: 'c' }], 'b', ['a', 'b'])).toBe('c');
	});

	it('falls back to the first card when the focused card was deleted and nothing is discussed', () => {
		expect(nextCardId(agenda, 'gone', [])).toBe('a');
	});

	it('returns null when the focused card was deleted and everything else is discussed', () => {
		expect(nextCardId(agenda, 'gone', ['a', 'b', 'c'])).toBeNull();
	});

	it('returns null for an empty agenda', () => {
		expect(nextCardId([], 'a', [])).toBeNull();
		expect(nextCardId([], null, [])).toBeNull();
	});
});

describe('prevCardId', () => {
	it('moves to the preceding card', () => {
		expect(prevCardId(agenda, 'c')).toBe('b');
		expect(prevCardId(agenda, 'b')).toBe('a');
	});

	it('returns null at the start of the agenda', () => {
		expect(prevCardId(agenda, 'a')).toBeNull();
	});

	it('returns null when nothing is focused', () => {
		expect(prevCardId(agenda, null)).toBeNull();
	});

	it('returns null when the focused card is not in the agenda', () => {
		expect(prevCardId(agenda, 'gone')).toBeNull();
	});

	it('returns null for an empty agenda', () => {
		expect(prevCardId([], 'a')).toBeNull();
	});
});
