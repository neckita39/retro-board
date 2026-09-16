// Мок DeepSeek для e2e: детерминированный ответ, переключаемый режим ошибки.
// Поднимается Playwright'ом вторым webServer, приложение ходит сюда через DEEPSEEK_API_BASE.
import { createServer } from 'http';

const PORT = Number(process.env.MOCK_PORT || 4778);
let mode = 'ok';
// Задержка ответа — чтобы в e2e было видно состояние «идёт»
let delayMs = 0;

const ANSWER = {
	well: [{ text: 'Deploys keep going smoothly', boards: 2 }],
	bad: [{ text: 'Flaky tests block merges again', boards: 3 }],
	improve: [{ text: 'Write down decisions after each retro', boards: 2 }]
};

function readBody(req) {
	return new Promise((resolve) => {
		let data = '';
		req.on('data', (chunk) => (data += chunk));
		req.on('end', () => resolve(data));
	});
}

createServer(async (req, res) => {
	if (req.method === 'GET' && req.url === '/health') {
		res.writeHead(200).end('ok');
		return;
	}
	if (req.method === 'POST' && req.url === '/__mode') {
		const body = JSON.parse((await readBody(req)) || '{}');
		mode = body.mode === 'error' ? 'error' : 'ok';
		delayMs = Number(body.delayMs) || 0;
		res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ mode, delayMs }));
		return;
	}
	if (req.method === 'POST' && req.url === '/chat/completions') {
		await readBody(req);
		if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
		if (mode === 'error') {
			res.writeHead(500, { 'content-type': 'application/json' }).end('{"error":"mock failure"}');
			return;
		}
		res.writeHead(200, { 'content-type': 'application/json' }).end(
			JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify(ANSWER) } }] })
		);
		return;
	}
	res.writeHead(404).end();
}).listen(PORT, () => console.log(`mock deepseek on ${PORT}`));
