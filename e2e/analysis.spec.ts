import { test, expect, type Page } from '@playwright/test';
import { addCard, createBoard, createBoardInSpace, createSpace, initStorage } from './helpers';

const MOCK = 'http://localhost:4778';

async function setMock(page: Page, mode: 'ok' | 'error') {
	await page.request.post(`${MOCK}/__mode`, { data: { mode } });
}

test.afterEach(async ({ page }) => {
	await setMock(page, 'ok');
});

// Жмёт кнопку и ждёт доску-анализ по заголовку; возвращает её pathname
async function runAnalysis(page: Page): Promise<string> {
	await page.getByTestId('analyze-button').click();
	await expect(page).toHaveTitle(/^Space analysis for/, { timeout: 15_000 });
	return new URL(page.url()).pathname;
}

// Пространство с двумя досками и карточками — типичный вход для анализа
async function seedSpace(page: Page, name: string) {
	const space = await createSpace(page, name);
	await createBoardInSpace(page, space.slug, 'Sprint 1');
	await addCard(page, "Didn't Go Well", 'flaky tests');
	await addCard(page, 'Went Well', 'deploys are smooth');
	await createBoardInSpace(page, space.slug, 'Sprint 2');
	await addCard(page, "Didn't Go Well", 'flaky tests again');
	return space;
}

test('analysis creates a purple board with three columns and AI cards', async ({ page }) => {
	const space = await seedSpace(page, 'Analysed team');
	await page.goto(`/spaces/${space.slug}`);
	await page.getByTestId('analyze-button').click();

	// Ждём по заголовку: URL пространства сам похож на URL доски
	await expect(page).toHaveTitle(/^Space analysis for \d{2}\.\d{2}\.\d{4} — /, { timeout: 15_000 });
	for (const name of ['Still good', 'Still bad', 'Still to improve']) {
		await expect(page.getByRole('heading', { name })).toBeVisible();
	}
	const bad = page.locator('.card-board', { hasText: 'Flaky tests block merges again (in 3 boards)' });
	await expect(bad).toBeVisible();
	await expect(bad.getByText('AI analysis', { exact: true })).toBeVisible();
	await expect(page.getByTestId('board-columns')).toHaveClass(/ai-frame/);
	await expect(page.locator('header').getByText('AI analysis', { exact: true }).first()).toBeVisible();

	// В списке пространства — плитка с рамкой и бейджем
	await page.goto(`/spaces/${space.slug}`);
	const tile = page.getByTestId('space-tile').filter({ has: page.getByText(/^Space analysis for/) });
	await expect(tile).toHaveAttribute('data-format', 'analysis');
	await expect(tile).toHaveClass(/ai-frame/);
});

test('cache: no new boards → same analysis board; a new board → a new analysis', async ({ page }) => {
	const space = await seedSpace(page, 'Cached team');
	await page.goto(`/spaces/${space.slug}`);
	const first = await runAnalysis(page);

	await page.goto(`/spaces/${space.slug}`);
	expect(await runAnalysis(page)).toBe(first);

	await createBoardInSpace(page, space.slug, 'Sprint 3');
	// Кнопка есть и на доске внутри пространства
	expect(await runAnalysis(page)).not.toBe(first);
});

test('limit: the fourth analysis in a day is refused with a message', async ({ page }) => {
	test.setTimeout(90_000);
	const space = await seedSpace(page, 'Busy team');
	for (let i = 0; i < 3; i++) {
		await createBoardInSpace(page, space.slug, `Sprint ${10 + i}`);
		await runAnalysis(page);
	}
	await createBoardInSpace(page, space.slug, 'Sprint 20');
	await page.getByTestId('analyze-button').click();
	await expect(page.getByTestId('analyze-status')).toContainText('Limit reached: 3 analyses a day');
	await expect(page).not.toHaveTitle(/^Space analysis for/);
});

test('AI failure shows an error and creates no board', async ({ page }) => {
	const space = await seedSpace(page, 'Unlucky team');
	await setMock(page, 'error');
	await page.goto(`/spaces/${space.slug}`);
	await page.getByTestId('analyze-button').click();
	await expect(page.getByTestId('analyze-status')).toContainText('The AI service returned an error');
	await expect(page.getByTestId('space-tile')).toHaveCount(2);
});

test('an empty space explains there is nothing to analyse', async ({ page }) => {
	const space = await createSpace(page, 'Empty team');
	await page.goto(`/spaces/${space.slug}`);
	await page.getByTestId('analyze-button').click();
	await expect(page.getByTestId('analyze-status')).toContainText('Nothing to analyse yet');
});

test('the space creator has creator rights on the analysis board', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const ctxB = await browser.newContext();
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const space = await seedSpace(pageA, 'Admin team');
	// B становится создателем пространства по admin-ссылке, а анализ запускает A
	await initStorage(pageB);
	await pageB.goto(space.adminUrl);
	await pageB.getByRole('button', { name: 'Close' }).click();

	await pageA.goto(`/spaces/${space.slug}`);
	const analysisPath = await runAnalysis(pageA);

	await pageB.goto(analysisPath);
	await expect(pageB).toHaveTitle(/^Space analysis for/);
	await pageB.getByRole('button', { name: 'Menu' }).click();
	await expect(pageB.getByRole('button', { name: 'Rename board' })).toBeVisible();

	await ctxA.close();
	await ctxB.close();
});

test('a standalone board has no analysis button', async ({ page }) => {
	await createBoard(page, 'Lonely board');
	await expect(page.getByTestId('analyze-button')).toHaveCount(0);
});
