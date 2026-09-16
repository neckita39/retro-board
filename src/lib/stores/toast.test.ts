import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toastStore } from './toast.svelte.js';

describe('toastStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		toastStore.clear();
	});
	afterEach(() => vi.useRealTimers());

	it('push добавляет уведомление, dismiss убирает', () => {
		const id = toastStore.push({ kind: 'info', text: 'hi' });
		expect(toastStore.toasts).toHaveLength(1);
		expect(toastStore.toasts[0]).toMatchObject({ id, kind: 'info', text: 'hi' });
		toastStore.dismiss(id);
		expect(toastStore.toasts).toHaveLength(0);
	});

	it('само скрывается через 8 с, ошибка — через 12 с', () => {
		toastStore.push({ kind: 'success', text: 'ok' });
		toastStore.push({ kind: 'error', text: 'bad' });
		vi.advanceTimersByTime(8_000);
		expect(toastStore.toasts.map((t) => t.text)).toEqual(['bad']);
		vi.advanceTimersByTime(4_000);
		expect(toastStore.toasts).toHaveLength(0);
	});

	it('явный timeoutMs побеждает дефолт, стопка сохраняет порядок', () => {
		toastStore.push({ kind: 'info', text: 'a', timeoutMs: 1_000 });
		toastStore.push({ kind: 'info', text: 'b' });
		expect(toastStore.toasts.map((t) => t.text)).toEqual(['a', 'b']);
		vi.advanceTimersByTime(1_000);
		expect(toastStore.toasts.map((t) => t.text)).toEqual(['b']);
	});
});
