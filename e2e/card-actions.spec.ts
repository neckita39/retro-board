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

test('window losing focus mid-edit does not save the card', async ({ page }) => {
	await createBoard(page, 'Edit blur board');
	await addCard(page, 'Went Well', 'draft in progress');
	const col = column(page, 'Went Well');

	await col.locator('.card-board').getByRole('button', { name: 'Edit' }).click();
	// В режиме редактирования текст живёт в value textarea, а не в разметке —
	// фильтровать карточку по hasText больше нельзя
	const textarea = col.locator('.card-board textarea');
	await textarea.fill('draft in progress, unfinished thou');

	// Эмулируем переключение раскладки Win+Space/Cmd+Space: системный оверлей
	// забирает фокус у окна — textarea получает blur при document.hasFocus() === false
	await page.evaluate(() => {
		(document as { hasFocus: () => boolean }).hasFocus = () => false;
	});
	await textarea.evaluate((el) => (el as HTMLTextAreaElement).blur());

	// Редактирование не прервалось, черновик на месте
	await expect(textarea).toBeVisible();
	await expect(textarea).toHaveValue('draft in progress, unfinished thou');
	await page.evaluate(() => {
		delete (document as { hasFocus?: () => boolean }).hasFocus;
	});

	// Обычный blur — клик мимо карточки при живом окне — сохраняет как раньше
	await textarea.fill('draft in progress, unfinished thought');
	await page.getByRole('heading', { name: 'Went Well' }).click();
	await expect(textarea).toHaveCount(0);
	await expect(col.locator('.card-board', { hasText: 'draft in progress, unfinished thought' })).toBeVisible();
});
