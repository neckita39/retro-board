import { test, expect } from '@playwright/test';
import { createBoard, addCard, column } from './helpers';

test('card moves to another column via drag and drop', async ({ page }) => {
	await createBoard(page, 'DnD board');
	await addCard(page, 'Went Well', 'drag me over');

	await page.dragAndDrop(
		'.card-board:has-text("drag me over")',
		'[data-testid="column"]:has(h2:has-text("To Improve"))'
	);

	await expect(
		column(page, 'To Improve').locator('.card-board', { hasText: 'drag me over' })
	).toBeVisible();
	await expect(
		column(page, 'Went Well').locator('.card-board', { hasText: 'drag me over' })
	).toHaveCount(0);
});

test('drop on the source column is a no-op', async ({ page }) => {
	await createBoard(page, 'DnD noop board');
	await addCard(page, 'Went Well', 'stay put');

	await page.dragAndDrop(
		'.card-board:has-text("stay put")',
		'[data-testid="column"]:has(h2:has-text("Went Well"))'
	);

	await expect(
		column(page, 'Went Well').locator('.card-board', { hasText: 'stay put' })
	).toBeVisible();
});
