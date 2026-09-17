import { expect, type Locator, type Page } from '@playwright/test';

// Выставляет локаль/имя ДО первой навигации, чтобы карточка имени (NamePrompt)
// не появлялась, а строки UI были на английском. retro_onboarding_seen остался
// от старой подсказки-онбординга — безвреден.
export async function initStorage(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('retro-locale', 'en');
		localStorage.setItem('retro_onboarding_seen', '1');
		localStorage.setItem('retro_name', 'E2E');
	});
}

// Закрывает тост «Board/Space created — share the link…» (правый верхний угол).
// Он тоже success, поэтому убираем сразу — иначе позже его спутают с «AI analysis is ready».
export async function dismissToast(page: Page) {
	const toast = page.getByTestId('toast').filter({ hasText: /created — share the link/ });
	await toast.getByRole('button', { name: 'Dismiss' }).click();
	await expect(toast).toBeHidden();
}

// Создаёт доску через UI и возвращает её slug. Закрывает тост «создана».
export async function createBoard(page: Page, title: string): Promise<string> {
	await initStorage(page);
	await page.goto('/new');
	await page.getByPlaceholder('Board title (optional)').fill(title);
	await page.locator('form[action="?/createBoard"] button[type="submit"]').click();
	await page.waitForURL(/\/[A-Za-z0-9_-]{21}/);
	await dismissToast(page);
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

// Создаёт пространство через UI, закрывает тост «создано».
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
	await dismissToast(page);
	return { slug: new URL(adminUrl).pathname.split('/')[2], adminUrl };
}

// Создаёт доску внутри пространства через модалку «New board». Остаётся на странице доски.
// adminUrl — ссылка с ?admin=: по ней другой браузер становится создателем доски (но не пространства).
// Токен берём из cookie retro_creator_{slug}: ?admin страница сразу убирает из адреса.
export async function createBoardInSpace(page: Page, spaceSlug: string, title: string): Promise<{ slug: string; adminUrl: string }> {
	await page.goto(`/spaces/${spaceSlug}`);
	await page.getByRole('button', { name: 'New board' }).first().click();
	const modal = page.getByRole('dialog');
	await modal.getByPlaceholder('Board title (optional)').fill(title);
	await modal.locator('button[type="submit"]').click();
	await page.waitForURL(BOARD_URL);
	await dismissToast(page);
	const { origin, pathname } = new URL(page.url());
	const slug = pathname.slice(1);
	const creator = (await page.context().cookies(origin)).find((c) => c.name === `retro_creator_${slug}`);
	if (!creator) throw new Error(`createBoardInSpace: нет cookie создателя для доски ${slug}`);
	return { slug, adminUrl: `${origin}/${slug}?admin=${creator.value}` };
}

// Пространство с паролем. Создатель получает cookie доступа сразу.
export async function createLockedSpace(page: Page, name: string, password: string): Promise<{ slug: string; adminUrl: string }> {
	await initStorage(page);
	await page.goto('/new');
	await page.locator('button[aria-pressed]').nth(1).click();
	await page.getByPlaceholder('Space name').fill(name);
	await page.getByText('Set a password').click();
	await page.getByPlaceholder('Password').fill(password);
	await page.locator('form[action="?/createSpace"] button[type="submit"]').click();
	await page.waitForURL(/\/spaces\/[A-Za-z0-9_-]{21}/);
	const adminUrl = page.url();
	await dismissToast(page);
	return { slug: new URL(adminUrl).pathname.split('/')[2], adminUrl };
}

// ── Битрикс24 ───────────────────────────────────────────────────────────────

// Мок портала (e2e/mock-bitrix.mjs) и вебхук, который тест «вставляет» как пользователь.
// http и localhost сервер принимает только с BITRIX_ALLOW_HTTP=1 (playwright.config.ts)
export const BITRIX_MOCK = 'http://localhost:4779';
export const BITRIX_WEBHOOK = `${BITRIX_MOCK}/rest/1/testcode/`;

// PNG 16×16. Сервер пережимает его в WebP, поэтому на Диск уходит retro-{cardId}.webp
export const CARD_PNG = 'e2e/fixtures/card.png';

// Карточка с текстом и картинкой через форму колонки. У CardForm.submit() нет защиты
// от раннего Enter: без ожидания /api/upload карточка ушла бы без картинки
export async function addCardWithImage(page: Page, columnName: string, text: string, fixture: string = CARD_PNG) {
	const col = column(page, columnName);
	await col.getByRole('button', { name: /Add a card/ }).click();
	const textarea = col.getByPlaceholder("What's on your mind?");
	await textarea.fill(text);
	const upload = page.waitForResponse(
		(r) => new URL(r.url()).pathname === '/api/upload' && r.request().method() === 'POST'
	);
	// Скрытых input[type=file] в колонке несколько: у CardForm и у свёрнутой CommentForm каждой карточки.
	// CardForm стоит в колонке раньше списка карточек, поэтому его поле первое
	await col.locator('input[type="file"]').first().setInputFiles(fixture);
	const response = await upload;
	expect(response.status()).toBe(200);
	await response.finished();
	// Спиннер превью гаснет в finally, уже после записи imageId
	await expect(col.locator('form svg.animate-spin')).toHaveCount(0);
	await expect(col.getByText('Upload failed')).toHaveCount(0);
	await textarea.press('Enter');
	await expect(page.locator('.card-board', { hasText: text }).first().locator('img[src^="/api/image/"]')).toBeVisible();
}

// Раскрывает панель Битрикс24 на странице пространства. Триггер есть уже в SSR-разметке,
// клик до гидрации может потеряться — повторяем, пока aria-expanded не станет true
export async function openBitrixPanel(page: Page): Promise<Locator> {
	const toggle = page.getByTestId('bitrix-panel-toggle');
	await expect(async () => {
		if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 });
	}).toPass({ timeout: 10_000 });
	return page.getByTestId('bitrix-panel');
}

// Подключает мок-портал в панели пространства и ждёт состояние «подключено».
// spaceUrl — обычный адрес /spaces/{slug} (без ?bitrix=1 и ?admin=): панель закрыта
export async function connectBitrix(page: Page, spaceUrl: string, opts: { group?: number } = {}): Promise<Locator> {
	await page.goto(spaceUrl);
	const panel = await openBitrixPanel(page);
	await panel.locator('input[name="webhook"]').fill(BITRIX_WEBHOOK);
	if (opts.group !== undefined) await panel.locator('input[name="groupId"]').fill(String(opts.group));
	await panel.getByRole('button', { name: 'Connect', exact: true }).click();
	// Имя владельца вебхука из profile мока видно только в состоянии «подключено»
	await expect(panel.getByText('Ivan Petrov')).toBeVisible({ timeout: 10_000 });
	return panel;
}

// Открывает преформу задачи с карточки доски и возвращает её форму
export async function openCardTaskModal(page: Page, cardText: string): Promise<Locator> {
	const card = page.locator('.card-board', { hasText: cardText });
	await card.getByTestId('card-task-button').click();
	const form = page.getByTestId('bitrix-task-form');
	await expect(form).toBeVisible();
	return form;
}
