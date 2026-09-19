import { test, expect, type Browser } from '@playwright/test';
import { addCard, createBoard, initStorage } from './helpers';

async function newContext(browser: Browser) {
	return browser.newContext();
}

const card = (page: import('@playwright/test').Page, text: string) =>
	page.locator('.card-board', { hasText: text });

test('слепой ввод: автор видит свою карточку, остальные — рубашку', async ({ browser }) => {
	const ctxA = await newContext(browser);
	const ctxB = await newContext(browser);
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const slug = await createBoard(pageA, 'Blind board');
	await addCard(pageA, 'Went Well', 'открытая мысль');

	// Ведущий включает слепой ввод
	await pageA.getByRole('button', { name: 'Menu' }).click();
	await pageA.getByTestId('menu-blind').click();
	await expect(pageA.getByTestId('blind-notice')).toBeVisible();

	// Гость заходит: карточка ведущего для него — рубашка
	await initStorage(pageB);
	await pageB.goto(`/${slug}`);
	await expect(pageB.getByTestId('blind-notice')).toBeVisible();
	await expect(pageB.getByTestId('card-hidden')).toHaveCount(1);
	await expect(pageB.getByText('открытая мысль')).toHaveCount(0);

	// Своя карточка гостю видна сразу, а у ведущего она рубашкой
	await addCard(pageB, 'Went Well', 'мысль гостя');
	await expect(card(pageB, 'мысль гостя')).toBeVisible();
	await expect(pageA.getByTestId('card-hidden')).toHaveCount(1, { timeout: 10_000 });
	await expect(pageA.getByText('мысль гостя')).toHaveCount(0);
	// А своя у ведущего по-прежнему открыта
	await expect(card(pageA, 'открытая мысль')).toBeVisible();

	// Перезагрузка не раскрывает чужое
	await pageB.reload();
	await expect(pageB.getByTestId('card-hidden')).toHaveCount(1);
	await expect(card(pageB, 'мысль гостя')).toBeVisible();

	// Экспорт мимо интерфейса тоже не раскрывает
	const dump = await pageB.request.get(`/${slug}/export?format=json`);
	expect(await dump.text()).not.toContain('открытая мысль');

	// Ведущий открывает всё — карточки появляются у всех без перезагрузки
	await pageA.getByRole('button', { name: 'Menu' }).click();
	await pageA.getByTestId('menu-blind').click();
	await expect(pageA.getByTestId('blind-notice')).toHaveCount(0);
	await expect(card(pageA, 'мысль гостя')).toBeVisible({ timeout: 10_000 });
	await expect(card(pageB, 'открытая мысль')).toBeVisible({ timeout: 10_000 });
	await expect(pageB.getByTestId('card-hidden')).toHaveCount(0);

	await ctxA.close();
	await ctxB.close();
});

test('слепой ввод включает только ведущий', async ({ browser }) => {
	const ctxA = await newContext(browser);
	const ctxB = await newContext(browser);
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const slug = await createBoard(pageA, 'Blind rights');
	await addCard(pageA, 'Went Well', 'карточка ведущего');

	await initStorage(pageB);
	await pageB.goto(`/${slug}`);
	await expect(card(pageB, 'карточка ведущего')).toBeVisible();

	// У гостя пункта меню нет вовсе
	await pageB.getByRole('button', { name: 'Menu' }).click();
	await expect(pageB.getByTestId('menu-blind')).toHaveCount(0);

	// Серверная проверка токена — та же isRoomCreator, что у переименования и таймера
	// (её покрывает rename.spec.ts); здесь важно, что гостю нечего нажать
	await expect(pageB.getByTestId('blind-notice')).toHaveCount(0);
	await expect(card(pageB, 'карточка ведущего')).toBeVisible();

	await ctxA.close();
	await ctxB.close();
});
