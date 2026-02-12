// E2E encryption utilities — PrivateBin-style
// Key lives in URL fragment (#key), never sent to server

let currentKey: CryptoKey | null = null;
let currentKeyRaw: string | null = null;

function toBase64Url(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
	const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

export function generateKey(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return toBase64Url(bytes.buffer);
}

async function importKey(raw: string): Promise<CryptoKey> {
	const keyBytes = fromBase64Url(raw);
	return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
		'encrypt',
		'decrypt'
	]);
}

export async function setKey(raw: string): Promise<void> {
	currentKeyRaw = raw;
	currentKey = await importKey(raw);
}

export function getKeyRaw(): string | null {
	return currentKeyRaw;
}

export function hasKey(): boolean {
	return currentKey !== null;
}

export async function encrypt(plaintext: string): Promise<string> {
	if (!currentKey) throw new Error('No encryption key set');
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, currentKey, encoded);
	return toBase64Url(iv.buffer) + '.' + toBase64Url(ciphertext);
}

export async function decrypt(data: string): Promise<string> {
	if (!currentKey) throw new Error('No encryption key set');
	const [ivStr, ctStr] = data.split('.');
	if (!ivStr || !ctStr) throw new Error('Invalid encrypted data format');
	const iv = fromBase64Url(ivStr);
	const ciphertext = fromBase64Url(ctStr);
	const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, currentKey, ciphertext);
	return new TextDecoder().decode(plaintext);
}

export async function encryptIfKeyed(text: string): Promise<string> {
	if (!currentKey) return text;
	return encrypt(text);
}

export async function decryptIfKeyed(text: string): Promise<string> {
	if (!currentKey) return text;
	// If it doesn't look like encrypted data (no dot separator), pass through
	if (!text.includes('.')) return text;
	try {
		return await decrypt(text);
	} catch {
		// Likely unencrypted legacy data — pass through
		return text;
	}
}
