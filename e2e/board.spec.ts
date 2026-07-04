import { test, expect } from '@playwright/test';
import { createBoard, addCard } from './helpers';

test('create a board and add a card', async ({ page }) => {
	const slug = await createBoard(page, 'My E2E Retro');
	expect(slug).toMatch(/^[A-Za-z0-9_-]{21}$/);

	// Название доски в хедере (десктопные крошки + мобильный заголовок)
	await expect(page.getByText('My E2E Retro').first()).toBeVisible();

	// Три колонки на месте
	await expect(page.getByRole('heading', { name: 'Went Well' })).toBeVisible();
	await expect(page.getByRole('heading', { name: "Didn't Go Well" })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'To Improve' })).toBeVisible();

	// Карточка добавляется и видна с автором из retro_name
	await addCard(page, 'Went Well', 'the pipeline is green');
	const card = page.locator('.card-board', { hasText: 'the pipeline is green' });
	await expect(card).toBeVisible();
	await expect(card.getByText('E2E', { exact: true })).toBeVisible();
});
