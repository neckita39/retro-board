import { describe, it, expect } from 'vitest';
import { analysisTransition, type AnalysisState } from './analysis-state.js';

const pending: AnalysisState = { state: 'pending', id: 'a1', title: 'T', createdAt: '2026-09-16T10:00:00Z' };
const ready: AnalysisState = { state: 'ready', id: 'a1', title: 'T', createdAt: '2026-09-16T10:00:00Z', board: { slug: 's', title: 'T' } };
const failed: AnalysisState = { state: 'failed', id: 'a1', title: 'T', createdAt: '2026-09-16T10:00:00Z', error: 'http' };

describe('analysisTransition — когда показывать уведомление', () => {
	it('первое применение молчит', () => {
		expect(analysisTransition(null, pending)).toBeNull();
		expect(analysisTransition(null, ready)).toBeNull();
	});
	it('idle → pending: запущен; pending → ready: готов; pending → failed: ошибка', () => {
		expect(analysisTransition({ state: 'idle' }, pending)).toBe('started');
		expect(analysisTransition(pending, ready)).toBe('ready');
		expect(analysisTransition(pending, failed)).toBe('failed');
	});
	it('то же состояние с тем же id не повторяет уведомление', () => {
		expect(analysisTransition(pending, { ...pending })).toBeNull();
		expect(analysisTransition(ready, { ...ready })).toBeNull();
	});
	it('новая попытка после failed или ready — снова «запущен»', () => {
		expect(analysisTransition(failed, { ...pending, id: 'a2' })).toBe('started');
		expect(analysisTransition(ready, { ...pending, id: 'a2' })).toBe('started');
	});
	it('переход в idle молчит', () => {
		expect(analysisTransition(ready, { state: 'idle' })).toBeNull();
	});
	it('скрыли упавший анализ — показалась более старая готовая доска, без «готов»', () => {
		const olderReady: AnalysisState = { ...ready, id: 'a0', createdAt: '2026-09-15T10:00:00Z' };
		expect(analysisTransition(failed, olderReady)).toBeNull();
		// а более новая готовая — это новая попытка, о ней сообщаем
		const newerReady: AnalysisState = { ...ready, id: 'a2', createdAt: '2026-09-17T10:00:00Z' };
		expect(analysisTransition(failed, newerReady)).toBe('ready');
	});
});
