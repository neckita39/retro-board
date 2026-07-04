import { test, expect } from '@playwright/test';
import { createBoard, addCard } from './helpers';

test('comment shows accent badge on card and is reachable from Summary', async ({ page }) => {
	await createBoard(page, 'Comments board');
	await addCard(page, 'Went Well', 'discuss this card');
	const card = page.locator('.card-board', { hasText: 'discuss this card' });

	// До комментариев — приглашение "Comment"
	await card.getByRole('button', { name: 'Comment', exact: true }).click();
	await card.getByPlaceholder('Add a comment...').fill('great point');
	await card.getByPlaceholder('Add a comment...').press('Enter');

	// Бейдж с количеством + сам комментарий в развёрнутом списке
	await expect(card.getByRole('button', { name: '1 comment' })).toBeVisible();
	await expect(card.getByText('great point')).toBeVisible();

	// Тот же комментарий доступен из итогового списка (Summary)
	const summaryRow = page.getByTestId('summary-card').filter({ hasText: 'discuss this card' });
	await summaryRow.scrollIntoViewIfNeeded();
	await summaryRow.getByRole('button', { name: '1 comment' }).click();
	await expect(summaryRow.getByText('great point')).toBeVisible();
});
