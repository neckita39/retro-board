import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password utils', () => {
	it('hashes and verifies a password', async () => {
		const hash = await hashPassword('secret123');
		expect(hash).toContain(':');
		expect(await verifyPassword('secret123', hash)).toBe(true);
	});

	it('rejects wrong password', async () => {
		const hash = await hashPassword('correct');
		expect(await verifyPassword('wrong', hash)).toBe(false);
	});

	it('produces different hashes for same password (random salt)', async () => {
		const h1 = await hashPassword('same');
		const h2 = await hashPassword('same');
		expect(h1).not.toBe(h2);
		expect(await verifyPassword('same', h1)).toBe(true);
		expect(await verifyPassword('same', h2)).toBe(true);
	});
});
