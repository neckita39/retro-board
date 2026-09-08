import { test, expect } from '@playwright/test';
import { createBoard, initStorage } from './helpers';

test('the home page shows how many boards and spaces exist', async ({ page }) => {
	// Хотя бы одна доска точно есть — мы её только что создали
	await createBoard(page, 'Counted board');

	await initStorage(page);
	await page.goto('/');
	const stats = page.getByTestId('public-stats');
	await expect(stats).toBeVisible();
	await expect(stats).toContainText(/[1-9]\d* boards?/);
	await expect(stats).toContainText(/\d+ spaces?/);
});
