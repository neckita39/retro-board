import { test, expect } from '@playwright/test';
import { addCard, column, createBoard } from './helpers';

const PLACEHOLDER = "What's on your mind?";

test('черновик карточки переживает перезагрузку, а отправка его стирает', async ({ page }) => {
	await createBoard(page, 'Drafts');

	const col = column(page, 'Went Well');
	await col.getByRole('button', { name: /Add a card/ }).click();
	await col.getByPlaceholder(PLACEHOLDER).fill('недописанная мысль');

	// Вкладку обновили — форма открывается сама и текст на месте
	await page.reload();
	const restored = column(page, 'Went Well').getByPlaceholder(PLACEHOLDER);
	await expect(restored).toBeVisible();
	await expect(restored).toHaveValue('недописанная мысль');

	// Соседняя колонка чужой черновик не подхватывает
	await expect(column(page, "Didn't Go Well").getByPlaceholder(PLACEHOLDER)).toHaveCount(0);

	await restored.press('Enter');
	await expect(page.locator('.card-board', { hasText: 'недописанная мысль' })).toBeVisible();

	// Карточка создана — черновика больше нет, форма свёрнута
	await page.reload();
	await expect(column(page, 'Went Well').getByPlaceholder(PLACEHOLDER)).toHaveCount(0);
});

test('Escape откладывает черновик, «Отмена» стирает', async ({ page }) => {
	await createBoard(page, 'Drafts escape');

	const col = column(page, 'Went Well');
	await col.getByRole('button', { name: /Add a card/ }).click();
	await col.getByPlaceholder(PLACEHOLDER).fill('отложенная мысль');
	await col.getByPlaceholder(PLACEHOLDER).press('Escape');
	await expect(col.getByPlaceholder(PLACEHOLDER)).toHaveCount(0);

	// Escape — «убрать с глаз», а не «стереть»
	await page.reload();
	const back = column(page, 'Went Well').getByPlaceholder(PLACEHOLDER);
	await expect(back).toHaveValue('отложенная мысль');

	// А явная «Отмена» стирает насовсем
	await column(page, 'Went Well').getByRole('button', { name: 'Cancel' }).click();
	await page.reload();
	await expect(column(page, 'Went Well').getByPlaceholder(PLACEHOLDER)).toHaveCount(0);
});

test('«Скопировать итоги» кладёт Markdown доски в буфер', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await createBoard(page, 'Copy me');
	await addCard(page, 'Went Well', 'CI is green');
	await addCard(page, "Didn't Go Well", 'flaky tests');

	await page.getByRole('button', { name: 'Menu' }).click();
	await page.getByTestId('menu-copy-summary').click();

	await expect(page.getByTestId('toast').filter({ hasText: 'Summary copied' })).toBeVisible();

	const copied = await page.evaluate(() => navigator.clipboard.readText());
	expect(copied).toContain('# Copy me');
	expect(copied).toContain('CI is green');
	expect(copied).toContain('flaky tests');
});
