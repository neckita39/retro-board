import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { draftKey, readDraft, writeDraft, clearDraft } from './drafts.js';

function fakeStorage() {
	const map = new Map<string, string>();
	return {
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v),
		removeItem: (k: string) => void map.delete(k),
		size: () => map.size,
		keys: () => [...map.keys()]
	};
}

let store: ReturnType<typeof fakeStorage>;

beforeEach(() => {
	store = fakeStorage();
	vi.stubGlobal('localStorage', store);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('draftKey', () => {
	it('своя запись на каждую колонку каждой доски', () => {
		expect(draftKey('board1', 'went_well')).toBe('retro_draft_board1:went_well');
		expect(draftKey('board1', 'went_well')).not.toBe(draftKey('board1', 'improve'));
		expect(draftKey('board1', 'went_well')).not.toBe(draftKey('board2', 'went_well'));
	});
});

describe('черновик', () => {
	it('записанное читается обратно', () => {
		const key = draftKey('b', 'c');
		writeDraft(key, 'недописанная мысль');
		expect(readDraft(key)).toBe('недописанная мысль');
	});

	it('пустого черновика нет: пустые ключи в localStorage не копятся', () => {
		const key = draftKey('b', 'c');
		writeDraft(key, 'текст');
		expect(store.size()).toBe(1);
		writeDraft(key, '   ');
		expect(store.size()).toBe(0);
		expect(readDraft(key)).toBe('');
	});

	it('пробелы вокруг текста сохраняются как есть — курсор не должен прыгать', () => {
		const key = draftKey('b', 'c');
		writeDraft(key, 'мысль с пробелом в конце ');
		expect(readDraft(key)).toBe('мысль с пробелом в конце ');
	});

	it('очистка убирает запись', () => {
		const key = draftKey('b', 'c');
		writeDraft(key, 'текст');
		clearDraft(key);
		expect(readDraft(key)).toBe('');
		expect(store.size()).toBe(0);
	});

	it('черновик одной колонки не задевает соседнюю', () => {
		writeDraft(draftKey('b', 'well'), 'первое');
		writeDraft(draftKey('b', 'bad'), 'второе');
		clearDraft(draftKey('b', 'well'));
		expect(readDraft(draftKey('b', 'bad'))).toBe('второе');
	});

	it('запрещённый localStorage не роняет форму', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('denied');
			},
			setItem: () => {
				throw new Error('denied');
			},
			removeItem: () => {
				throw new Error('denied');
			}
		});
		const key = draftKey('b', 'c');
		expect(() => writeDraft(key, 'текст')).not.toThrow();
		expect(() => clearDraft(key)).not.toThrow();
		expect(readDraft(key)).toBe('');
	});
});
