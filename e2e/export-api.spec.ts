import { test, expect } from '@playwright/test';
import { createBoard, addCard, createSpace, createBoardInSpace, createLockedSpace } from './helpers';

test('board is fetchable as markdown and json; unknown slug is 404', async ({ page }) => {
	const slug = await createBoard(page, 'Export board');
	await addCard(page, 'Went Well', 'export me please');

	const md = await page.request.get(`/api/v1/boards/${slug}/export.md`);
	expect(md.status()).toBe(200);
	expect(md.headers()['content-type']).toContain('text/markdown');
	expect(md.headers()['content-disposition']).toBeUndefined(); // inline, не attachment
	const mdText = await md.text();
	expect(mdText).toContain('# Export board');
	expect(mdText).toContain('export me please');

	const json = await page.request.get(`/api/v1/boards/${slug}/export.json`);
	expect(json.status()).toBe(200);
	const data = await json.json();
	expect(data.board.slug).toBe(slug);
	expect(data.columns.went_well[0].content).toBe('export me please');
	expect(data.columns.went_well[0].authorName).toBe('E2E');

	const missing = await page.request.get('/api/v1/boards/does-not-exist/export.md');
	expect(missing.status()).toBe(404);
});

test('space boards and AI analyses are fetchable as json and markdown', async ({ page }) => {
	const space = await createSpace(page, 'API space');
	const b1 = await createBoardInSpace(page, space.slug, 'Sprint 1');
	await addCard(page, "Didn't Go Well", 'flaky tests');
	await createBoardInSpace(page, space.slug, 'Sprint 2');
	await addCard(page, "Didn't Go Well", 'flaky again');
	await page.goto(`/spaces/${space.slug}`);
	await page.getByTestId('analyze-button').click();
	await expect(page.locator('[data-testid="toast"][data-kind="success"]')).toContainText('AI analysis is ready', { timeout: 20_000 });

	const json = await page.request.get(`/api/v1/spaces/${space.slug}/boards.json`);
	expect(json.status()).toBe(200);
	const data = await json.json();
	expect(data.space.slug).toBe(space.slug);
	expect(data.boards.map((b: { title: string }) => b.title)).toEqual([expect.stringMatching(/^Space analysis for/), 'Sprint 2', 'Sprint 1']);
	expect(data.boards[2]).toMatchObject({ slug: b1, format: 'classic', url: `http://localhost:4777/${b1}` });

	const md = await page.request.get(`/api/v1/spaces/${space.slug}/boards.md`);
	expect(md.headers()['content-type']).toContain('text/markdown');
	expect(await md.text()).toContain(`- [Sprint 1](http://localhost:4777/${b1}) — `);

	const analyses = await (await page.request.get(`/api/v1/spaces/${space.slug}/analyses.json`)).json();
	expect(analyses.analyses).toHaveLength(1);
	expect(analyses.analyses[0].board.format).toBe('analysis');
	expect(analyses.analyses[0].columns.again_bad[0].content).toBe('Flaky tests block merges again (in 3 boards)');
	expect(analyses.analyses[0].columns.again_bad[0].authorName).toBe('AI analysis');

	const analysesMd = await (await page.request.get(`/api/v1/spaces/${space.slug}/analyses.md?lang=ru`)).text();
	expect(analysesMd).toContain('# API space — AI-анализы');
	expect(analysesMd).toContain('### Снова плохо');
	expect(analysesMd).toContain('- Flaky tests block merges again (in 3 boards) — *AI analysis*');

	expect((await page.request.get('/api/v1/spaces/does-not-exist/boards.json')).status()).toBe(404);
});

test('a password-protected space needs the password in the API', async ({ page }) => {
	const { slug } = await createLockedSpace(page, 'Locked space', 's3cret');

	// Cookie создателя API не читает — только заголовок; query string не принимается
	expect((await page.request.get(`/api/v1/spaces/${slug}/boards.json`)).status()).toBe(401);
	expect((await page.request.get(`/api/v1/spaces/${slug}/boards.json?password=s3cret`)).status()).toBe(401);
	expect((await page.request.get(`/api/v1/spaces/${slug}/boards.json`, { headers: { 'X-Space-Password': 'wrong' } })).status()).toBe(403);
	const ok = await page.request.get(`/api/v1/spaces/${slug}/analyses.md`, { headers: { 'X-Space-Password': 's3cret' } });
	expect(ok.status()).toBe(200);
	expect(await ok.text()).toContain('# Locked space — AI analyses');
	expect(await ok.text()).toContain('*No analyses yet*');
});
