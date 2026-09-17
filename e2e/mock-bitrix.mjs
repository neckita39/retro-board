// Мок портала Битрикс24 для e2e: третий webServer в playwright.config.ts (порт 4779).
// Приложение ходит сюда по вебхуку http://localhost:4779/rest/1/testcode/ — его пропускает флаг BITRIX_ALLOW_HTTP=1.
// Ответы повторяют живой портал (bitrix24.team, 17.09.2026 — см. спеку):
//  - старый REST: POST /rest/{userId}/{code}/{method}; ошибка ядра — строка error + error_description;
//  - REST 3.0:    POST /rest/api/{userId}/{code}/{method}; ошибка — объект error { code, message, validation? }.
// Служебные адреса: POST /__mode, GET /__calls, POST /__reset, GET /health.
import { createServer } from 'http';

const PORT = Number(process.env.MOCK_PORT || 4779);
const CODE = 'testcode';
const OWNER = { NAME: 'Ivan', LAST_NAME: 'Petrov', TIME_ZONE: 'Europe/Kaliningrad' };
const STORAGE_ID = 11;
const ROOT_OBJECT_ID = 31;
// Рабочие группы портала. groupId не из списка в tasks.task.add — 403 ACCESSDENIEDEXCEPTION, как у живого портала
const GROUPS = { 42: 'Платформа' };
const MODES = ['ok', 'invalid_webhook', 'scope', 'disk_fail', 'error', 'delay'];
// Эти методы портал обслуживает только одним транспортом. Вызов не тем адресом — ERROR_METHOD_NOT_FOUND,
// чтобы e2e ловил перепутанный транспорт
const V3_ONLY = new Set(['tasks.task.add', 'tasks.task.field.list', 'tasks.task.file.attach']);
const LEGACY_ONLY = new Set(['profile', 'sonet_group.get', 'disk.storage.getlist', 'disk.storage.uploadfile']);
const PORTAL_PATH = /^\/rest\/(api\/)?(\d+)\/([^/]+)\/([^/]+)$/;
const DEADLINE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
const VALIDATION = 'BITRIX_REST_V3_EXCEPTION_VALIDATION_DTOVALIDATIONEXCEPTION';

let mode = 'ok';
let delayMs = 0;
let calls = [];
const tasks = new Map(); // id задачи → { tags }
const diskObjects = new Map(); // ID объекта Диска → NAME
const idempotent = new Map(); // Idempotency-Key → { body, payload }
// Счётчики не сбрасываются: id задач и файлов уникальны на весь прогон.
// ID объекта Диска и FILE_ID живут в разных диапазонах — перепутать их незаметно нельзя
let taskSeq = 1000;
let objectSeq = 500;
let fileSeq = 9000;

function reset() {
	mode = 'ok';
	delayMs = 0;
	calls = [];
	tasks.clear();
	diskObjects.clear();
	idempotent.clear();
}

function readBody(req) {
	return new Promise((resolve) => {
		let data = '';
		req.on('data', (chunk) => (data += chunk));
		req.on('end', () => resolve(data));
	});
}

function send(res, status, payload, headers = {}) {
	res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers }).end(JSON.stringify(payload));
}

// Блок time как у портала; date_finish несёт смещение сервера портала (Калининград, +02:00)
function portalTime() {
	const now = Date.now();
	const local = new Date(now + 2 * 3_600_000).toISOString().slice(0, 19) + '+02:00';
	return {
		start: now / 1000,
		finish: now / 1000,
		duration: 0.01,
		processing: 0.005,
		date_start: local,
		date_finish: local,
		operating_reset_at: Math.floor(now / 1000) + 600,
		operating: 0
	};
}

const ok = (result, extra = {}) => ({ status: 200, payload: { result, ...extra, time: portalTime() } });
const coreError = (status, code, description) => ({ status, payload: { error: code, error_description: description } });
const v3Error = (status, code, message, validation) => ({
	status,
	payload: { error: validation ? { code, message, validation } : { code, message } }
});
const insufficientScope = () =>
	coreError(401, 'insufficient_scope', 'The request requires higher privileges than provided by the webhook token');

function portal(method, api, userId, body, headers) {
	if (mode === 'invalid_webhook') return coreError(401, 'INVALID_CREDENTIALS', 'Invalid request credentials');
	if (mode === 'error') return coreError(503, 'QUERY_LIMIT_EXCEEDED', 'Too many requests');
	if ((api && LEGACY_ONLY.has(method)) || (!api && V3_ONLY.has(method))) {
		return coreError(404, 'ERROR_METHOD_NOT_FOUND', 'Method not found!');
	}
	if (mode === 'scope' && method.startsWith('tasks.')) return insufficientScope();
	if (mode === 'disk_fail' && method.startsWith('disk.')) return insufficientScope();

	switch (method) {
		case 'profile':
			return ok({
				ID: String(userId),
				ADMIN: true,
				NAME: OWNER.NAME,
				LAST_NAME: OWNER.LAST_NAME,
				PERSONAL_GENDER: '',
				TIME_ZONE: OWNER.TIME_ZONE
			});

		case 'tasks.task.field.list':
			return ok({
				items: ['id', 'title', 'description', 'creatorId', 'responsibleId', 'groupId', 'deadline', 'priority', 'tags'].map(
					(name) => ({ name })
				)
			});

		case 'sonet_group.get': {
			const filter = body.FILTER ?? body.filter ?? {};
			const ids = filter.ID === undefined ? Object.keys(GROUPS) : [].concat(filter.ID).map(String);
			const items = ids
				.filter((id) => GROUPS[id])
				.map((id) => ({ ID: id, SITE_ID: 's1', NAME: GROUPS[id], DESCRIPTION: '', ACTIVE: 'Y', VISIBLE: 'Y', OPENED: 'N', PROJECT: 'N' }));
			return ok(items, { total: items.length });
		}

		case 'tasks.task.add': {
			const key = headers['idempotency-key'];
			const raw = JSON.stringify(body);
			// Повтор с тем же ключом: тот же ответ без дубля; тот же ключ с другим телом — 422
			if (key && idempotent.has(key)) {
				const saved = idempotent.get(key);
				if (saved.body !== raw) {
					return v3Error(422, 'BITRIX_REST_V3_EXCEPTION_IDEMPOTENCYKEYMISMATCHEXCEPTION', 'Ключ идемпотентности уже использован с другим запросом');
				}
				return { status: 200, payload: saved.payload, headers: { 'Idempotent-Replayed': 'true' } };
			}
			const fields = body.fields;
			if (!fields || typeof fields !== 'object') {
				return v3Error(400, VALIDATION, 'Ошибка валидации', [{ field: 'fields', message: 'Обязательное поле' }]);
			}
			// Живой портал: «Поле "tags" не доступно к заполнению» — тег ставится только старым REST
			if ('tags' in fields) return v3Error(400, VALIDATION, 'Поле "tags" не доступно к заполнению');
			if (typeof fields.title !== 'string' || !fields.title.trim()) {
				return v3Error(400, VALIDATION, 'Ошибка валидации', [{ field: 'title', message: 'Обязательное поле' }]);
			}
			if (fields.deadline != null && !DEADLINE_RE.test(String(fields.deadline))) {
				return v3Error(400, VALIDATION, 'Ошибка валидации', [{ field: 'deadline', message: 'Нужна дата ISO 8601 со смещением' }]);
			}
			if (fields.priority != null && !['high', 'average', 'low'].includes(fields.priority)) {
				return v3Error(400, VALIDATION, 'Ошибка валидации', [{ field: 'priority', message: 'Недопустимое значение' }]);
			}
			const groupId = fields.groupId == null ? 0 : Number(fields.groupId);
			if (fields.groupId != null && !GROUPS[groupId]) {
				return v3Error(403, 'BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION', 'Доступ запрещен');
			}
			const id = ++taskSeq;
			const link = groupId
				? `/workgroups/group/${groupId}/tasks/task/view/${id}/`
				: `/company/personal/user/${userId}/tasks/task/view/${id}/`;
			tasks.set(id, { tags: [] });
			const { payload } = ok({
				item: {
					id,
					title: fields.title,
					description: fields.description ?? '',
					creatorId: Number(fields.creatorId ?? userId),
					responsibleId: Number(fields.responsibleId ?? userId),
					groupId,
					deadline: fields.deadline ?? null,
					priority: fields.priority ?? 'average',
					link
				}
			});
			if (key) idempotent.set(key, { body: raw, payload });
			return { status: 200, payload };
		}

		case 'tasks.task.update': {
			// REST 3.0 тег не принимает ни в add, ни в update; e2e зовёт update только ради тега
			if (api) return v3Error(400, VALIDATION, 'Поле "tags" не доступно к заполнению');
			const task = tasks.get(Number(body.taskId));
			if (!task) return coreError(400, 'ERROR_CORE', 'Задача не найдена или у вас нет прав на её просмотр');
			if (body.fields?.TAGS !== undefined) task.tags = [].concat(body.fields.TAGS).map(String);
			return ok({ task: { id: String(body.taskId), tags: task.tags } });
		}

		case 'disk.storage.getlist': {
			const filter = body.filter ?? body.FILTER ?? {};
			const own = String(filter.ENTITY_TYPE) === 'user' && String(filter.ENTITY_ID) === String(userId);
			const items = own
				? [{
						ID: String(STORAGE_ID),
						NAME: `${OWNER.NAME} ${OWNER.LAST_NAME}`,
						CODE: null,
						MODULE_ID: 'disk',
						ENTITY_TYPE: 'user',
						ENTITY_ID: String(userId),
						ROOT_OBJECT_ID: String(ROOT_OBJECT_ID)
					}]
				: [];
			return ok(items, { total: items.length });
		}

		case 'disk.storage.uploadfile': {
			if (String(body.id) !== String(STORAGE_ID)) return coreError(400, 'ERROR_NOT_FOUND', `Could not find entity with id '${body.id}'`);
			const name = body.data?.NAME;
			if (typeof name !== 'string' || !name) return coreError(400, 'DISK_BASE_SERVICE_22001', 'Error: required parameter NAME');
			const content = body.fileContent;
			const bytes = Array.isArray(content) && typeof content[1] === 'string' ? Buffer.from(content[1], 'base64') : Buffer.alloc(0);
			if (bytes.length === 0) return coreError(400, 'ERROR_ARGUMENT', 'Invalid value of parameter fileContent');
			const taken = new Set(diskObjects.values());
			let finalName = name;
			if (taken.has(name)) {
				if (body.generateUniqueName !== true) {
					return coreError(400, 'DISK_OBJ_22000', 'Не удалось сохранить файл: объект с таким именем уже существует');
				}
				const dot = name.lastIndexOf('.');
				for (let n = 1; taken.has(finalName); n++) {
					finalName = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
				}
			}
			const ID = ++objectSeq;
			const FILE_ID = ++fileSeq;
			diskObjects.set(ID, finalName);
			const stamp = portalTime().date_finish;
			return ok({
				ID,
				NAME: finalName,
				CODE: null,
				STORAGE_ID,
				TYPE: 'file',
				PARENT_ID: ROOT_OBJECT_ID,
				DELETED_TYPE: 0,
				GLOBAL_CONTENT_VERSION: 1,
				FILE_ID,
				SIZE: bytes.length,
				CREATE_TIME: stamp,
				UPDATE_TIME: stamp,
				DELETE_TIME: null,
				CREATED_BY: userId,
				UPDATED_BY: userId,
				DELETED_BY: 0,
				DOWNLOAD_URL: `http://localhost:${PORT}/disk/download/${ID}/`,
				DETAIL_URL: `http://localhost:${PORT}/company/personal/user/${userId}/disk/file/${encodeURIComponent(finalName)}`
			});
		}

		case 'tasks.task.file.attach': {
			if (!tasks.has(Number(body.taskId))) return v3Error(404, 'BITRIX_REST_V3_EXCEPTION_ENTITYNOTFOUNDEXCEPTION', 'Задача не найдена');
			const ids = Array.isArray(body.fileIds) ? body.fileIds : [];
			// Только ID объекта Диска; FILE_ID из uploadFile — «Не удалось найти файл», как у живого портала
			if (ids.length === 0 || ids.some((id) => !diskObjects.has(Number(id)))) {
				return v3Error(400, VALIDATION, 'Не удалось найти файл');
			}
			return ok({ result: true });
		}

		default:
			return coreError(404, 'ERROR_METHOD_NOT_FOUND', 'Method not found!');
	}
}

createServer(async (req, res) => {
	try {
		const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
		if (req.method === 'GET' && pathname === '/health') {
			res.writeHead(200).end('ok');
			return;
		}
		if (req.method === 'POST' && pathname === '/__mode') {
			let body = {};
			try {
				body = JSON.parse((await readBody(req)) || '{}');
			} catch {
				body = {};
			}
			if (!MODES.includes(body.mode)) {
				send(res, 400, { error: `mode must be one of: ${MODES.join(', ')}` });
				return;
			}
			mode = body.mode;
			delayMs = Number(body.delayMs) || (mode === 'delay' ? 2000 : 0);
			send(res, 200, { mode, delayMs });
			return;
		}
		if (req.method === 'GET' && pathname === '/__calls') {
			send(res, 200, calls);
			return;
		}
		if (req.method === 'POST' && pathname === '/__reset') {
			reset();
			send(res, 200, { ok: true });
			return;
		}

		const match = pathname.match(PORTAL_PATH);
		if (!match) {
			res.writeHead(404).end();
			return;
		}
		const [, apiSegment, userIdRaw, code, methodRaw] = match;
		const raw = await readBody(req);
		let body = {};
		let badJson = false;
		if (raw) {
			try {
				body = JSON.parse(raw);
			} catch {
				badJson = true;
			}
		}
		// Вызов записываем до проверок: тесту видны и отклонённые запросы
		const call = {
			method: methodRaw.toLowerCase(),
			api: Boolean(apiSegment),
			userId: Number(userIdRaw),
			body: badJson ? raw : body,
			headers: req.headers,
			status: 0,
			response: null
		};
		calls.push(call);
		if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));

		let out;
		if (req.method !== 'POST') out = coreError(405, 'INVALID_REQUEST', 'POST expected');
		else if (!String(req.headers['content-type'] ?? '').includes('application/json') || badJson || !body || typeof body !== 'object') {
			out = coreError(400, 'INVALID_REQUEST', 'JSON body expected');
		} else if (code !== CODE) out = coreError(401, 'INVALID_CREDENTIALS', 'Invalid request credentials');
		else out = portal(call.method, call.api, call.userId, body, req.headers);

		call.status = out.status;
		call.response = out.payload;
		send(res, out.status, out.payload, out.headers);
	} catch (err) {
		res.writeHead(500, { 'content-type': 'text/plain' }).end(String(err));
	}
}).listen(PORT, () => console.log(`mock bitrix24 on ${PORT}`));
