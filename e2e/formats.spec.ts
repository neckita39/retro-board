import { test, expect } from '@playwright/test';
import { addCard, column, dismissToast, initStorage } from './helpers';

test('classic is preselected and marked as recommended', async ({ page }) => {
	await initStorage(page);
	await page.goto('/new');
	await expect(page.getByRole('radio', { name: /Classic/ })).toBeChecked();
	await expect(page.getByText('Recommended', { exact: true })).toBeVisible();
});

test('a board created from a format link uses that format end to end', async ({ page }) => {
	await initStorage(page);
	await page.goto('/new?format=sailboat');
	await expect(page.getByRole('radio', { name: /Sailboat/ })).toBeChecked();
	await page.locator('form[action="?/createBoard"] button[type="submit"]').click();
	await page.waitForURL(/\/[A-Za-z0-9_-]{21}/);
	await dismissToast(page);

	for (const name of ['Wind', 'Anchors', 'Rocks', 'Island']) {
		await expect(page.getByRole('heading', { name })).toBeVisible();
	}
	await expect(page.getByRole('heading', { name: 'Went Well' })).toHaveCount(0);

	await addCard(page, 'Rocks', 'legacy auth expires in Q4');
	await page.dragAndDrop(
		'.card-board:has-text("legacy auth")',
		'[data-testid="column"]:has(h2:has-text("Island"))'
	);
	await expect(column(page, 'Island').locator('.card-board', { hasText: 'legacy auth' })).toBeVisible();

	// Итоги показывают карточку под колонкой формата
	await expect(page.getByTestId('summary-card').filter({ hasText: 'legacy auth' })).toBeVisible();

	// Экспорт знает формат и его колонки
	const slug = new URL(page.url()).pathname.slice(1);
	const data = await (await page.request.get(`/${slug}/export`)).json();
	expect(data.board.format).toBe('sailboat');
	expect(Object.keys(data.columns)).toEqual(['wind', 'anchors', 'rocks', 'island']);
	expect(data.columns.island[0].content).toBe('legacy auth expires in Q4');

	// Браузер запомнил выбор
	await page.goto('/new');
	await expect(page.getByRole('radio', { name: /Sailboat/ })).toBeChecked();
});
