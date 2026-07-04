import { test, expect } from '@playwright/test';
import { createBoard, addCard } from './helpers';

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
