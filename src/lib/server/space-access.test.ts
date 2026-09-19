import { describe, it, expect } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import { canViewSpace, spacePasswordError, safeNextBoardSlug, SPACE_PASSWORD_MIN } from './space-access.js';

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

describe('spacePasswordError', () => {
	it('пустой пароль не годится', () => {
		expect(spacePasswordError('')).toBe('empty_password');
		expect(spacePasswordError('   ')).toBe('empty_password');
		expect(spacePasswordError(null)).toBe('empty_password');
		expect(spacePasswordError(undefined)).toBe('empty_password');
	});
	it('короткий пароль не годится: он же становится замком на все доски пространства', () => {
		expect(spacePasswordError('1')).toBe('short_password');
		expect(spacePasswordError('12345')).toBe('short_password');
	});
	it('пароль минимальной длины и длиннее годится', () => {
		expect(spacePasswordError('123456')).toBe(null);
		expect(spacePasswordError('достаточно длинный')).toBe(null);
	});
	it('длина считается после обрезки пробелов', () => {
		expect(spacePasswordError('  123  ')).toBe('short_password');
		expect(spacePasswordError('  123456  ')).toBe(null);
	});
	it('минимум объявлен и не меньше шести', () => {
		expect(SPACE_PASSWORD_MIN).toBeGreaterThanOrEqual(6);
	});
});

describe('safeNextBoardSlug', () => {
	it('принимает только слаг доски: 21 символ из алфавита nanoid', () => {
		expect(safeNextBoardSlug('V1StGXR8_Z5jdHi6B-myT')).toBe('V1StGXR8_Z5jdHi6B-myT');
	});
	it('отвергает пустое и отсутствующее', () => {
		expect(safeNextBoardSlug(null)).toBe(null);
		expect(safeNextBoardSlug(undefined)).toBe(null);
		expect(safeNextBoardSlug('')).toBe(null);
	});
	it('отвергает чужой абсолютный адрес — это был бы open redirect', () => {
		expect(safeNextBoardSlug('https://evil.example/pwn')).toBe(null);
		expect(safeNextBoardSlug('//evil.example')).toBe(null);
		expect(safeNextBoardSlug('http://evil.example')).toBe(null);
	});
	it('отвергает попытки выйти из корня и подмешать путь', () => {
		expect(safeNextBoardSlug('../../etc/passwd')).toBe(null);
		expect(safeNextBoardSlug('/spaces/other')).toBe(null);
		expect(safeNextBoardSlug('V1StGXR8_Z5jdHi6B-myT/extra')).toBe(null);
		expect(safeNextBoardSlug('V1StGXR8_Z5jdHi6B-myT?admin=1')).toBe(null);
	});
	it('отвергает неверную длину и посторонние символы', () => {
		expect(safeNextBoardSlug('short')).toBe(null);
		expect(safeNextBoardSlug('V1StGXR8_Z5jdHi6B-myTT')).toBe(null);
		expect(safeNextBoardSlug('V1StGXR8_Z5jdHi6B my')).toBe(null);
		expect(safeNextBoardSlug('V1StGXR8_Z5jdHi6B.myT')).toBe(null);
	});
	it('не ломается на переводах строки внутри значения', () => {
		expect(safeNextBoardSlug('V1StGXR8_Z5jdHi6B-myT\nx')).toBe(null);
	});
});
