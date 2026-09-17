import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

import en from './i18n/en.json';
import ru from './i18n/ru.json';
import { translate } from './i18n/index.js';
import { panelErrorKey, panelSuccessKey } from './bitrix-panel.js';

// Всё, что может прийти в bitrixError: виды портала (BitrixErrorKind) и ошибки экшенов
const KINDS = [
	'invalid_url',
	'invalid_webhook',
	'scope',
	'access',
	'limit',
	'group',
	'rejected',
	'network',
	'timeout',
	'shape',
	'forbidden',
	'not_found',
	'not_connected',
	'running',
	'invalid',
	'rate_limited',
	'encryption'
];

const PANEL_KEYS = [
	'bitrix.panel.toggle',
	'bitrix.panel.intro',
	'bitrix.panel.webhook',
	'bitrix.panel.webhookPlaceholder',
	'bitrix.panel.group',
	'bitrix.panel.connect',
	'bitrix.panel.connecting',
	'bitrix.panel.cancel',
	'bitrix.panel.hint',
	'bitrix.panel.connected',
	'bitrix.panel.disconnected',
	'bitrix.panel.saved',
	'bitrix.panel.createdBy',
	'bitrix.panel.createdByHint',
	'bitrix.panel.defaultGroup',
	'bitrix.panel.noGroup',
	'bitrix.panel.groupEmptyHint',
	'bitrix.panel.save',
	'bitrix.panel.disconnect',
	'bitrix.panel.disconnectConfirm',
	'bitrix.panel.lastError',
	'bitrix.panel.encryptionOff',
	'bitrix.panel.groupNameUnavailable',
	'bitrix.menu.connect'
];

const LOCALES = ['ru', 'en'] as const;

describe('panelErrorKey', () => {
	it('берёт _panel-вариант, если он есть', () => {
		expect(panelErrorKey('invalid_webhook')).toBe('bitrix.error.invalid_webhook_panel');
		expect(panelErrorKey('network')).toBe('bitrix.error.network_panel');
		expect(panelErrorKey('rate_limited')).toBe('bitrix.error.rate_limited_panel');
	});

	it('без _panel-варианта берёт общий ключ вида', () => {
		expect(panelErrorKey('invalid_url')).toBe('bitrix.error.invalid_url');
		expect(panelErrorKey('scope')).toBe('bitrix.error.scope');
		expect(panelErrorKey('access')).toBe('bitrix.error.access');
		expect(panelErrorKey('group')).toBe('bitrix.error.group');
		expect(panelErrorKey('encryption')).toBe('bitrix.error.encryption');
	});

	it('timeout, shape и limit в панели говорят «портал не отвечает», а не текстом модалки', () => {
		for (const kind of ['timeout', 'shape', 'limit']) {
			expect(panelErrorKey(kind)).toBe('bitrix.error.network_panel');
		}
		expect(translate('ru', panelErrorKey('timeout'))).toBe('Портал не отвечает. Попробуйте через минуту.');
		expect(translate('en', panelErrorKey('limit'))).toBe("The portal isn't responding. Try again in a minute.");
	});

	it('неизвестный вид не показывает сырой ключ', () => {
		expect(panelErrorKey('something_new')).toBe('bitrix.error.network_panel');
		expect(panelErrorKey('toString')).toBe('bitrix.error.network_panel');
	});

	it('у каждого вида есть текст в обеих локалях — и в панели, и общий', () => {
		for (const locale of LOCALES) {
			for (const kind of KINDS) {
				const panelKey = panelErrorKey(kind);
				expect(translate(locale, panelKey), `${locale}: ${panelKey}`).not.toBe(panelKey);
				const key = `bitrix.error.${kind}`;
				expect(translate(locale, key), `${locale}: ${key}`).not.toBe(key);
			}
		}
	});

	it('тексты ошибок совпадают с контрактом и макетом', () => {
		expect(translate('ru', 'bitrix.error.invalid_url')).toBe(
			'Это не похоже на входящий вебхук. Нужна ссылка вида https://портал.bitrix24.ru/rest/1/…/'
		);
		expect(translate('en', 'bitrix.error.invalid_url')).toBe(
			"That doesn't look like an inbound webhook. Expected https://portal.bitrix24.com/rest/1/…/"
		);
		expect(translate('ru', 'bitrix.error.invalid_webhook_panel')).toBe(
			'Портал отклонил вебхук. Проверьте, что он не удалён и не истёк.'
		);
		expect(translate('ru', 'bitrix.error.scope')).toBe(
			'У вебхука нет права «Задачи». Добавьте права Задачи, Диск и Рабочие группы соцсети и попробуйте снова.'
		);
		expect(translate('en', 'bitrix.error.rate_limited_panel')).toBe('Too many attempts. Try again in a minute.');
	});

	it('timeout в модалке — тот же текст, что network', () => {
		for (const locale of LOCALES) {
			expect(translate(locale, 'bitrix.error.timeout')).toBe(translate(locale, 'bitrix.error.network'));
		}
	});
});

describe('panelSuccessKey', () => {
	it('бейдж после успешного экшена по его виду', () => {
		expect(panelSuccessKey('connect')).toBe('bitrix.panel.connected');
		expect(panelSuccessKey('disconnect')).toBe('bitrix.panel.disconnected');
		expect(panelSuccessKey('setGroup')).toBe('bitrix.panel.saved');
	});

	it('чужой экшен бейджа не даёт', () => {
		expect(panelSuccessKey('enable')).toBeNull();
		expect(panelSuccessKey('toString')).toBeNull();
		expect(panelSuccessKey(undefined)).toBeNull();
		expect(panelSuccessKey(null)).toBeNull();
	});
});

describe('словари Битрикс24', () => {
	it('ключи панели, меню и ошибок есть и в ru, и в en', () => {
		const errorKeys = [
			...KINDS.map((kind) => `bitrix.error.${kind}`),
			'bitrix.error.invalid_webhook_panel',
			'bitrix.error.network_panel',
			'bitrix.error.rate_limited_panel'
		];
		const dicts: Record<string, Record<string, string>> = { ru, en };
		for (const [locale, dict] of Object.entries(dicts)) {
			for (const key of [...PANEL_KEYS, ...errorKeys]) {
				expect(dict[key], `${locale}: ${key}`).toBeTruthy();
			}
		}
	});
});
