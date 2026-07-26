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

test('commenting on another card mid-discussion does not steal the focus', async ({ page }) => {
	await createBoard(page, 'Focus comments board');
	await addCard(page, 'Went Well', 'the focused one');
	await addCard(page, 'Went Well', 'the one we comment on');

	await startButton(page).click();
	await expect(page.locator(focused)).toContainText('the focused one');

	// Ведущий дописывает мысль в карточку, которую сейчас НЕ обсуждают
	const other = page
		.getByTestId('summary-card')
		.filter({ hasText: 'the one we comment on' });
	await other.getByRole('button', { name: 'Comment', exact: true }).click();
	// Клик обязателен: fill() ставит фокус через DOM и не заметил бы,
	// что поле перекрыто слоем прыжка фокуса
	await other.getByPlaceholder('Add a comment...').click();
	await other.getByPlaceholder('Add a comment...').fill('worth revisiting');
	await other.getByPlaceholder('Add a comment...').press('Enter');

	await expect(other.getByText('worth revisiting')).toBeVisible();
	// Фокус не уехал на прокомментированную карточку
	await expect(page.locator(focused)).toContainText('the focused one');
});

test('deleting the discussed card does not grey out the whole agenda', async ({ page }) => {
	await createBoard(page, 'Focus delete board');
	await addCard(page, 'Went Well', 'about to vanish');
	await addCard(page, 'Went Well', 'still here');

	await startButton(page).click();
	await expect(page.locator(focused)).toContainText('about to vanish');

	// Удаляем обсуждаемую карточку с доски (двойной тап — подтверждение)
	const boardCard = page.locator('.card-board', { hasText: 'about to vanish' });
	await boardCard.getByRole('button', { name: 'Delete' }).click();
	await boardCard.getByRole('button', { name: /Tap again/ }).click();
	await expect(page.getByTestId('summary-card')).toHaveCount(1);

	// Подсвечивать нечего — значит и гасить остальное нельзя
	await expect(page.locator(focused)).toHaveCount(0);
	await expect(page.locator('[data-testid="summary-card"][data-dimmed="true"]')).toHaveCount(0);
	// Обсуждение при этом не считается завершённым
	await expect(page.getByRole('button', { name: 'End discussion' })).toBeVisible();
});
