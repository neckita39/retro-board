import { test, expect, type Page } from '@playwright/test';
import { createBoard, addCard, initStorage } from './helpers';

const focused = '[data-testid="summary-card"][data-focused="true"]';
// Сфокусированная карточка тоже помечена как пройденная — здесь нас интересуют только те,
// которые уже отпустили
const discussed = '[data-testid="summary-card"][data-discussed="true"]:not([data-focused="true"])';

function startButton(page: Page) {
	return page.getByRole('button', { name: 'Discuss', exact: true });
}

test('discussion focus is shared with everyone on the board', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const ctxB = await browser.newContext();
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const slug = await createBoard(pageA, 'Focus board');
	await addCard(pageA, 'Went Well', 'ship it on friday');
	await addCard(pageA, 'Went Well', 'ci is finally fast');

	await initStorage(pageB);
	await pageB.goto(`/${slug}`);
	await expect(pageB.locator('[data-testid="summary-card"]')).toHaveCount(2, { timeout: 10_000 });

	// Пультом рулит только создатель
	await expect(startButton(pageA)).toBeVisible();
	await expect(startButton(pageB)).toHaveCount(0);

	// Старт: фокус на первой карточке повестки у обоих
	await startButton(pageA).click();
	await expect(pageA.locator(focused)).toContainText('ship it on friday');
	await expect(pageB.locator(focused)).toContainText('ship it on friday', { timeout: 10_000 });

	// «Далее» переводит фокус у всех, пройденная помечается
	await pageA.getByRole('button', { name: /Next/ }).click();
	await expect(pageA.locator(focused)).toContainText('ci is finally fast');
	await expect(pageB.locator(focused)).toContainText('ci is finally fast', { timeout: 10_000 });
	await expect(pageB.locator(discussed)).toContainText('ship it on friday');

	// Конец повестки — дальше идти некуда
	await expect(pageA.getByRole('button', { name: /Next/ })).toBeDisabled();

	// Завершение снимает фокус у всех
	await pageA.getByRole('button', { name: 'End discussion' }).click();
	await expect(pageA.locator(focused)).toHaveCount(0);
	await expect(pageB.locator(focused)).toHaveCount(0, { timeout: 10_000 });
	await expect(startButton(pageA)).toBeVisible();

	await ctxA.close();
	await ctxB.close();
});
