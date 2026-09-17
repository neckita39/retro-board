import { defineConfig, devices } from '@playwright/test';

const PORT = 4777;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: 'e2e',
	// Один воркер: общий сервер + realtime-тесты чувствительны к параллельной нагрузке
	workers: 1,
	fullyParallel: false,
	timeout: 30_000,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: BASE_URL,
		trace: 'retain-on-failure',
		// Сервер берёт IP клиента из этого заголовка (ADDRESS_HEADER ниже). Лимиты Битрикс24 считаются
		// по IP, и bitrix.spec.ts выдаёт каждому тесту свой адрес; остальным тестам хватает одного
		extraHTTPHeaders: { 'x-forwarded-for': '127.0.0.1' }
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			// Мок DeepSeek: приложение ходит в него через DEEPSEEK_API_BASE
			command: 'node e2e/mock-deepseek.mjs',
			url: 'http://localhost:4778/health',
			reuseExistingServer: !process.env.CI,
			timeout: 15_000
		},
		{
			// Мок портала Битрикс24: тесты подключают вебхук http://localhost:4779/rest/1/testcode/
			command: 'node e2e/mock-bitrix.mjs',
			url: 'http://localhost:4779/health',
			reuseExistingServer: !process.env.CI,
			timeout: 15_000
		},
		{
			// Сборка происходит ДО запуска тестов (npm run test:e2e / отдельный шаг CI),
			// чтобы таймаут webServer не зависел от времени сборки
			command: 'node migrate.js && node server.js',
			url: `${BASE_URL}/health`,
			reuseExistingServer: !process.env.CI,
			timeout: 60_000,
			env: {
				DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://retro:retro@localhost:5433/retro',
				PORT: String(PORT),
				ORIGIN: BASE_URL,
				BODY_SIZE_LIMIT: '20971520',
				// Как в проде: карточки шифруются, и доска-анализ (пишет SvelteKit) должна читаться сокет-сервером.
				// Без ключа подключение Битрикс24 недоступно (encryptionEnabled)
				ENCRYPTION_KEY: '0123456789abcdef'.repeat(4),
				DEEPSEEK_API_KEY: 'test-key',
				DEEPSEEK_API_BASE: 'http://localhost:4778',
				// Вебхук мока — http://localhost: без флага parseWebhookUrl его отклонит. Только для e2e
				BITRIX_ALLOW_HTTP: '1',
				// adapter-node: getClientAddress() читает x-forwarded-for. Без заголовка маршрут с лимитом
				// упадёт, поэтому заголовок выставлен всем контекстам через use.extraHTTPHeaders
				ADDRESS_HEADER: 'x-forwarded-for'
			}
		}
	]
});
