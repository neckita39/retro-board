import { test, expect } from '@playwright/test';
import { initStorage, createSpace } from './helpers';

test('creator renames the space and the name survives a reload', async ({ page }) => {
	await createSpace(page, 'Team Alpha');
	await expect(page.getByRole('heading', { level: 1, name: 'Team Alpha' })).toBeVisible();

	await page.getByRole('button', { name: 'Rename space' }).click();
	const input = page.getByRole('textbox', { name: 'Space name' });
	await expect(input).toBeFocused();
	await input.fill('  Team   Beta  ');
	await input.press('Enter');

	await expect(page.getByRole('heading', { level: 1, name: 'Team Beta' })).toBeVisible();
	await expect(page).toHaveTitle(/^Team Beta — /);

	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Team Beta' })).toBeVisible();
	await expect(page.getByText('Team Alpha')).toHaveCount(0);
});

test('Escape cancels the space rename', async ({ page }) => {
	await createSpace(page, 'Stay Alpha');
	await page.getByRole('button', { name: 'Rename space' }).click();
	const input = page.getByRole('textbox', { name: 'Space name' });
	await input.fill('Nope');
	await input.press('Escape');
	await expect(input).toBeHidden();
	await expect(page.getByRole('heading', { level: 1, name: 'Stay Alpha' })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Stay Alpha' })).toBeVisible();
});

test('a visitor has no rename button in the space', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const ctxB = await browser.newContext();
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const { slug } = await createSpace(pageA, 'Visitors');
	await initStorage(pageB);
	await pageB.goto(`/spaces/${slug}`);
	await expect(pageB.getByRole('heading', { level: 1, name: 'Visitors' })).toBeVisible();
	await expect(pageB.getByRole('button', { name: 'Rename space' })).toHaveCount(0);

	await ctxA.close();
	await ctxB.close();
});

test('board tiles animate only on the first visit of the session', async ({ page }) => {
	const { slug } = await createSpace(page, 'Calm team');
	// createSpace уже открыл страницу пространства один раз — это и был первый показ
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Calm team' })).toBeVisible();
	await expect(page.locator('.tile-enter')).toHaveCount(0);

	const fresh = await page.context().browser()!.newContext();
	const first = await fresh.newPage();
	await first.goto(`/spaces/${slug}`);
	await expect(first.getByRole('heading', { level: 1, name: 'Calm team' })).toBeVisible();
	await expect(first.locator('.tile-enter').first()).toBeAttached();
	await fresh.close();
});
