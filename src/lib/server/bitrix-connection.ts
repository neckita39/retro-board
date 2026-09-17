// Подключение пространства к Битрикс24 — строка space_bitrix. Вебхук хранится
// только шифротекстом и расшифровывается на время одного запроса; в page data,
// логи и метрики уходит publicInfo — без адреса и кода.
import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { spaceBitrix } from './db/schema.js';
import { decrypt, encrypt, encryptionEnabled } from './crypto.js';
import { allowHttpEnabled, parseWebhookUrl, type Webhook } from './bitrix.js';

export interface BitrixConnection {
	spaceId: string;
	portal: string;
	userId: number;
	userName: string;
	timeZone: string | null;
	portalOffset: string | null;
	groupId: number | null;
	groupName: string | null;
	lastError: string | null;
	/** null — расшифровка или разбор адреса не прошли (ключ сменили) */
	webhook: Webhook | null;
}

/** Строка таблицы → подключение. Чистая: decrypt подменяется в тесте */
export function toConnection(
	row: typeof spaceBitrix.$inferSelect,
	decryptFn: (data: string) => string | null,
	allowHttpUrls = false
): BitrixConnection {
	// decrypt при чужом ключе возвращает вход как есть — шифротекст не пройдёт parseWebhookUrl
	const plain = decryptFn(row.webhookEnc);
	return {
		spaceId: row.spaceId,
		portal: row.portal,
		userId: row.userId,
		userName: row.userName,
		timeZone: row.timeZone,
		portalOffset: row.portalOffset,
		groupId: row.groupId,
		groupName: row.groupName,
		lastError: row.lastError,
		webhook: plain ? parseWebhookUrl(plain, { allowHttp: allowHttpUrls }) : null
	};
}

export async function loadConnection(spaceId: string): Promise<BitrixConnection | null> {
	// http://localhost разрешён только в e2e (BITRIX_ALLOW_HTTP=1 в playwright.config.ts)
	const [row] = await db.select().from(spaceBitrix).where(eq(spaceBitrix.spaceId, spaceId)).limit(1);
	return row ? toConnection(row, decrypt, allowHttpEnabled()) : null;
}

export interface BitrixPublicInfo {
	portal: string;
	userName: string;
	groupId: number | null;
	groupName: string | null;
	lastError: string | null;
}

/**
 * То же, что publicInfo(loadConnection(...)), но webhook_enc не выбирается и не расшифровывается:
 * секрет не материализуется в памяти ради чтения, которое им не пользуется (load доски).
 * Отличие от publicInfo: last_error здесь только из колонки — расшифровать нечего, значит
 * «ключ сменили» видно лишь после того, как экшен запишет invalid_webhook.
 */
export async function loadPublicInfo(spaceId: string): Promise<BitrixPublicInfo | null> {
	const [row] = await db
		.select({
			portal: spaceBitrix.portal,
			userName: spaceBitrix.userName,
			groupId: spaceBitrix.groupId,
			groupName: spaceBitrix.groupName,
			lastError: spaceBitrix.lastError
		})
		.from(spaceBitrix)
		.where(eq(spaceBitrix.spaceId, spaceId))
		.limit(1);
	return row ?? null;
}

/** Upsert строки пространства; last_error сбрасывается. Без ключа шифрования — отказ, открытым текстом не храним */
export async function saveConnection(input: {
	spaceId: string;
	webhookUrl: string;
	portal: string;
	userId: number;
	userName: string;
	timeZone: string | null;
	portalOffset: string | null;
	groupId: number | null;
	groupName: string | null;
}): Promise<void> {
	if (!encryptionEnabled) throw new Error('bitrix: encryption is not configured');
	const webhookEnc = encrypt(input.webhookUrl);
	if (!webhookEnc) throw new Error('bitrix: empty webhook');

	const values = {
		webhookEnc,
		portal: input.portal,
		userId: input.userId,
		userName: input.userName,
		timeZone: input.timeZone,
		portalOffset: input.portalOffset,
		groupId: input.groupId,
		groupName: input.groupName,
		connectedAt: new Date(),
		lastError: null
	};
	await db
		.insert(spaceBitrix)
		.values({ spaceId: input.spaceId, ...values })
		.onConflictDoUpdate({ target: spaceBitrix.spaceId, set: values });
}

export async function updateGroup(spaceId: string, groupId: number | null, groupName: string | null): Promise<void> {
	await db.update(spaceBitrix).set({ groupId, groupName }).where(eq(spaceBitrix.spaceId, spaceId));
}

export async function deleteConnection(spaceId: string): Promise<void> {
	await db.delete(spaceBitrix).where(eq(spaceBitrix.spaceId, spaceId));
}

/** UPDATE, не upsert: без строки ничего не создаётся */
export async function setLastError(spaceId: string, kind: 'invalid_webhook' | 'scope' | 'access' | null): Promise<void> {
	await db.update(spaceBitrix).set({ lastError: kind }).where(eq(spaceBitrix.spaceId, spaceId));
}

export function publicInfo(c: BitrixConnection): BitrixPublicInfo {
	return {
		portal: c.portal,
		userName: c.userName,
		groupId: c.groupId,
		groupName: c.groupName,
		// Вебхук не расшифровался — панель просит подключить заново, даже если экшены ещё не записали last_error
		lastError: c.lastError ?? (c.webhook ? null : 'invalid_webhook')
	};
}
