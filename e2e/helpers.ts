import { expect, type Locator, type Page } from '@playwright/test';

// Выставляет локаль/имя/онбординг ДО первой навигации, чтобы баннеры
// NamePrompt и Onboarding не появлялись, а строки UI были на английском.
export async function initStorage(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('retro-locale', 'en');
		localStorage.setItem('retro_onboarding_seen', '1');
		localStorage.setItem('retro_name', 'E2E');
	});
}

// Создаёт доску через UI и возвращает её slug.
// Закрывает admin-баннер (fixed bottom-center), чтобы он не перехватывал клики.
export async function createBoard(page: Page, title: string): Promise<string> {
	await initStorage(page);
	await page.goto('/new');
	await page.getByPlaceholder('Board title (optional)').fill(title);
	await page.locator('form[action="?/createBoard"] button[type="submit"]').click();
	await page.waitForURL(/\/[A-Za-z0-9_-]{21}/);
	const closeBanner = page.getByRole('button', { name: 'Close' });
	await closeBanner.click();
	await expect(closeBanner).toBeHidden();
	return new URL(page.url()).pathname.slice(1);
}

// Корневой контейнер колонки по её заголовку ("Went Well" | "Didn't Go Well" | "To Improve")
export function column(page: Page, name: string): Locator {
	return page.getByTestId('column').filter({ has: page.getByRole('heading', { name }) });
}

export async function addCard(page: Page, columnName: string, text: string) {
	const col = column(page, columnName);
	await col.getByRole('button', { name: /Add a card/ }).click();
	await col.getByPlaceholder("What's on your mind?").fill(text);
	await col.getByPlaceholder("What's on your mind?").press('Enter');
	await expect(page.locator('.card-board', { hasText: text }).first()).toBeVisible();
}

// URL доски: host, затем сразу slug. /spaces/<slug> сюда не подходит — slug
// пространства тоже 21 символ, и waitForURL на нём сработал бы мгновенно.
export const BOARD_URL = /\/\/[^/]+\/[A-Za-z0-9_-]{21}(\?.*)?$/;

// Создаёт пространство через UI, закрывает admin-баннер.
// adminUrl — ссылка с ?admin=, по ней другой браузер становится создателем пространства.
export async function createSpace(page: Page, name: string): Promise<{ slug: string; adminUrl: string }> {
	await initStorage(page);
	await page.goto('/new');
	// Форма пространства скрыта за переключателем типа (вторая карточка — «Space»)
	await page.locator('button[aria-pressed]').nth(1).click();
	await page.getByPlaceholder('Space name').fill(name);
	await page.locator('form[action="?/createSpace"] button[type="submit"]').click();
	await page.waitForURL(/\/spaces\/[A-Za-z0-9_-]{21}/);
	const adminUrl = page.url();
	const closeBanner = page.getByRole('button', { name: 'Close' });
	await closeBanner.click();
	await expect(closeBanner).toBeHidden();
	return { slug: new URL(adminUrl).pathname.split('/')[2], adminUrl };
}

// Создаёт доску внутри пространства через модалку «New board». Остаётся на странице доски.
export async function createBoardInSpace(page: Page, spaceSlug: string, title: string): Promise<string> {
	await page.goto(`/spaces/${spaceSlug}`);
	await page.getByRole('button', { name: 'New board' }).first().click();
	const modal = page.getByRole('dialog');
	await modal.getByPlaceholder('Board title (optional)').fill(title);
	await modal.locator('button[type="submit"]').click();
	await page.waitForURL(BOARD_URL);
	const closeBanner = page.getByRole('button', { name: 'Close' });
	await closeBanner.click();
	await expect(closeBanner).toBeHidden();
	return new URL(page.url()).pathname.slice(1);
}
