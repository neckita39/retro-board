import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

// Стор модалки зовёт только trackTaskOpened: настоящий socketStore не нужен
const trackTaskOpened = vi.hoisted(() => vi.fn());
vi.mock('./socket.svelte.js', () => ({ socketStore: { trackTaskOpened } }));

import { bitrixTaskStore } from './bitrix-task.svelte.js';

beforeEach(() => {
	bitrixTaskStore.close();
	trackTaskOpened.mockClear();
});

describe('bitrixTaskStore', () => {
	it('open запоминает карточку и источник и считает открытие', () => {
		bitrixTaskStore.open('c1', 'card');

		expect(bitrixTaskStore.current).toEqual({ cardId: 'c1', source: 'card' });
		expect(trackTaskOpened).toHaveBeenCalledTimes(1);
		expect(trackTaskOpened).toHaveBeenCalledWith('card');
	});

	it('open сбрасывает submitting, оставшийся от прошлой преформы', () => {
		bitrixTaskStore.open('c1', 'card');
		bitrixTaskStore.submitting = true;

		bitrixTaskStore.open('c2', 'summary');

		expect(bitrixTaskStore.current).toEqual({ cardId: 'c2', source: 'summary' });
		expect(bitrixTaskStore.submitting).toBe(false);
		expect(trackTaskOpened).toHaveBeenLastCalledWith('summary');
	});

	it('close закрывает преформу и сбрасывает submitting, метрику не шлёт', () => {
		bitrixTaskStore.open('c1', 'summary');
		bitrixTaskStore.submitting = true;
		trackTaskOpened.mockClear();

		bitrixTaskStore.close();

		expect(bitrixTaskStore.current).toBeNull();
		expect(bitrixTaskStore.submitting).toBe(false);
		expect(trackTaskOpened).not.toHaveBeenCalled();
	});

	// contract guard
	it('сторы доски и сокета не импортируют bitrix-task — иначе цикл импортов', () => {
		for (const file of ['src/lib/stores/board.svelte.ts', 'src/lib/stores/socket.svelte.ts']) {
			expect(readFileSync(file, 'utf-8')).not.toMatch(/from\s+['"][^'"]*bitrix-task/);
		}
	});
});
