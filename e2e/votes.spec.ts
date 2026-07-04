import { test, expect } from '@playwright/test';
import { createBoard, addCard } from './helpers';

test('like, then switch to dislike removes the like', async ({ page }) => {
	await createBoard(page, 'Votes board');
	await addCard(page, 'Went Well', 'vote on me');
	const card = page.locator('.card-board', { hasText: 'vote on me' });

	// Кнопки голосов — единственные кнопки карточки, чьё доступное имя = число
	const like = card.getByRole('button', { name: /^\d+$/ }).first();
	const dislike = card.getByRole('button', { name: /^\d+$/ }).nth(1);

	await like.click();
	await expect(like).toHaveText('1');
	await expect(dislike).toHaveText('0');

	// Переключение стороны: сервер снимает лайк сам (один emit с клиента)
	await dislike.click();
	await expect(dislike).toHaveText('1');
	await expect(like).toHaveText('0');
});
