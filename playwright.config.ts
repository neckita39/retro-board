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
		trace: 'retain-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
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
			BODY_SIZE_LIMIT: '20971520'
		}
	}
});
