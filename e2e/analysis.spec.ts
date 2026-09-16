import { test, expect, type Page } from '@playwright/test';
import { addCard, createBoard, createBoardInSpace, createSpace, initStorage } from './helpers';

const MOCK = 'http://localhost:4778';

async function setMock(page: Page, mode: 'ok' | 'error', delayMs = 0) {
	await page.request.post(`${MOCK}/__mode`, { data: { mode, delayMs } });
}

test.afterEach(async ({ page }) => {
	await setMock(page, 'ok', 0);
});

const toasts = (page: Page, kind: 'info' | 'success' | 'error') =>
	page.locator(`[data-testid="toast"][data-kind="${kind}"]`);

// Закрывает все уведомления, чтобы старый «готов» не приняли за новый
async function clearToasts(page: Page) {
	const closes = page.getByRole('button', { name: 'Dismiss' });
	while ((await closes.count()) > 0) await closes.first().click();
}

// Жмёт кнопку, ждёт «готов», возвращает pathname доски из кнопки «Открыть»
async function runAnalysis(page: Page): Promise<string> {
	await clearToasts(page);
	await page.getByTestId('analyze-button').click();
	const ready = toasts(page, 'success');
	await expect(ready).toContainText('AI analysis is ready', { timeout: 20_000 });
	const href = await ready.getByRole('link', { name: /Open/ }).getAttribute('href');
	expect(href).toMatch(/^\/[A-Za-z0-9_-]{21}$/);
	return href!;
}

async function seedSpace(page: Page, name: string) {
	const space = await createSpace(page, name);
	const b1 = await createBoardInSpace(page, space.slug, 'Sprint 1');
	await addCard(page, "Didn't Go Well", 'flaky tests');
	await addCard(page, 'Went Well', 'deploys are smooth');
	const b2 = await createBoardInSpace(page, space.slug, 'Sprint 2');
	await addCard(page, "Didn't Go Well", 'flaky tests again');
	return { ...space, boards: [b1, b2] };
}

test('everyone in the space sees the loader tile, then the ready toast; nobody is redirected', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const ctxB = await browser.newContext();
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const space = await seedSpace(pageA, 'Live team');
	await initStorage(pageB);
	await pageB.goto(`/spaces/${space.slug}`);
	await pageA.goto(`/spaces/${space.slug}`);
	await setMock(pageA, 'ok', 2_500);

	await pageA.getByTestId('analyze-button').click();
	for (const p of [pageA, pageB]) {
		await expect(toasts(p, 'info')).toContainText('Space analysis started', { timeout: 10_000 });
		await expect(p.getByTestId('analysis-pending')).toBeVisible();
		await expect(p.getByTestId('analysis-pending')).toContainText(/^Space analysis for/);
	}

	for (const p of [pageA, pageB]) {
		await expect(toasts(p, 'success')).toContainText('AI analysis is ready', { timeout: 20_000 });
		await expect(p.getByTestId('analysis-pending')).toHaveCount(0);
		const tile = p.getByTestId('space-tile').filter({ has: p.getByText(/^Space analysis for/) });
		await expect(tile).toHaveAttribute('data-format', 'analysis');
		expect(new URL(p.url()).pathname).toBe(`/spaces/${space.slug}`);
	}

	// Переход только по кнопке «Открыть»
	await toasts(pageA, 'success').getByRole('link', { name: /Open/ }).click();
	await expect(pageA).toHaveTitle(/^Space analysis for/);
	for (const name of ['Still good', 'Still bad', 'Still to improve']) {
		await expect(pageA.getByRole('heading', { name })).toBeVisible();
	}
	await expect(pageA.locator('.card-board', { hasText: 'Flaky tests block merges again (in 3 boards)' })).toBeVisible();

	await ctxA.close();
	await ctxB.close();
});

test('the ready toast reaches a board page inside the space', async ({ page }) => {
	const space = await seedSpace(page, 'Roaming team');
	await page.goto(`/spaces/${space.slug}`);
	await setMock(page, 'ok', 2_500);
	await page.getByTestId('analyze-button').click();
	await expect(page.getByTestId('analysis-pending')).toBeVisible();

	await page.goto(`/${space.boards[1]}`);
	await expect(toasts(page, 'success')).toContainText('AI analysis is ready', { timeout: 20_000 });
	expect(new URL(page.url()).pathname).toBe(`/${space.boards[1]}`);
});

test('a reload during the analysis shows the loader again', async ({ page }) => {
	const space = await seedSpace(page, 'Reload team');
	await page.goto(`/spaces/${space.slug}`);
	await setMock(page, 'ok', 4_000);
	await page.getByTestId('analyze-button').click();
	await expect(page.getByTestId('analysis-pending')).toBeVisible();
	await page.reload();
	await expect(page.getByTestId('analysis-pending')).toBeVisible();
	await expect(toasts(page, 'success')).toContainText('AI analysis is ready', { timeout: 20_000 });
});

test('a failure shows the failed tile with retry for everyone, and retry works', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const ctxB = await browser.newContext();
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const space = await seedSpace(pageA, 'Unlucky team');
	await initStorage(pageB);
	await pageB.goto(`/spaces/${space.slug}`);
	await pageA.goto(`/spaces/${space.slug}`);
	await setMock(pageA, 'error');
	await pageA.getByTestId('analyze-button').click();
	for (const p of [pageA, pageB]) {
		await expect(toasts(p, 'error')).toContainText('The AI service returned an error', { timeout: 10_000 });
		await expect(p.getByTestId('analysis-failed')).toContainText('Analysis failed');
	}
	await expect(pageA.getByTestId('space-tile')).toHaveCount(2);

	await setMock(pageA, 'ok');
	await pageA.getByTestId('analyze-retry').click();
	for (const p of [pageA, pageB]) {
		await expect(toasts(p, 'success')).toContainText('AI analysis is ready', { timeout: 20_000 });
		await expect(p.getByTestId('analysis-failed')).toHaveCount(0);
	}

	await ctxA.close();
	await ctxB.close();
});

test('cache: without new boards the button reports the analysis is up to date', async ({ page }) => {
	const space = await seedSpace(page, 'Cached team');
	await page.goto(`/spaces/${space.slug}`);
	const first = await runAnalysis(page);

	await clearToasts(page);
	await page.getByTestId('analyze-button').click();
	const cached = toasts(page, 'info');
	await expect(cached).toContainText('up to date');
	expect(await cached.getByRole('link', { name: /Open/ }).getAttribute('href')).toBe(first);
	await expect(page.getByTestId('analysis-pending')).toHaveCount(0);

	await createBoardInSpace(page, space.slug, 'Sprint 3');
	await page.goto(`/spaces/${space.slug}`);
	expect(await runAnalysis(page)).not.toBe(first);
});

test('limit: the fourth analysis in a day is refused', async ({ page }) => {
	test.setTimeout(120_000);
	const space = await seedSpace(page, 'Busy team');
	for (let i = 0; i < 3; i++) {
		await createBoardInSpace(page, space.slug, `Sprint ${10 + i}`);
		await page.goto(`/spaces/${space.slug}`);
		await runAnalysis(page);
	}
	await createBoardInSpace(page, space.slug, 'Sprint 20');
	await page.goto(`/spaces/${space.slug}`);
	await page.getByTestId('analyze-button').click();
	await expect(toasts(page, 'error')).toContainText('Limit reached: 3 analyses a day');
	await expect(page.getByTestId('analysis-pending')).toHaveCount(0);
});

test('an empty space explains there is nothing to analyse', async ({ page }) => {
	const space = await createSpace(page, 'Empty team');
	await page.goto(`/spaces/${space.slug}`);
	await page.getByTestId('analyze-button').click();
	await expect(toasts(page, 'error')).toContainText('Nothing to analyse yet');
});

test('the space creator has creator rights on the analysis board', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const ctxB = await browser.newContext();
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const space = await seedSpace(pageA, 'Admin team');
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

test('on a phone the analysis board opens on its first column', async ({ page }) => {
	const space = await seedSpace(page, 'Mobile team');
	await page.goto(`/spaces/${space.slug}`);
	const path = await runAnalysis(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(path);
	await expect(page.getByRole('button', { name: /^Good · 1$/ })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.card-board', { hasText: 'Deploys keep going smoothly' })).toBeVisible();
});
