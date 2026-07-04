import { test, expect } from '@playwright/test';
import { createBoard, addCard, initStorage } from './helpers';

test('two browsers on one board sync cards and votes live', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const ctxB = await browser.newContext();
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const slug = await createBoard(pageA, 'Realtime board');
	await initStorage(pageB);
	await pageB.goto(`/${slug}`);
	await expect(pageB.getByRole('heading', { name: 'Went Well' })).toBeVisible();

	// Карточка из A появляется в B без перезагрузки
	await addCard(pageA, 'Went Well', 'realtime sync works');
	const cardB = pageB.locator('.card-board', { hasText: 'realtime sync works' });
	await expect(cardB).toBeVisible({ timeout: 10_000 });

	// Голос из B виден в A
	await cardB.getByRole('button', { name: /^\d+$/ }).first().click();
	const cardA = pageA.locator('.card-board', { hasText: 'realtime sync works' });
	await expect(cardA.getByRole('button', { name: /^\d+$/ }).first()).toHaveText('1', { timeout: 10_000 });

	await ctxA.close();
	await ctxB.close();
});
