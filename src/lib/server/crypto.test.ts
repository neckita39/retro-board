import { describe, it, expect, vi, afterEach } from 'vitest';

// Модуль читает ENCRYPTION_KEY при импорте — грузим его заново под каждым окружением
async function load(key: string | undefined) {
	vi.resetModules();
	if (key === undefined) vi.stubEnv('ENCRYPTION_KEY', '');
	else vi.stubEnv('ENCRYPTION_KEY', key);
	return await import('./crypto.js');
}

const KEY = '0'.repeat(64);

describe('encrypt/decrypt на стороне SvelteKit', () => {
	afterEach(() => vi.unstubAllEnvs());

	it('шифрует и расшифровывает обратно, шифртекст не содержит исходника', async () => {
		const { encrypt, decrypt } = await load(KEY);
		const enc = encrypt('снова падают тесты');
		expect(enc).not.toBe('снова падают тесты');
		expect(enc).toContain('.');
		expect(decrypt(enc)).toBe('снова падают тесты');
	});

	it('без ключа возвращает текст как есть', async () => {
		const { encrypt } = await load(undefined);
		expect(encrypt('plain')).toBe('plain');
	});

	it('null и пустая строка проходят насквозь', async () => {
		const { encrypt } = await load(KEY);
		expect(encrypt(null)).toBeNull();
		expect(encrypt('')).toBe('');
	});
});
