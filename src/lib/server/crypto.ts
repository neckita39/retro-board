import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || null;
let encKey: Buffer | null = null;

if (ENCRYPTION_KEY) {
	encKey = Buffer.from(ENCRYPTION_KEY, 'hex');
	if (encKey.length !== 32) {
		encKey = null;
	}
}

// Без ключа encrypt() возвращает открытый текст — для вебхука Битрикс24 это
// недопустимо, поэтому экшен подключения проверяет флаг до любого вызова портала
export const encryptionEnabled = !!encKey;

// Зеркало encrypt() из server.js: тот же формат, чтобы карточки, созданные
// сервером SvelteKit (доска-анализ), читались сокет-сервером без оговорок
export function encrypt(plaintext: string | null): string | null {
	if (!encKey || !plaintext) return plaintext;
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return iv.toString('base64url') + '.' + Buffer.concat([encrypted, tag]).toString('base64url');
}

export function decrypt(data: string | null): string | null {
	if (!encKey || !data) return data;
	if (!data.includes('.')) return data;
	try {
		const [ivStr, ctStr] = data.split('.');
		const iv = Buffer.from(ivStr, 'base64url');
		const buf = Buffer.from(ctStr, 'base64url');
		const tag = buf.subarray(buf.length - 16);
		const encrypted = buf.subarray(0, buf.length - 16);
		const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
		decipher.setAuthTag(tag);
		return decipher.update(encrypted as unknown as NodeJS.ArrayBufferView, undefined, 'utf8') + decipher.final('utf8');
	} catch {
		return data;
	}
}
