import { test, expect, type Browser, type Page } from '@playwright/test';
import {
	addCard,
	addCardWithImage,
	BITRIX_MOCK,
	BITRIX_WEBHOOK,
	connectBitrix,
	createBoardInSpace,
	createLockedSpace,
	createSpace,
	dismissToast,
	initStorage,
	openBitrixPanel,
	openCardTaskModal
} from './helpers';

// Интеграция с Битрикс24 против мока портала (e2e/mock-bitrix.mjs).
// Строки UI — английские: initStorage выставляет локаль en, как во всех e2e.

test.describe.configure({ timeout: 60_000 });

const APP = 'http://localhost:4777';
const DEEPSEEK = 'http://localhost:4778';
const GROUP_NOT_FOUND = 'Group not found — check the id or clear the field';

type Mode = 'ok' | 'invalid_webhook' | 'scope' | 'disk_fail' | 'error' | 'delay';

interface MockCall {
	method: string; // в нижнем регистре: disk.storage.uploadfile
	api: boolean; // true — адрес REST 3.0 (/rest/api/…)
	userId: number;
	body: any;
	headers: Record<string, string>;
	status: number;
	response: any;
}

// Лимиты Битрикс24 считаются по IP (5 подключений в минуту), а весь прогон идёт с одного адреса.
// Сервер e2e берёт IP из x-forwarded-for (ADDRESS_HEADER в playwright.config.ts) — у каждого теста свой.
// Адрес считает счётчик, а не random: два теста в одну минуту не должны случайно совпасть
let clientIp = '10.0.0.1';
let ipCounter = 0;

test.beforeEach(async ({ context, request }) => {
	ipCounter++;
	clientIp = `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
	await context.setExtraHTTPHeaders({ 'x-forwarded-for': clientIp });
	await request.post(`${BITRIX_MOCK}/__reset`);
	await request.post(`${BITRIX_MOCK}/__mode`, { data: { mode: 'ok' } });
});

// Второй и третий браузер в том же тесте — с тем же адресом, что и основной
function newContext(browser: Browser) {
	return browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': clientIp } });
}

async function setBitrixMode(page: Page, mode: Mode, delayMs = 0) {
	const res = await page.request.post(`${BITRIX_MOCK}/__mode`, { data: { mode, delayMs } });
	expect(res.ok()).toBe(true);
}

async function bitrixCalls(page: Page): Promise<MockCall[]> {
	return (await page.request.get(`${BITRIX_MOCK}/__calls`)).json();
}

const callsOf = (calls: MockCall[], method: string) => calls.filter((c) => c.method === method);
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Ссылка на задачу: хост портала + link из ответа tasks.task.add
const taskUrl = (link: string) => new RegExp(`^https?://localhost(:\\d+)?${escapeRegExp(link)}$`);
const toasts = (page: Page) => page.getByTestId('toast');
const cardOnBoard = (page: Page, text: string) => page.locator('.card-board', { hasText: text });

// Прямой POST в экшен так, как его шлёт use:enhance. Заголовок x-sveltekit-action: true направляет
// POST в экшен страницы (без него — +server.ts → 405), origin проходит CSRF; accept необязателен
async function postAction(page: Page, path: string, form: Record<string, string>) {
	const res = await page.request.post(path, {
		form,
		headers: { accept: 'application/json', 'x-sveltekit-action': 'true', origin: APP },
		maxRedirects: 0
	});
	// Тело разбираем, только если это JSON: на редирект или страницу ошибки res.json() упал бы,
	// и настоящий статус ответа потерялся бы за «Unexpected token» вместо понятного отказа
	const isJson = (res.headers()['content-type'] ?? '').includes('application/json');
	const result = isJson ? await res.json() : { type: 'non-json', body: (await res.text()).slice(0, 200) };
	return { httpStatus: res.status(), result };
}

// data у failure/success сериализована devalue: плоский массив, корень — первый элемент.
// Разворачиваем только верхний уровень — тестам нужен bitrixError
function actionData(result: { data?: string }): Record<string, unknown> {
	const flat = JSON.parse(result.data ?? '[{}]') as unknown[];
	const root = (flat[0] ?? {}) as Record<string, number>;
	return Object.fromEntries(Object.entries(root).map(([key, index]) => [key, flat[index]]));
}

// Пространство с подключённым мок-порталом и доска в нём; страница остаётся на доске
async function seedBoard(page: Page, name: string, opts: { group?: number } = {}) {
	const space = await createSpace(page, name);
	await connectBitrix(page, `/spaces/${space.slug}`, opts);
	const board = await createBoardInSpace(page, space.slug, 'Sprint 1');
	return { space, board };
}

// Создаёт задачу из карточки через преформу без правок полей
async function createTaskFrom(page: Page, cardText: string) {
	const form = await openCardTaskModal(page, cardText);
	const cardId = await form.locator('input[name="cardId"]').inputValue();
	await page.getByTestId('bitrix-task-submit').click();
	await expect(form).toHaveCount(0, { timeout: 15_000 });
	const add = callsOf(await bitrixCalls(page), 'tasks.task.add').filter((c) => c.status === 200).at(-1);
	expect(add).toBeTruthy();
	const item = add!.response.result.item as { id: number; link: string };
	await expect(toasts(page).getByText(`Task #${item.id} created`, { exact: true })).toBeVisible();
	return { cardId, id: item.id, link: item.link, add: add! };
}

test('01. подключение с группой: портал, владелец и название группы переживают перезагрузку, гость панели не видит', async ({ page, browser }) => {
	const space = await createSpace(page, 'Bitrix connect');
	const panel = await connectBitrix(page, `/spaces/${space.slug}`, { group: 42 });
	await expect(panel.getByText(/localhost/).first()).toBeVisible();
	await expect(panel.getByText(/Платформа/)).toBeVisible();

	// Порядок строгий: profile → пробный вызов REST 3.0 → название группы
	const calls = await bitrixCalls(page);
	expect(calls.map((c) => [c.method, c.api, c.status])).toEqual([
		['profile', false, 200],
		['tasks.task.field.list', true, 200],
		['sonet_group.get', false, 200]
	]);
	for (const call of calls) expect(call.headers['content-type']).toContain('application/json');
	expect(String((calls[2].body.FILTER ?? calls[2].body.filter).ID)).toBe('42');

	await page.reload();
	await openBitrixPanel(page);
	await expect(panel.getByText('Ivan Petrov')).toBeVisible();
	await expect(panel.getByText(/Платформа/)).toBeVisible();
	// Код вебхука не попадает ни в разметку, ни в page data
	expect(await page.content()).not.toContain('testcode');

	const guestCtx = await newContext(browser);
	const guest = await guestCtx.newPage();
	await initStorage(guest);
	await guest.goto(`/spaces/${space.slug}`);
	await expect(guest.getByRole('heading', { level: 1, name: 'Bitrix connect' })).toBeVisible();
	await expect(guest.getByTestId('bitrix-panel-toggle')).toHaveCount(0);
	await expect(guest.getByTestId('bitrix-panel')).toHaveCount(0);
	expect(await guest.content()).not.toContain('Ivan Petrov');
	await guestCtx.close();
});

test('02. неверный вебхук: ошибка в панели, введённое не стирается, после перезагрузки — «не подключено»', async ({ page }) => {
	const space = await createSpace(page, 'Bitrix wrong');
	await page.goto(`/spaces/${space.slug}`);
	const panel = await openBitrixPanel(page);
	const webhook = panel.locator('input[name="webhook"]');
	const connect = panel.getByRole('button', { name: 'Connect', exact: true });

	// Чужой код: портал отвечает INVALID_CREDENTIALS
	const wrong = `${BITRIX_MOCK}/rest/1/wrongcode/`;
	await webhook.fill(wrong);
	await connect.click();
	await expect(panel.getByText(/The portal rejected the webhook/)).toBeVisible({ timeout: 10_000 });
	await expect(webhook).toHaveValue(wrong);
	expect((await bitrixCalls(page)).map((c) => [c.method, c.status])).toEqual([['profile', 401]]);

	// Приватный адрес отсекается до любого исходящего запроса
	await webhook.fill('https://192.168.1.10/rest/1/testcode/');
	await connect.click();
	await expect(panel.getByText(/look like an inbound webhook/)).toBeVisible();
	expect(await bitrixCalls(page)).toHaveLength(1);

	// Нет права «Задачи»: profile проходит, пробный вызов REST 3.0 — нет
	await setBitrixMode(page, 'scope');
	await webhook.fill(BITRIX_WEBHOOK);
	await connect.click();
	await expect(panel.getByText(/lacks the Tasks permission/)).toBeVisible({ timeout: 10_000 });
	expect(callsOf(await bitrixCalls(page), 'tasks.task.field.list').map((c) => c.status)).toEqual([401]);

	await page.reload();
	await openBitrixPanel(page);
	await expect(panel.locator('input[name="webhook"]')).toBeVisible();
	await expect(panel.getByText('Ivan Petrov')).toHaveCount(0);
});

test('03. доска в пространстве: задачу создаёт ведущий, гость видит бейдж без перезагрузки, мок получает поля и тег', async ({ browser }) => {
	const ctxA = await newContext(browser);
	const ctxB = await newContext(browser);
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const space = await createSpace(pageA, 'Bitrix team');
	await connectBitrix(pageA, `/spaces/${space.slug}`, { group: 42 });
	const board = await createBoardInSpace(pageA, space.slug, 'Sprint 7');
	await addCard(pageA, 'To Improve', 'Split the deploy job');

	await initStorage(pageB);
	await pageB.goto(`/${board.slug}`);
	const cardB = cardOnBoard(pageB, 'Split the deploy job');
	await expect(cardB).toBeVisible();
	await expect(cardB.getByTestId('card-task-button')).toHaveCount(0);
	await expect(pageB.getByTestId('task-badge')).toHaveCount(0);

	const form = await openCardTaskModal(pageA, 'Split the deploy job');
	const dialog = pageA.getByRole('dialog');
	await expect(form.locator('input[name="title"]')).toBeFocused();
	await expect(form.locator('input[name="title"]')).toHaveValue('Split the deploy job');
	await expect(form.locator('textarea[name="description"]')).toHaveValue(/From retro .Sprint 7. . column .To Improve./);
	await expect(form.locator('textarea[name="description"]')).toHaveValue(new RegExp(escapeRegExp(`${APP}/${board.slug}`)));
	await expect(form.locator('input[name="groupId"]')).toHaveValue('42');
	await expect(dialog.getByText('Платформа')).toBeVisible();
	await expect(form.locator('input[name="deadline"]')).toHaveValue('');
	await expect(form.locator('input[name="source"]')).toHaveValue('card');
	await expect(dialog.getByText('Responsible and creator: Ivan Petrov')).toBeVisible();
	await expect(dialog.getByText('The card image will be attached')).toHaveCount(0);

	// Срок в будущем году: min у поля — сегодня. Калининград — UTC+2 круглый год
	const deadline = `${new Date().getFullYear() + 1}-03-15`;
	await form.locator('input[name="deadline"]').fill(deadline);
	await dialog.getByText('Important task').click();
	await pageA.getByTestId('bitrix-task-submit').click();
	await expect(form).toHaveCount(0, { timeout: 15_000 });

	const calls = await bitrixCalls(pageA);
	const [add] = callsOf(calls, 'tasks.task.add');
	const taskId = add.response.result.item.id as number;
	const created = toasts(pageA).filter({ hasText: `Task #${taskId} created` });
	await expect(created.getByText(`Task #${taskId} created`, { exact: true })).toBeVisible();
	await expect(created.getByRole('link', { name: /Open/ })).toHaveAttribute('target', '_blank');

	const cardA = cardOnBoard(pageA, 'Split the deploy job');
	await expect(cardA.getByTestId('task-badge')).toContainText(`Task #${taskId}`);
	await expect(cardA.getByTestId('card-task-button')).toHaveCount(0);
	// Гость узнаёт о задаче по сокету
	await expect(cardB.getByTestId('task-badge')).toContainText(`Task #${taskId}`, { timeout: 10_000 });

	expect(add.api).toBe(true);
	expect(add.status).toBe(200);
	expect(add.headers['content-type']).toContain('application/json');
	expect(add.headers['idempotency-key']).toMatch(/^[0-9a-f]{64}$/);
	expect(add.body.fields).toMatchObject({
		title: 'Split the deploy job',
		responsibleId: 1,
		creatorId: 1,
		groupId: 42,
		priority: 'high',
		deadline: `${deadline}T19:00:00+02:00`
	});
	expect(add.body.fields.description).toContain('Split the deploy job');
	expect(add.body.fields.description).toContain(`${APP}/${board.slug}`);
	expect(add.body.fields).not.toHaveProperty('tags');
	expect(add.response.result.item.link).toBe(`/workgroups/group/42/tasks/task/view/${taskId}/`);

	// Тег — отдельным вызовом старого REST сразу после создания
	const methods = calls.map((c) => c.method);
	const [update] = callsOf(calls, 'tasks.task.update');
	expect(update.api).toBe(false);
	expect(Number(update.body.taskId)).toBe(taskId);
	expect(update.body.fields).toEqual({ TAGS: ['retro'] });
	expect(methods.indexOf('tasks.task.update')).toBeGreaterThan(methods.indexOf('tasks.task.add'));
	expect(methods.some((m) => m.startsWith('disk.'))).toBe(false);

	await ctxA.close();
	await ctxB.close();
});

test('04. у карточки с задачей кнопки нет, бейдж ведёт на ссылку портала в новой вкладке, повтор отвечает exists', async ({ page }) => {
	const { board } = await seedBoard(page, 'Bitrix badge', { group: 42 });
	await addCard(page, 'Went Well', 'Pairing on reviews helped');
	const task = await createTaskFrom(page, 'Pairing on reviews helped');
	expect(task.link).toBe(`/workgroups/group/42/tasks/task/view/${task.id}/`);
	// Не «важная» — priority не передаётся; срок пустой
	expect(task.add.body.fields).not.toHaveProperty('priority');
	expect(task.add.body.fields.deadline ?? null).toBeNull();

	await page.reload();
	const card = cardOnBoard(page, 'Pairing on reviews helped');
	const badge = card.getByTestId('task-badge');
	await expect(badge).toContainText(`Task #${task.id}`);
	await expect(card.getByTestId('card-task-button')).toHaveCount(0);
	await expect(badge).toHaveAttribute('target', '_blank');
	await expect(badge).toHaveAttribute('rel', /noopener/);
	await expect(badge).toHaveAttribute('href', taskUrl(task.link));
	const href = (await badge.getAttribute('href'))!;

	// Та же ссылка у компактного бейджа в «Итогах»
	const row = page.getByTestId('summary-card').filter({ hasText: 'Pairing on reviews helped' });
	await expect(row.getByTestId('task-badge')).toHaveAttribute('href', href);

	// Повторный запрос с той же карточки: exists, в портал никто не ходит
	const again = await postAction(page, `/${board.slug}?/createTask`, {
		cardId: task.cardId,
		title: 'Pairing on reviews helped',
		description: '',
		groupId: '',
		deadline: '',
		source: 'card'
	});
	expect(again.result).toMatchObject({ type: 'failure', status: 409 });
	expect(actionData(again.result).bitrixError).toBe('exists');
	expect(callsOf(await bitrixCalls(page), 'tasks.task.add')).toHaveLength(1);
});

test('05. карточка с картинкой: файл уходит на личный Диск и прикрепляется по ID объекта; без права «Диск» задача создаётся с предупреждением', async ({ page }) => {
	await seedBoard(page, 'Bitrix image');
	await addCardWithImage(page, 'Went Well', 'Whiteboard after the retro');

	const form = await openCardTaskModal(page, 'Whiteboard after the retro');
	await expect(page.getByRole('dialog').getByText('The card image will be attached')).toBeVisible();
	const cardId = await form.locator('input[name="cardId"]').inputValue();

	// Медленный портал: видно состояние отправки с картинкой
	await setBitrixMode(page, 'delay', 700);
	const submit = page.getByTestId('bitrix-task-submit');
	await submit.click();
	await expect(submit).toContainText(/Creating and attaching the image/);
	await expect(submit).toBeDisabled();
	await expect(form).toHaveCount(0, { timeout: 20_000 });
	await setBitrixMode(page, 'ok');

	const calls = await bitrixCalls(page);
	const methods = calls.map((c) => c.method);
	expect(methods.slice(methods.indexOf('tasks.task.add'))).toEqual([
		'tasks.task.add',
		'tasks.task.update',
		'disk.storage.getlist',
		'disk.storage.uploadfile',
		'tasks.task.file.attach'
	]);
	const [add] = callsOf(calls, 'tasks.task.add');
	const taskId = add.response.result.item.id as number;
	await expect(toasts(page).getByText(`Task #${taskId} created`, { exact: true })).toBeVisible();

	const [storage] = callsOf(calls, 'disk.storage.getlist');
	const storageFilter = storage.body.filter ?? storage.body.FILTER;
	expect(storage.api).toBe(false);
	expect(storageFilter.ENTITY_TYPE).toBe('user');
	expect(String(storageFilter.ENTITY_ID)).toBe('1');

	const [upload] = callsOf(calls, 'disk.storage.uploadfile');
	expect(upload.api).toBe(false);
	expect(upload.status).toBe(200);
	expect(String(upload.body.id)).toBe('11');
	expect(upload.body.data.NAME).toBe(`retro-${cardId}.webp`);
	expect(upload.body.fileContent[0]).toBe(`retro-${cardId}.webp`);
	expect(upload.body.fileContent[1]).toMatch(/^[A-Za-z0-9+/]+=*$/);
	expect(upload.body.generateUniqueName).toBe(true);
	const { ID, FILE_ID } = upload.response.result as { ID: number; FILE_ID: number };
	expect(ID).not.toBe(FILE_ID);

	const [attach] = callsOf(calls, 'tasks.task.file.attach');
	expect(attach.api).toBe(true);
	expect(attach.status).toBe(200);
	expect(Number(attach.body.taskId)).toBe(taskId);
	expect((attach.body.fileIds as unknown[]).map(Number)).toEqual([ID]);

	// Нет права «Диск»: задача создана, картинка не прикреплена, тост предупреждает.
	// В колонке уже есть карточка, поэтому полей файла в ней несколько — addCardWithImage берёт первое
	await addCardWithImage(page, 'Went Well', 'Sticky notes photo');
	await setBitrixMode(page, 'disk_fail');
	await openCardTaskModal(page, 'Sticky notes photo');
	await page.getByTestId('bitrix-task-submit').click();
	await expect(page.getByTestId('bitrix-task-form')).toHaveCount(0, { timeout: 15_000 });
	const second = callsOf(await bitrixCalls(page), 'tasks.task.add').at(-1)!;
	const secondId = second.response.result.item.id as number;
	await expect(toasts(page).getByText(`Task #${secondId} created, the image was not attached`, { exact: true })).toBeVisible();
	await expect(cardOnBoard(page, 'Sticky notes photo').getByTestId('task-badge')).toContainText(`Task #${secondId}`);
	expect(callsOf(await bitrixCalls(page), 'tasks.task.file.attach')).toHaveLength(1);
});

test('06. вебхук отозван при создании: ошибка в преформе со ссылкой в настройки, панель предупреждает и принимает новый вебхук', async ({ page }) => {
	const { space } = await seedBoard(page, 'Bitrix revoked');
	await addCard(page, 'Went Well', 'Retro notes live in the wiki');
	const form = await openCardTaskModal(page, 'Retro notes live in the wiki');
	await setBitrixMode(page, 'invalid_webhook');
	await page.getByTestId('bitrix-task-submit').click();

	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('alert')).toContainText('The webhook no longer works', { timeout: 15_000 });
	// Форма остаётся с тем, что ввели
	await expect(form.locator('input[name="title"]')).toHaveValue('Retro notes live in the wiki');
	await expect(cardOnBoard(page, 'Retro notes live in the wiki').getByTestId('task-badge')).toHaveCount(0);
	const settings = dialog.getByRole('link', { name: /Space settings/ });
	await expect(settings).toHaveAttribute('href', new RegExp(`/spaces/${space.slug}\\?bitrix=1$`));

	await setBitrixMode(page, 'ok');
	await Promise.all([page.waitForURL((u) => u.pathname === `/spaces/${space.slug}`), settings.click()]);
	await expect(page.getByTestId('bitrix-panel-toggle')).toHaveAttribute('aria-expanded', 'true');
	const panel = page.getByTestId('bitrix-panel');
	await expect(panel.getByText(/The webhook stopped working/)).toBeVisible();

	await panel.locator('input[name="webhook"]').fill(BITRIX_WEBHOOK);
	await panel.getByRole('button', { name: 'Connect', exact: true }).click();
	await expect(panel.getByText('Ivan Petrov')).toBeVisible({ timeout: 10_000 });
	await expect(panel.getByText(/The webhook stopped working/)).toHaveCount(0);
});

test('07. задача из сфокусированной строки «Итогов»: повтор после перегрузки портала тем же ключом, обсуждение не прерывается', async ({ page }) => {
	await seedBoard(page, 'Bitrix summary');
	await addCard(page, 'Went Well', 'Demo day went great');
	await addCard(page, "Didn't Go Well", 'Staging was down twice');

	await page.getByRole('button', { name: 'Discuss', exact: true }).click();
	const focused = page.locator('[data-testid="summary-card"][data-focused="true"]');
	await expect(focused).toContainText('Demo day went great');
	await expect(page.getByTestId('summary-task-button')).toHaveCount(1);

	await focused.getByTestId('summary-task-button').click();
	const form = page.getByTestId('bitrix-task-form');
	await expect(form.locator('input[name="title"]')).toHaveValue('Demo day went great');
	await expect(form.locator('input[name="source"]')).toHaveValue('summary');

	// Портал перегружен: текст, главная кнопка — «Повторить», форма на месте
	await setBitrixMode(page, 'error');
	const submit = page.getByTestId('bitrix-task-submit');
	await submit.click();
	await expect(page.getByRole('dialog').getByRole('alert')).toContainText('The portal is overloaded', { timeout: 15_000 });
	await expect(submit).toContainText('Retry');

	await setBitrixMode(page, 'ok');
	await submit.click();
	await expect(form).toHaveCount(0, { timeout: 15_000 });

	const adds = callsOf(await bitrixCalls(page), 'tasks.task.add');
	expect(adds.map((c) => c.status)).toEqual([503, 200]);
	expect(adds[1].headers['idempotency-key']).toBe(adds[0].headers['idempotency-key']);
	const taskId = adds[1].response.result.item.id as number;

	await expect(focused).toContainText('Demo day went great');
	await expect(focused.getByTestId('task-badge')).toContainText(`#${taskId}`);
	await expect(focused.getByTestId('summary-task-button')).toHaveCount(0);
	await expect(cardOnBoard(page, 'Demo day went great').getByTestId('task-badge')).toContainText(`Task #${taskId}`);
	await expect(page.getByRole('button', { name: /Next/ })).toBeVisible();
});

test('08. экспорт JSON и Markdown несёт задачу карточки', async ({ page }) => {
	const { board } = await seedBoard(page, 'Bitrix export');
	await addCard(page, 'Went Well', 'Keep the release checklist');
	await addCard(page, 'Went Well', 'Coffee machine is broken');
	const task = await createTaskFrom(page, 'Keep the release checklist');

	const res = await page.request.get(`/api/v1/boards/${board.slug}/export.json`);
	expect(res.status()).toBe(200);
	const data = await res.json();
	const cards = data.columns.went_well as { content: string; task: { id: number; url: string } | null }[];
	const withTask = cards.find((c) => c.content === 'Keep the release checklist')!;
	expect(withTask.task).toEqual({ id: task.id, url: expect.stringMatching(taskUrl(task.link)) });
	expect(cards.find((c) => c.content === 'Coffee machine is broken')!.task).toBeNull();
	expect(JSON.stringify(data)).not.toContain('testcode');

	const md = await (await page.request.get(`/api/v1/boards/${board.slug}/export.md`)).text();
	expect(md).toContain(withTask.task!.url);

	// Экспорт из меню доски собирается той же функцией
	const legacy = await (await page.request.get(`/${board.slug}/export`)).json();
	const legacyCard = legacy.columns.went_well.find((c: { content: string }) => c.content === 'Keep the release checklist');
	expect(legacyCard.task.id).toBe(task.id);
});

test('09. доска-анализ: у создателя пространства есть «В задачу», описание начинается с AI-анализа', async ({ page }) => {
	await page.request.post(`${DEEPSEEK}/__mode`, { data: { mode: 'ok', delayMs: 0 } });
	const space = await createSpace(page, 'Bitrix analysis');
	await connectBitrix(page, `/spaces/${space.slug}`);
	await createBoardInSpace(page, space.slug, 'Sprint 1');
	await addCard(page, "Didn't Go Well", 'flaky tests');

	await page.goto(`/spaces/${space.slug}`);
	await page.getByTestId('analyze-button').click();
	const ready = page.locator('[data-testid="toast"][data-kind="success"]').filter({ hasText: 'AI analysis is ready' });
	await expect(ready).toBeVisible({ timeout: 20_000 });
	const path = await ready.getByRole('link', { name: /Open/ }).getAttribute('href');
	await page.goto(path!);
	await expect(page).toHaveTitle(/^Space analysis for/);

	const form = await openCardTaskModal(page, 'Deploys keep going smoothly');
	await expect(form.locator('input[name="groupId"]')).toHaveValue('');
	await expect(form.locator('textarea[name="description"]')).toHaveValue(/From AI analysis .Space analysis for/);
	await page.getByTestId('bitrix-task-submit').click();
	await expect(form).toHaveCount(0, { timeout: 15_000 });

	const add = callsOf(await bitrixCalls(page), 'tasks.task.add').at(-1)!;
	const taskId = add.response.result.item.id as number;
	expect(add.body.fields.description).toMatch(/From AI analysis .Space analysis for/);
	expect(add.body.fields.groupId ?? null).toBeNull();
	expect(add.response.result.item.link).toBe(`/company/personal/user/1/tasks/task/view/${taskId}/`);
	await expect(cardOnBoard(page, 'Deploys keep going smoothly').getByTestId('task-badge')).toContainText(`Task #${taskId}`);
});

test('10. отключение: после перезагрузки кнопок нет, бейджи остаются, меню снова предлагает подключить', async ({ page }) => {
	const { space, board } = await seedBoard(page, 'Bitrix disconnect');
	await addCard(page, 'Went Well', 'Ship the changelog');
	await addCard(page, 'Went Well', 'Rotate on-call weekly');
	const task = await createTaskFrom(page, 'Ship the changelog');

	await page.goto(`/spaces/${space.slug}`);
	const panel = await openBitrixPanel(page);
	await panel.getByRole('button', { name: 'Disconnect', exact: true }).click();
	// Подтверждение вторым кликом, без браузерного диалога
	await panel.getByRole('button', { name: 'Click again to disconnect' }).click();
	// Бейдж «Отключено» страница рисует у H1 пространства (заметка 8), вне корня панели; живёт 2,5 с
	await expect(page.getByText('Disconnected', { exact: true })).toBeVisible();
	await expect(panel.locator('input[name="webhook"]')).toBeVisible();

	await page.reload();
	await openBitrixPanel(page);
	await expect(panel.locator('input[name="webhook"]')).toBeVisible();
	await expect(panel.getByText('Ivan Petrov')).toHaveCount(0);

	await page.goto(`/${board.slug}`);
	await expect(cardOnBoard(page, 'Ship the changelog').getByTestId('task-badge')).toHaveAttribute('href', taskUrl(task.link));
	await expect(cardOnBoard(page, 'Rotate on-call weekly')).toBeVisible();
	await expect(page.getByTestId('card-task-button')).toHaveCount(0);
	await page.getByRole('button', { name: 'Menu' }).click();
	await expect(page.getByTestId('menu-bitrix-connect')).toBeVisible();
	expect(callsOf(await bitrixCalls(page), 'tasks.task.add')).toHaveLength(1);
});

test('11. закрытое пространство: создатель доски без пароля пространства не видит «В задачу» и получает forbidden, гость тоже', async ({ browser }) => {
	const ctxA = await newContext(browser);
	const ctxB = await newContext(browser);
	const ctxC = await newContext(browser);
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();
	const pageC = await ctxC.newPage();

	const space = await createLockedSpace(pageA, 'Bitrix locked', 's3cret');
	await connectBitrix(pageA, `/spaces/${space.slug}`);
	const board = await createBoardInSpace(pageA, space.slug, 'Sprint 1');
	await addCard(pageA, 'Went Well', 'Secret roadmap item');
	// id карточки — из скрытого поля преформы; саму преформу закрываем без отправки
	const formA = await openCardTaskModal(pageA, 'Secret roadmap item');
	const cardId = await formA.locator('input[name="cardId"]').inputValue();
	await pageA.keyboard.press('Escape');
	await expect(formA).toHaveCount(0);

	// B открыл admin-ссылку доски: cookie retro_creator_{slug} есть, retro_space_{slug} нет.
	// Пароль пространства закрывает и доску, поэтому содержимого не видно вовсе —
	// токен создателя доски сам по себе доступа не даёт
	await initStorage(pageB);
	await pageB.goto(board.adminUrl);
	await expect(pageB).toHaveURL(new RegExp(`/spaces/${space.slug}\\?next=${board.slug}$`));
	await expect(cardOnBoard(pageB, 'Secret roadmap item')).toHaveCount(0);

	const form = { cardId, title: 'Hijacked task', description: '', groupId: '', deadline: '', source: 'card' };
	for (const p of [pageB, pageC]) {
		const denied = await postAction(p, `/${board.slug}?/createTask`, form);
		expect(denied.result).toMatchObject({ type: 'failure', status: 403 });
		expect(actionData(denied.result).bitrixError).toBe('forbidden');
		const group = await p.request.get(`/${board.slug}/bitrix/group?id=42`);
		expect(group.status()).toBe(403);
		expect(await group.json()).toEqual({ bitrixError: 'forbidden' });
	}
	const calls = await bitrixCalls(pageA);
	expect(callsOf(calls, 'tasks.task.add')).toHaveLength(0);
	expect(callsOf(calls, 'sonet_group.get')).toHaveLength(0);

	// Пароль введён — форма возвращает B на ту доску, с которой он пришёл (?next=),
	// и он становится ведущим: токен создателя доски снова в деле, «В задачу» на месте
	await pageB.getByPlaceholder('Password').fill('s3cret');
	await pageB.getByRole('button', { name: 'Enter' }).click();
	await pageB.waitForURL(`**/${board.slug}`);
	const cardB = cardOnBoard(pageB, 'Secret roadmap item');
	await expect(cardB).toBeVisible();
	await expect(cardB.getByTestId('card-task-button')).toBeVisible();
	await pageB.getByRole('button', { name: 'Menu' }).click();
	await expect(pageB.getByRole('button', { name: 'Rename board' })).toBeVisible();
	await expect(pageB.getByTestId('menu-bitrix-connect')).toHaveCount(0);

	await ctxA.close();
	await ctxB.close();
	await ctxC.close();
});

test('12. пункт «Подключить Битрикс24» ведёт в открытую панель и пропадает после подключения; создатель доски его не видит', async ({ browser }) => {
	const ctxA = await newContext(browser);
	const ctxB = await newContext(browser);
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const space = await createSpace(pageA, 'Bitrix offer');

	// B создаёт свою доску в пространстве: создатель доски, но не пространства
	await initStorage(pageB);
	await createBoardInSpace(pageB, space.slug, 'Guest sprint');
	await pageB.getByRole('button', { name: 'Menu' }).click();
	await expect(pageB.getByRole('button', { name: 'Rename board' })).toBeVisible();
	await expect(pageB.getByTestId('menu-bitrix-connect')).toHaveCount(0);

	const board = await createBoardInSpace(pageA, space.slug, 'Sprint 1');
	await pageA.getByRole('button', { name: 'Menu' }).click();
	const item = pageA.getByTestId('menu-bitrix-connect');
	await expect(item).toContainText('Connect Bitrix24');
	await Promise.all([pageA.waitForURL(new RegExp(`/spaces/${space.slug}\\?bitrix=1$`)), item.click()]);

	await expect(pageA.getByTestId('bitrix-panel-toggle')).toHaveAttribute('aria-expanded', 'true');
	const panel = pageA.getByTestId('bitrix-panel');
	const webhook = panel.locator('input[name="webhook"]');
	await expect(webhook).toBeFocused();
	await webhook.fill(BITRIX_WEBHOOK);
	// Enter в поле = «Подключить»
	await webhook.press('Enter');
	await expect(panel.getByText('Ivan Petrov')).toBeVisible({ timeout: 10_000 });

	await pageA.goto(`/${board.slug}`);
	await pageA.getByRole('button', { name: 'Menu' }).click();
	await expect(pageA.getByRole('button', { name: 'Rename board' })).toBeVisible();
	await expect(pageA.getByTestId('menu-bitrix-connect')).toHaveCount(0);

	await ctxA.close();
	await ctxB.close();
});

test('13. проверка группы в преформе: чужой id — «не найдена», существующий — название; портал отказывает по чужой группе', async ({ page }) => {
	// Без группы по умолчанию: название известной группы показывается без запроса, а здесь нужен запрос
	const { board } = await seedBoard(page, 'Bitrix groups');
	await addCard(page, 'Went Well', 'Move CI to the new runners');
	const form = await openCardTaskModal(page, 'Move CI to the new runners');
	const dialog = page.getByRole('dialog');
	const group = form.locator('input[name="groupId"]');
	await expect(group).toHaveValue('');

	const groupCheck = (id: string) =>
		page.waitForResponse((r) => r.url().endsWith(`/${board.slug}/bitrix/group?id=${id}`));

	let checked = groupCheck('777');
	await group.fill('777');
	expect(await (await checked).json()).toEqual({ notFound: true });
	await expect(dialog.getByText(GROUP_NOT_FOUND)).toBeVisible();

	// Отправку не блокируем: портал сам отказывает по чужой группе, форма остаётся
	const submit = page.getByTestId('bitrix-task-submit');
	await submit.click();
	await expect
		.poll(async () => callsOf(await bitrixCalls(page), 'tasks.task.add').map((c) => c.status), { timeout: 15_000 })
		.toEqual([403]);
	await expect(submit).toBeEnabled();
	await expect(form).toBeVisible();
	await expect(dialog.getByText(GROUP_NOT_FOUND)).toBeVisible();
	await expect(cardOnBoard(page, 'Move CI to the new runners').getByTestId('task-badge')).toHaveCount(0);

	checked = groupCheck('42');
	await group.fill('42');
	expect(await (await checked).json()).toEqual({ name: 'Платформа' });
	await expect(dialog.getByText('Платформа')).toBeVisible();
	await expect(dialog.getByText(GROUP_NOT_FOUND)).toHaveCount(0);

	await submit.click();
	await expect(form).toHaveCount(0, { timeout: 15_000 });
	const calls = await bitrixCalls(page);
	const adds = callsOf(calls, 'tasks.task.add');
	expect(adds.map((c) => c.status)).toEqual([403, 200]);
	expect(adds[1].body.fields.groupId).toBe(42);
	// Правка формы меняет ключ идемпотентности
	expect(adds[1].headers['idempotency-key']).not.toBe(adds[0].headers['idempotency-key']);
	const taskId = adds[1].response.result.item.id as number;
	expect(adds[1].response.result.item.link).toBe(`/workgroups/group/42/tasks/task/view/${taskId}/`);
	const checkedIds = callsOf(calls, 'sonet_group.get').map((c) => String((c.body.FILTER ?? c.body.filter).ID));
	expect(checkedIds).toEqual(expect.arrayContaining(['777', '42']));
});

test('14. пространство удалено: бейдж на доске остаётся ссылкой в новой вкладке, кнопки и пункта меню нет', async ({ page }) => {
	const { space, board } = await seedBoard(page, 'Bitrix gone');
	await addCard(page, 'Went Well', 'Archive old boards');
	await addCard(page, 'Went Well', 'Label flaky tests');
	const task = await createTaskFrom(page, 'Archive old boards');

	await page.goto(`/spaces/${space.slug}`);
	// Кнопка удаления есть в SSR-разметке: клик до гидрации повторяем, пока не появится вопрос
	const question = page.getByText('Delete space?');
	await expect(async () => {
		if (!(await question.isVisible())) await page.getByRole('button', { name: 'Delete Space' }).click();
		await expect(question).toBeVisible({ timeout: 1_000 });
	}).toPass({ timeout: 10_000 });
	await Promise.all([
		page.waitForURL((u) => u.pathname === '/'),
		page.getByRole('button', { name: 'Delete Space' }).click()
	]);

	await page.goto(`/${board.slug}`);
	const badge = cardOnBoard(page, 'Archive old boards').getByTestId('task-badge');
	await expect(badge).toHaveAttribute('target', '_blank');
	await expect(badge).toHaveAttribute('href', taskUrl(task.link));
	await expect(cardOnBoard(page, 'Label flaky tests')).toBeVisible();
	await expect(page.getByTestId('card-task-button')).toHaveCount(0);
	await page.getByRole('button', { name: 'Menu' }).click();
	await expect(page.getByRole('button', { name: 'Rename board' })).toBeVisible();
	await expect(page.getByTestId('menu-bitrix-connect')).toHaveCount(0);
});

test('15. подделанная cookie доступа не открывает закрытое пространство и не даёт создать доску', async ({ browser }) => {
	const ctxA = await newContext(browser);
	const ctxB = await newContext(browser);
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	const space = await createLockedSpace(pageA, 'Bitrix forged', 's3cret');
	await initStorage(pageB);
	await ctxB.addCookies([{ name: `retro_space_${space.slug}`, value: 'x', url: APP }]);

	await pageB.goto(`/spaces/${space.slug}`);
	await expect(pageB.getByPlaceholder('Password')).toBeVisible();
	await expect(pageB.getByRole('button', { name: 'New board' })).toHaveCount(0);
	expect((await pageB.request.get(`/spaces/${space.slug}/analysis`)).status()).toBe(403);

	const created = await postAction(pageB, `/spaces/${space.slug}?/createBoard`, {
		title: 'Intruder board',
		locale: 'en',
		format: 'classic'
	});
	expect(created.result.type).not.toBe('redirect');
	const status = created.result.type === 'error' ? created.httpStatus : created.result.status;
	expect(status).toBe(403);

	await pageA.goto(`/spaces/${space.slug}`);
	await expect(pageA.getByRole('heading', { level: 1, name: 'Bitrix forged' })).toBeVisible();
	await expect(pageA.getByTestId('space-tile').filter({ hasText: 'Intruder board' })).toHaveCount(0);

	await ctxA.close();
	await ctxB.close();
});
