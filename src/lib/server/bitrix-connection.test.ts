import { describe, it, expect } from 'vitest';
import { publicInfo, toConnection, type BitrixConnection } from './bitrix-connection.js';

type Row = Parameters<typeof toConnection>[0];

const WEBHOOK = 'https://bitrix24.team/rest/1/abc123secret/';

const row: Row = {
	spaceId: '5b0f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e',
	webhookEnc: 'iv.ciphertext',
	portal: 'bitrix24.team',
	userId: 1,
	userName: 'Никита Щербо',
	timeZone: 'Europe/Kaliningrad',
	portalOffset: '+03:00',
	groupId: 2014,
	groupName: 'Платформа',
	connectedAt: new Date('2026-09-17T10:00:00Z'),
	lastError: null
};

// Подмена decrypt: знает только свой шифротекст, остальное возвращает как есть —
// так ведёт себя crypto.decrypt при сменённом ключе
const decryptTo = (plain: string) => (data: string) => (data === 'iv.ciphertext' ? plain : data);

describe('toConnection', () => {
	it('расшифрованный адрес становится webhook, поля строки переносятся как есть', () => {
		expect(toConnection(row, decryptTo(WEBHOOK))).toEqual({
			spaceId: row.spaceId,
			portal: 'bitrix24.team',
			userId: 1,
			userName: 'Никита Щербо',
			timeZone: 'Europe/Kaliningrad',
			portalOffset: '+03:00',
			groupId: 2014,
			groupName: 'Платформа',
			lastError: null,
			webhook: { url: WEBHOOK, portal: 'bitrix24.team', userId: 1 }
		});
	});

	it('ключ сменили — decrypt вернул шифротекст, webhook: null', () => {
		expect(toConnection(row, (data) => data).webhook).toBeNull();
	});

	it('decrypt вернул null — webhook: null', () => {
		expect(toConnection(row, () => null).webhook).toBeNull();
	});

	it('http://localhost принимается только с allowHttpUrls (e2e)', () => {
		const local = decryptTo('http://localhost:4779/rest/1/testcode/');
		expect(toConnection(row, local).webhook).toBeNull();
		expect(toConnection(row, local, true).webhook?.url).toBe('http://localhost:4779/rest/1/testcode/');
	});
});

const connection = (over: Partial<BitrixConnection> = {}): BitrixConnection => ({
	...toConnection(row, decryptTo(WEBHOOK)),
	...over
});

describe('publicInfo', () => {
	it('наружу уходят портал, владелец, группа и last_error — без адреса, кода и userId', () => {
		const info = publicInfo(connection());
		expect(info).toEqual({
			portal: 'bitrix24.team',
			userName: 'Никита Щербо',
			groupId: 2014,
			groupName: 'Платформа',
			lastError: null
		});
		expect(JSON.stringify(info)).not.toContain('abc123secret');
	});

	it('сохранённый last_error отдаётся как есть', () => {
		expect(publicInfo(connection({ lastError: 'scope' })).lastError).toBe('scope');
	});

	it('вебхук не расшифровался — панель видит invalid_webhook, даже если last_error ещё пуст', () => {
		expect(publicInfo(connection({ webhook: null })).lastError).toBe('invalid_webhook');
	});
});
