import { describe, it, expect } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import { canViewSpace } from './space-access.js';

const jar = (entries: Record<string, string>) => ({ get: (name: string) => entries[name] } as unknown as Cookies);
const open = { slug: 'sp', passwordHash: null, creatorToken: 'tok', accessToken: 'acc-token' };
const locked = { slug: 'sp', passwordHash: 'hash', creatorToken: 'tok', accessToken: 'acc-token' };

describe('canViewSpace', () => {
	it('без пароля видят все', () => {
		expect(canViewSpace(open, jar({}))).toBe(true);
		expect(canViewSpace(open, jar({ retro_space_sp: 'x' }))).toBe(true);
	});
	it('с паролем — cookie доступа, равная access_token, или создатель', () => {
		expect(canViewSpace(locked, jar({}))).toBe(false);
		expect(canViewSpace(locked, jar({ retro_space_sp: 'acc-token' }))).toBe(true);
		expect(canViewSpace(locked, jar({ retro_space_creator_sp: 'tok' }))).toBe(true);
		expect(canViewSpace(locked, jar({ retro_space_creator_sp: 'wrong' }))).toBe(false);
	});
	it('подделанная cookie доступа не открывает пространство', () => {
		expect(canViewSpace(locked, jar({ retro_space_sp: 'x' }))).toBe(false);
		expect(canViewSpace(locked, jar({ retro_space_sp: 'authenticated' }))).toBe(false);
		expect(canViewSpace(locked, jar({ retro_space_sp: '' }))).toBe(false);
	});
	it('cookie, выданная до смены токена, больше не действует', () => {
		expect(canViewSpace({ ...locked, accessToken: 'new-token' }, jar({ retro_space_sp: 'acc-token' }))).toBe(false);
	});
	it('токен в cookie другого пространства не подходит', () => {
		expect(canViewSpace(locked, jar({ retro_space_other: 'acc-token' }))).toBe(false);
	});
	it('пустой creatorToken у старого пространства не открывает доступ', () => {
		expect(canViewSpace({ ...locked, creatorToken: '' }, jar({ retro_space_creator_sp: '' }))).toBe(false);
	});
	it('пустой accessToken не совпадает с пустой cookie', () => {
		expect(canViewSpace({ ...locked, accessToken: '' }, jar({ retro_space_sp: '' }))).toBe(false);
	});
});
