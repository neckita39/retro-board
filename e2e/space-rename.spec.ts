import { test, expect, type Page } from '@playwright/test';
import { initStorage } from './helpers';

// Создаёт пространство через UI, закрывает admin-баннер, возвращает slug
async function createSpace(page: Page, name: string): Promise<string> {
	await initStorage(page);
	await page.goto('/new');
	// Форма пространства скрыта за переключателем типа (вторая карточка — «Space»)
	await page.locator('button[aria-pressed]').nth(1).click();
	await page.getByPlaceholder('Space name').fill(name);
	await page.locator('form[action="?/createSpace"] button[type="submit"]').click();
	await page.waitForURL(/\/spaces\/[A-Za-z0-9_-]{21}/);
	const closeBanner = page.getByRole('button', { name: 'Close' });
	await closeBanner.click();
	await expect(closeBanner).toBeHidden();
	return new URL(page.url()).pathname.split('/')[2];
}

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

	const slug = await createSpace(pageA, 'Visitors');
	await initStorage(pageB);
	await pageB.goto(`/spaces/${slug}`);
	await expect(pageB.getByRole('heading', { level: 1, name: 'Visitors' })).toBeVisible();
	await expect(pageB.getByRole('button', { name: 'Rename space' })).toHaveCount(0);

	await ctxA.close();
	await ctxB.close();
});
