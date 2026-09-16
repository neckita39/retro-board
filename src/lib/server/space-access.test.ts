import { describe, it, expect } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import { canViewSpace } from './space-access.js';

const jar = (entries: Record<string, string>) => ({ get: (name: string) => entries[name] } as unknown as Cookies);
const open = { slug: 'sp', passwordHash: null, creatorToken: 'tok' };
const locked = { slug: 'sp', passwordHash: 'hash', creatorToken: 'tok' };

describe('canViewSpace', () => {
	it('без пароля видят все', () => {
		expect(canViewSpace(open, jar({}))).toBe(true);
	});
	it('с паролем — только после ввода пароля (cookie доступа) или создатель', () => {
		expect(canViewSpace(locked, jar({}))).toBe(false);
		expect(canViewSpace(locked, jar({ retro_space_sp: 'authenticated' }))).toBe(true);
		expect(canViewSpace(locked, jar({ retro_space_creator_sp: 'tok' }))).toBe(true);
		expect(canViewSpace(locked, jar({ retro_space_creator_sp: 'wrong' }))).toBe(false);
	});
	it('пустой creatorToken у старого пространства не открывает доступ', () => {
		expect(canViewSpace({ ...locked, creatorToken: '' }, jar({ retro_space_creator_sp: '' }))).toBe(false);
	});
});
