import { test, expect } from '@playwright/test';
import { addCard, createBoard, initStorage } from './helpers';

const card = (page: import('@playwright/test').Page, text: string) =>
	page.locator('.card-board', { hasText: text });

test('поиск по доске подсвечивает совпавшие карточки и гасит остальные', async ({ page }) => {
	await createBoard(page, 'Search me');
	await addCard(page, 'Went Well', 'CI is finally green');
	await addCard(page, 'Went Well', 'release went smoothly');
	await addCard(page, "Didn't Go Well", 'flaky tests keep blocking merges');

	// «/» открывает поиск, как в трекерах
	await page.keyboard.press('/');
	const bar = page.getByTestId('board-search');
	await expect(bar).toBeVisible();

	await bar.getByRole('textbox').fill('flaky');
	await expect(page.getByTestId('search-count')).toHaveText('1 found');

	// Совпавшая обведена, остальные погашены, но остались на своих местах
	await expect(card(page, 'flaky tests keep blocking merges')).toHaveAttribute('data-search-hit', 'true');
	await expect(card(page, 'CI is finally green')).not.toHaveAttribute('data-search-hit', 'true');
	await expect(card(page, 'CI is finally green')).toBeVisible();

	// Находится по части слова и в любом регистре
	await bar.getByRole('textbox').fill('GREEN');
	await expect(page.getByTestId('search-count')).toHaveText('1 found');
	await expect(card(page, 'CI is finally green')).toHaveAttribute('data-search-hit', 'true');

	// Ничего не нашлось — честно говорим об этом
    await bar.getByRole('textbox').fill('kubernetes');
	await expect(page.getByTestId('search-count')).toHaveText('nothing found');

	// Escape закрывает поиск и снимает подсветку
	await bar.getByRole('textbox').press('Escape');
	await expect(bar).toHaveCount(0);
	await expect(card(page, 'CI is finally green')).not.toHaveAttribute('data-search-hit', 'true');
});

test('поиск по доске находит по тексту комментария', async ({ page }) => {
	await createBoard(page, 'Search comments');
	await addCard(page, 'Went Well', 'CI is finally green');
	await addCard(page, 'Went Well', 'docs updated');

	const target = card(page, 'CI is finally green');
	await target.getByRole('button', { name: 'Comment', exact: true }).click();
	await target.getByPlaceholder('Add a comment...').fill('huge relief for the whole team');
	await target.getByPlaceholder('Add a comment...').press('Enter');
	await expect(target.getByText('huge relief for the whole team')).toBeVisible();

	await page.getByTestId('board-search-toggle').click();
	await page.getByTestId('board-search').getByRole('textbox').fill('relief');
	await expect(page.getByTestId('search-count')).toHaveText('1 found');
	await expect(target).toHaveAttribute('data-search-hit', 'true');
	await expect(card(page, 'docs updated')).not.toHaveAttribute('data-search-hit', 'true');
});

test('поиск по разделу API фильтрует список запросов', async ({ page }) => {
	await initStorage(page);
	await page.goto('/api');

	const list = page.getByRole('button', { name: /Get a/ });
	await expect(list).toHaveCount(6);

	await page.getByTestId('api-search').fill('markdown');
	await expect(list).toHaveCount(3);

	// Ищем и по описанию, поэтому «analyses» ловит ещё и «список досок — AI analyses included»
	await page.getByTestId('api-search').fill('analyses');
	await expect(list).toHaveCount(3);

	// Несколько слов сужают: оба должны найтись
	await page.getByTestId('api-search').fill('analyses json');
	await expect(list).toHaveCount(1);

	await page.getByTestId('api-search').fill('grafana');
	await expect(list).toHaveCount(0);
	await expect(page.getByTestId('api-search-none')).toBeVisible();

	await page.getByTestId('api-search').fill('');
	await expect(list).toHaveCount(6);
});
