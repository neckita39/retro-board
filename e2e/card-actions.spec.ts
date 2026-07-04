import { test, expect } from '@playwright/test';
import { createBoard, addCard, column } from './helpers';

test('move card to another column, then delete with confirmation', async ({ page }) => {
	await createBoard(page, 'Actions board');
	await addCard(page, 'Went Well', 'move me around');
	const card = page.locator('.card-board', { hasText: 'move me around' });

	// Кнопки действий скрыты до hover (десктоп) — наводим
	await card.hover();
	await card.getByRole('button', { name: 'Move to' }).click();
	await card.getByRole('button', { name: 'To Improve' }).click();

	const moved = column(page, 'To Improve').locator('.card-board', { hasText: 'move me around' });
	await expect(moved).toBeVisible();
	await expect(column(page, 'Went Well').locator('.card-board', { hasText: 'move me around' })).toHaveCount(0);

	// Удаление — двухтаповое: первый клик переводит кнопку в confirm-состояние
	await moved.hover();
	await moved.getByRole('button', { name: 'Delete', exact: true }).click();
	await moved.getByRole('button', { name: 'Tap again to delete' }).click();
	await expect(page.locator('.card-board', { hasText: 'move me around' })).toHaveCount(0);
});
