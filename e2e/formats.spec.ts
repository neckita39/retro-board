import { test, expect, type Locator } from '@playwright/test';
import { addCard, column, dismissToast, initStorage } from './helpers';

test('classic is preselected and marked as recommended', async ({ page }) => {
	await initStorage(page);
	await page.goto('/new');
	await expect(page.getByRole('radio', { name: /Classic/ })).toBeChecked();
	await expect(page.getByText('Recommended', { exact: true })).toBeVisible();
});

test('a board created from a format link uses that format end to end', async ({ page }) => {
	await initStorage(page);
	await page.goto('/new?format=sailboat');
	await expect(page.getByRole('radio', { name: /Sailboat/ })).toBeChecked();
	await page.locator('form[action="?/createBoard"] button[type="submit"]').click();
	await page.waitForURL(/\/[A-Za-z0-9_-]{21}/);
	await dismissToast(page);

	for (const name of ['Wind', 'Anchors', 'Rocks', 'Island']) {
		await expect(page.getByRole('heading', { name })).toBeVisible();
	}
	await expect(page.getByRole('heading', { name: 'Went Well' })).toHaveCount(0);

	await addCard(page, 'Rocks', 'legacy auth expires in Q4');
	await page.dragAndDrop(
		'.card-board:has-text("legacy auth")',
		'[data-testid="column"]:has(h2:has-text("Island"))'
	);
	await expect(column(page, 'Island').locator('.card-board', { hasText: 'legacy auth' })).toBeVisible();

	// Итоги показывают карточку под колонкой формата
	await expect(page.getByTestId('summary-card').filter({ hasText: 'legacy auth' })).toBeVisible();

	// Экспорт знает формат и его колонки
	const slug = new URL(page.url()).pathname.slice(1);
	const data = await (await page.request.get(`/${slug}/export`)).json();
	expect(data.board.format).toBe('sailboat');
	expect(Object.keys(data.columns)).toEqual(['wind', 'anchors', 'rocks', 'island']);
	expect(data.columns.island[0].content).toBe('legacy auth expires in Q4');

	// Браузер запомнил выбор
	await page.goto('/new');
	await expect(page.getByRole('radio', { name: /Sailboat/ })).toBeChecked();
});

// Иллюстрация формата — фон плитки, один и тот же в обеих темах: art-токены не
// переопределяются в .dark, поэтому цвет текста и фона плитки после переключения темы
// тот же, а заголовок страницы (обычный токен) — другой.
async function colors(tile: Locator) {
	const title = tile.locator('.font-heading').first();
	return {
		text: await title.evaluate((el) => getComputedStyle(el).color),
		background: await tile.evaluate((el) => getComputedStyle(el).backgroundColor)
	};
}

test('format tiles on /formats show their illustration and ignore the theme', async ({ page }) => {
	await initStorage(page);
	await page.goto('/formats');
	await expect(page.getByTestId('format-tile')).toHaveCount(4);
	for (const slug of ['start-stop-continue', 'mad-sad-glad', '4l', 'sailboat']) {
		await expect(page.locator(`[data-testid="format-tile"][data-format="${slug}"]`)).toHaveCSS(
			'background-image',
			new RegExp(`/_app/immutable/assets/${slug}\\.[\\w-]+\\.webp`)
		);
	}

	const tile = page.locator('[data-testid="format-tile"][data-format="sailboat"]');
	// Файл из сборки Vite: хеш в имени и кэш на год
	const image = await tile.evaluate((el) => getComputedStyle(el).backgroundImage.slice(5, -2));
	const res = await page.request.get(image);
	expect(res.headers()['content-type']).toBe('image/webp');
	expect(res.headers()['cache-control']).toBe('public,max-age=31536000,immutable');

	const heading = page.getByRole('heading', { level: 1 });
	const light = await colors(tile);
	const headingLight = await heading.evaluate((el) => getComputedStyle(el).color);

	await page.getByRole('button', { name: 'Theme', exact: true }).click();
	await expect(heading).not.toHaveCSS('color', headingLight);
	expect(await colors(tile)).toEqual(light);
});

test('every option of the format picker, classic included, has its illustration in both themes', async ({ page }) => {
	await initStorage(page);
	await page.goto('/new');
	const options = page.getByTestId('format-option');
	await expect(options).toHaveCount(5);
	for (const id of ['classic', 'start-stop-continue', 'mad-sad-glad', '4l', 'sailboat']) {
		await expect(page.locator(`[data-testid="format-option"][data-format="${id}"]`)).toHaveCSS(
			'background-image',
			new RegExp(`/_app/immutable/assets/${id}\\.[\\w-]+\\.webp`)
		);
	}

	const classic = page.locator('[data-testid="format-option"][data-format="classic"]');
	const light = await colors(classic);
	await page.getByRole('button', { name: 'Theme', exact: true }).click();
	await expect(page.locator('html')).toHaveClass(/dark/);
	expect(await colors(classic)).toEqual(light);
});

// Картинка 3:1 вписана по высоте и прижата вправо; иллюстрация — её правые 56 %, то есть
// 0.56 × 3 × высота плитки от правого края. Текст (правый край его строк) должен кончаться
// левее хотя бы на 16px — на всех ширинах, где плитка в режиме «баннер», в обеих локалях.
test('text on illustrated tiles never runs into the illustration', async ({ page }) => {
	await initStorage(page);
	for (const locale of ['ru', 'en']) {
		await page.addInitScript((l) => localStorage.setItem('retro-locale', l), locale);
		for (const width of [640, 768, 1280, 1536]) {
			await page.setViewportSize({ width, height: 900 });
			for (const path of ['/formats', '/', '/how-to-run-a-retro', '/new']) {
				await page.goto(path);
				const tiles = page.locator('[data-testid="format-tile"], [data-testid="format-option"]');
				await expect(tiles.first()).toBeVisible();
				const gaps = await tiles.evaluateAll((els) =>
					els
						.filter((el) => getComputedStyle(el).backgroundSize === 'auto 100%')
						.map((el) => {
							const box = el.getBoundingClientRect();
							let textRight = 0;
							for (const child of el.querySelectorAll(':scope > :not(input)')) {
								if (getComputedStyle(child).position === 'absolute') continue;
								const range = document.createRange();
								range.selectNodeContents(child);
								for (const r of range.getClientRects()) textRight = Math.max(textRight, r.right);
							}
							const art = 0.56 * 3 * (box.height - 2);
							return { id: (el as HTMLElement).dataset.format, gap: Math.round(box.right - 1 - art - textRight) };
						})
				);
				for (const { id, gap } of gaps) {
					expect(gap, `${path} ${width}px ${locale} ${id}`).toBeGreaterThanOrEqual(16);
				}
			}
		}
	}
});
