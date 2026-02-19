import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || null;
let encKey: Buffer | null = null;

if (ENCRYPTION_KEY) {
	encKey = Buffer.from(ENCRYPTION_KEY, 'hex');
	if (encKey.length !== 32) {
		encKey = null;
	}
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
