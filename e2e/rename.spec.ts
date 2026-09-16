import { test, expect } from '@playwright/test';
import { createBoard, initStorage } from './helpers';

// Переименование — только для создателя. Пункт живёт в меню «⋯» в шапке,
// заголовок в крошках превращается в инпут; новое имя прилетает всем по сокету.

async function openMenu(page: import('@playwright/test').Page) {
	await page.getByRole('button', { name: 'Menu' }).click();
}

test('creator renames the board and everyone sees the new title live', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const ctxB = await browser.newContext();
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const slug = await createBoard(pageA, 'Sprint 41');
	await initStorage(pageB);
	await pageB.goto(`/${slug}`);
	await expect(pageB.getByText('Sprint 41').first()).toBeVisible();

	await openMenu(pageA);
	await pageA.getByRole('button', { name: 'Rename board' }).last().click();
	const input = pageA.getByRole('textbox', { name: 'Board title' });
	await expect(input).toBeFocused();
	await input.fill('  Sprint   42  ');
	await input.press('Enter');

	await expect(input).toBeHidden();
	await expect(pageA.getByText('Sprint 42').first()).toBeVisible();
	await expect(pageA).toHaveTitle(/^Sprint 42 — /);

	// Второй участник получает новое имя без перезагрузки
	await expect(pageB.getByText('Sprint 42').first()).toBeVisible({ timeout: 10_000 });
	await expect(pageB.getByText('Sprint 41')).toHaveCount(0);

	// Имя пережило перезагрузку — оно в базе, а не только в памяти комнаты
	await pageA.reload();
	await expect(pageA.getByText('Sprint 42').first()).toBeVisible();

	await ctxA.close();
	await ctxB.close();
});

test('Escape cancels the rename and an empty title is not saved', async ({ page }) => {
	await createBoard(page, 'Keep me');

	await openMenu(page);
	await page.getByRole('button', { name: 'Rename board' }).last().click();
	const input = page.getByRole('textbox', { name: 'Board title' });
	await input.fill('Nope');
	await input.press('Escape');
	await expect(input).toBeHidden();
	await expect(page.getByText('Keep me').first()).toBeVisible();

	await openMenu(page);
	await page.getByRole('button', { name: 'Rename board' }).last().click();
	await input.fill('   ');
	await input.press('Enter');
	// Пустое имя не принимается — инпут остаётся открытым, старое имя на месте
	await expect(input).toBeVisible();
	await input.press('Escape');
	await expect(page.getByText('Keep me').first()).toBeVisible();
});

test('a visitor has no rename option', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const ctxB = await browser.newContext();
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const slug = await createBoard(pageA, 'Private title');
	await initStorage(pageB);
	await pageB.goto(`/${slug}`);
	await expect(pageB.getByText('Private title').first()).toBeVisible();

	await openMenu(pageB);
	await expect(pageB.getByRole('button', { name: 'Rename board' })).toHaveCount(0);

	await ctxA.close();
	await ctxB.close();
});

test('the pencil next to the title renames without opening the menu', async ({ page }) => {
	await createBoard(page, 'Pencil me');
	// Карандаш в крошках — первый «Rename board», пункт меню — последний
	await page.getByRole('button', { name: 'Rename board' }).first().click();
	const input = page.getByRole('textbox', { name: 'Board title' });
	await expect(input).toBeFocused();
	await input.fill('Pencil done');
	await input.press('Enter');
	await expect(page.getByText('Pencil done').first()).toBeVisible();
	await page.reload();
	await expect(page.getByText('Pencil done').first()).toBeVisible();
});
