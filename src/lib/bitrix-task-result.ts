// Реакция преформы задачи на ответ экшена createTask — таблица из спеки
// (Секция 4, «Реакция на result»). Ветвимся только по bitrixError, статус не читаем.
// Ключи i18n возвращаем, а не переводим: модуль чистый, t() зовёт компонент.
import type { ActionResult } from '@sveltejs/kit';
import type { CardTask } from '$lib/types.js';

export type TaskFormField = 'title' | 'description' | 'groupId' | 'deadline';

/** Форма остаётся открытой: текст в error-box (errorKey), подсветка поля, «Повторить» или ссылка в настройки */
export interface TaskFormReaction {
	type: 'form';
	errorKey: string | null;
	params: Record<string, string>;
	settings: boolean;
	retry: boolean;
	field: TaskFormField | null;
	groupNotFound: boolean;
}

export type TaskReaction =
	| { type: 'created'; task: CardTask; toastKey: 'bitrix.toast.created' | 'bitrix.toast.createdNoImage' }
	| { type: 'exists'; task: CardTask | null }
	| { type: 'closeWithToast'; toastKey: string }
	| { type: 'toast'; toastKey: string }
	| TaskFormReaction;

const FIELDS: readonly TaskFormField[] = ['title', 'description', 'groupId', 'deadline'];
const SETTINGS_KINDS = new Set(['invalid_webhook', 'scope', 'access', 'not_connected']);
const RETRY_KINDS = new Set(['network', 'timeout', 'shape', 'limit', 'rate_limited', 'running']);
// Общий на все ветки объект — заморожен, чтобы вызывающий не мог его случайно изменить
const GENERIC: TaskReaction = Object.freeze({ type: 'toast', toastKey: 'bitrix.toast.error' } as const);

function isCardTask(value: unknown): value is CardTask {
	const o = value as { id?: unknown; url?: unknown } | null | undefined;
	return !!o && typeof o.id === 'number' && typeof o.url === 'string';
}

function knownField(value: unknown): TaskFormField | null {
	return FIELDS.includes(value as TaskFormField) ? (value as TaskFormField) : null;
}

function form(patch: Partial<TaskFormReaction>): TaskFormReaction {
	return { type: 'form', errorKey: null, params: {}, settings: false, retry: false, field: null, groupNotFound: false, ...patch };
}

export function taskResultReaction(result: ActionResult): TaskReaction | null {
	if (result.type === 'redirect') return null;
	if (result.type === 'error') return GENERIC;

	const data = (result.data ?? {}) as {
		task?: unknown;
		imageAttached?: unknown;
		bitrixError?: unknown;
		field?: unknown;
		message?: unknown;
	};

	if (result.type === 'success') {
		if (!isCardTask(data.task)) return GENERIC;
		return {
			type: 'created',
			task: data.task,
			toastKey: data.imageAttached === false ? 'bitrix.toast.createdNoImage' : 'bitrix.toast.created'
		};
	}

	const kind = typeof data.bitrixError === 'string' ? data.bitrixError : '';
	if (kind === 'exists') return { type: 'exists', task: isCardTask(data.task) ? data.task : null };
	if (kind === 'forbidden' || kind === 'not_found') return { type: 'closeWithToast', toastKey: `bitrix.error.${kind}` };
	if (SETTINGS_KINDS.has(kind)) return form({ errorKey: `bitrix.error.${kind}`, settings: true });
	if (RETRY_KINDS.has(kind)) return form({ errorKey: `bitrix.error.${kind}`, retry: true });
	if (kind === 'group') return form({ field: 'groupId', groupNotFound: true });
	if (kind === 'invalid') return form({ errorKey: 'bitrix.error.invalid', field: knownField(data.field) });
	if (kind === 'rejected') {
		const message = typeof data.message === 'string' ? data.message : '';
		// Портал отказал молча: «Портал отклонил задачу: » с висящим двоеточием читать не на чем,
		// показываем текст «непонятный ответ портала»
		return message
			? form({ errorKey: 'bitrix.error.rejected', params: { message }, field: knownField(data.field) })
			: form({ errorKey: 'bitrix.error.shape', field: knownField(data.field) });
	}
	if (kind === 'encryption') return form({ errorKey: 'bitrix.error.encryption' });
	return GENERIC;
}
