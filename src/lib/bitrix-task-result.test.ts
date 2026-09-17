import { describe, it, expect } from 'vitest';
import { taskResultReaction, type TaskFormReaction } from './bitrix-task-result.js';

const task = { id: 745181, url: 'https://bitrix24.team/workgroups/group/2014/tasks/task/view/745181/' };

function failure(data: Record<string, unknown>, status = 409) {
	return { type: 'failure' as const, status, data };
}

function form(patch: Partial<TaskFormReaction>): TaskFormReaction {
	return { type: 'form', errorKey: null, params: {}, settings: false, retry: false, field: null, groupNotFound: false, ...patch };
}

describe('taskResultReaction — успех', () => {
	it('задача создана: закрыть модалку и показать тост «создана»', () => {
		expect(taskResultReaction({ type: 'success', status: 200, data: { task, imageAttached: true } })).toEqual({
			type: 'created',
			task,
			toastKey: 'bitrix.toast.created'
		});
		expect(taskResultReaction({ type: 'success', status: 200, data: { task, imageAttached: null } })).toEqual({
			type: 'created',
			task,
			toastKey: 'bitrix.toast.created'
		});
	});

	it('картинка не прикрепилась — тост предупреждает', () => {
		expect(taskResultReaction({ type: 'success', status: 200, data: { task, imageAttached: false } })).toEqual({
			type: 'created',
			task,
			toastKey: 'bitrix.toast.createdNoImage'
		});
	});

	it('успех без корректной задачи в ответе — тост ошибки, форма остаётся', () => {
		expect(taskResultReaction({ type: 'success', status: 200, data: {} })).toEqual({ type: 'toast', toastKey: 'bitrix.toast.error' });
		expect(taskResultReaction({ type: 'success', status: 200, data: { task: { id: '1', url: '/x' } } })).toEqual({
			type: 'toast',
			toastKey: 'bitrix.toast.error'
		});
	});
});

describe('taskResultReaction — отказы экшена', () => {
	it('exists: закрыть модалку, бейдж из ответа', () => {
		expect(taskResultReaction(failure({ bitrixError: 'exists', task }))).toEqual({ type: 'exists', task });
		expect(taskResultReaction(failure({ bitrixError: 'exists' }))).toEqual({ type: 'exists', task: null });
	});

	it('forbidden и not_found: тост ошибки и закрыть модалку', () => {
		expect(taskResultReaction(failure({ bitrixError: 'forbidden' }, 403))).toEqual({ type: 'closeWithToast', toastKey: 'bitrix.error.forbidden' });
		expect(taskResultReaction(failure({ bitrixError: 'not_found' }, 404))).toEqual({ type: 'closeWithToast', toastKey: 'bitrix.error.not_found' });
	});

	it('вебхук, права, доступ и нет подключения: текст и ссылка в настройки пространства', () => {
		for (const kind of ['invalid_webhook', 'scope', 'access', 'not_connected']) {
			expect(taskResultReaction(failure({ bitrixError: kind }))).toEqual(form({ errorKey: `bitrix.error.${kind}`, settings: true }));
		}
	});

	it('сеть, таймаут, ответ, лимиты и «уже создаёт»: текст и кнопка «Повторить»', () => {
		for (const kind of ['network', 'timeout', 'shape', 'limit', 'rate_limited', 'running']) {
			expect(taskResultReaction(failure({ bitrixError: kind }, 502))).toEqual(form({ errorKey: `bitrix.error.${kind}`, retry: true }));
		}
	});

	it('group: подсветка поля группы без текста в error-box', () => {
		expect(taskResultReaction(failure({ bitrixError: 'group' }))).toEqual(form({ field: 'groupId', groupNotFound: true }));
	});

	it('invalid: подсветка названного поля; скрытое поле не подсвечивается', () => {
		expect(taskResultReaction(failure({ bitrixError: 'invalid', field: 'deadline' }, 422))).toEqual(
			form({ errorKey: 'bitrix.error.invalid', field: 'deadline' })
		);
		expect(taskResultReaction(failure({ bitrixError: 'invalid', field: 'cardId' }, 422))).toEqual(form({ errorKey: 'bitrix.error.invalid' }));
	});

	it('rejected: текст портала и поле, если портал его назвал', () => {
		expect(
			taskResultReaction(failure({ bitrixError: 'rejected', message: 'Крайний срок в прошлом', field: 'deadline' }, 422))
		).toEqual(form({ errorKey: 'bitrix.error.rejected', params: { message: 'Крайний срок в прошлом' }, field: 'deadline' }));
		expect(taskResultReaction(failure({ bitrixError: 'rejected', field: 'responsibleId' }, 422))).toEqual(
			form({ errorKey: 'bitrix.error.rejected', params: { message: '' } })
		);
	});

	it('encryption: текст без повтора и без ссылки', () => {
		expect(taskResultReaction(failure({ bitrixError: 'encryption' }, 503))).toEqual(form({ errorKey: 'bitrix.error.encryption' }));
	});

	it('ветвление по bitrixError, а не по статусу', () => {
		expect(taskResultReaction(failure({ bitrixError: 'forbidden' }, 502))).toEqual({ type: 'closeWithToast', toastKey: 'bitrix.error.forbidden' });
		expect(taskResultReaction(failure({ bitrixError: 'network' }, 403))).toEqual(form({ errorKey: 'bitrix.error.network', retry: true }));
	});

	it('неизвестный вид или пустой ответ — тост ошибки, форма остаётся', () => {
		expect(taskResultReaction(failure({ bitrixError: 'something_new' }))).toEqual({ type: 'toast', toastKey: 'bitrix.toast.error' });
		expect(taskResultReaction({ type: 'failure', status: 500 })).toEqual({ type: 'toast', toastKey: 'bitrix.toast.error' });
	});
});

describe('taskResultReaction — ответы не от экшена', () => {
	it('неожиданная ошибка сервера — тост, форма остаётся', () => {
		expect(taskResultReaction({ type: 'error', status: 500, error: new Error('boom') })).toEqual({
			type: 'toast',
			toastKey: 'bitrix.toast.error'
		});
	});

	it('редирект игнорируется', () => {
		expect(taskResultReaction({ type: 'redirect', status: 303, location: '/' })).toBeNull();
	});
});
