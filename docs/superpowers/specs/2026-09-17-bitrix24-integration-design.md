# Интеграция с Битрикс24: карточка → задача

Дата: 2026-09-17. Статус: дизайн утверждён, ревью спеки пройдено (5 линз, 38 подтверждённых замечаний внесены), факты проверены на живом портале. Визуал — макет «Bitrix24 - карточка в задачу.dc.html» в Claude Design (проект `0f8b7992-02cf-4764-a677-e052071471d3`), его заметки 1–31 сведены в Секции 5; расхождения макета со спекой разрешены там же.

## Контекст

Ретро заканчивается списком действий, а действия живут в трекере команды. Нужно превращать карточку ретро-доски в задачу Битрикс24 прямо с доски: через входящий вебхук, который пользователь один раз привязывает к пространству. Аналог уже есть у автора проекта в виде личного скилла `to-task` (вебхук `bitrix24.team`, задачи в группу 2014 одним `GROUP_ID`) — им подтверждено, что `groupId` без дополнительных вызовов кладёт задачу туда, куда надо.

## Продуктовые решения

1. **Вебхук привязан к пространству**, одна строка на пространство. Вводит, меняет и удаляет только создатель пространства (cookie `retro_space_creator_{slug}`). Хранится зашифрованно; после сохранения код больше не показывается, только хост портала и имя владельца.
2. **Ответственный и постановщик = владелец вебхука.** В форме не выбираются, только показываются.
3. **Группа / скрам** — необязательный числовой id. По умолчанию из настроек пространства, в преформе задачи можно поменять или очистить.
4. **«В задачу» видят только создатель доски и создатель пространства.** Создатель пространства и так считается создателем каждой его доски.
5. **Одна задача на карточку.** Карточка хранит id и ссылку; бейдж-ссылку видят все участники сразу (сокет), она попадает в экспорт и Summary. У карточки с задачей кнопки больше нет.
6. **Преформа**: название, описание, группа, срок (по умолчанию пусто), переключатель «важная задача». Тег `retro` ставится автоматически отдельным вызовом после создания, в форме его нет.
7. **Предзаполнение**: название = первая непустая строка карточки; описание = текст карточки, строка «Из ретро «Доска» · колонка «…»», ссылка на доску, автор и голоса, комментарии списком. Всё в одном редактируемом поле: что в поле, то и уходит. Картинка карточки прикрепляется файлом (индикатор в форме, не поле).
8. **Работает на обычных досках и на досках-анализах.** На досках вне пространства кнопки, пункта меню и преформы нет; уже созданные бейджи остаются.
9. **Две точки входа**: карточка на доске и сфокусированная строка Summary в режиме обсуждения.
10. **Ссылка на доску в описании** — осознанно принятый риск: доска защищена только неугадываемой ссылкой, и её увидит каждый, кто видит задачу в портале.

## Факты о Bitrix24 REST, на которых стоит дизайн

- Задачи создаём через **REST 3.0**: `POST https://{портал}/rest/api/{userId}/{code}/tasks.task.add`, только JSON, `Content-Type: application/json`. Без сегмента `/api/` портал выполняет старый метод.
- Ответ v3 единого вида `{ result: { item: {...} }, time }`. У задачи в `item` есть `id` (число) и **`link`** — путь к задаче; ссылку не строим сами, а приклеиваем хост.
- Поля v3: `title`, `description`, `creatorId`, `responsibleId`, `groupId`, `deadline` в ISO-8601 со смещением (`2025-12-31T23:59:59+03:00`), `priority` строкой `high | average | low`.
- Файлы: `tasks.task.file.attach` (v3) принимает `taskId` и `fileIds` — id объектов Диска. Методы Диска в v3 не переведены: `disk.storage.getlist`, `disk.storage.uploadFile` живут только по старому адресу `/rest/{userId}/{code}/`. Там же `profile`, `sonet_group.get` и `tasks.task.update` для тега.
- `profile` (старый REST) работает **без прав** и возвращает `ID`, `NAME`, `LAST_NAME`, `TIME_ZONE`; пустой объект — пользователь неактивен. `TIME_ZONE` — идентификатор IANA (например `Europe/Moscow`) или пустая строка, если пояс не задан (документация `profile.html`, «Объект result»). Это не смещение: смещение считаем сами на дату дедлайна. В `time.date_finish` того же ответа есть смещение сервера портала (`+03:00`) — резерв на случай пустой зоны.
- Права вебхука (таблица скоупов): «Задачи» (`task`; `tasks` в документации v3 — то же самое, пользователю называем только галочку), «Диск» (`disk`) для картинки, «Рабочие группы соцсети» (`sonet_group`) для проверки группы и её названия. В интерфейсе портала галочка называется именно «Рабочие группы соцсети».
- Ошибки v3 приходят объектом `error: { code, message, validation?: [{ field, message }] }` с кодами `BITRIX_REST_V3_EXCEPTION_*` и статусом 4xx. Системные ошибки ядра (`INVALID_CREDENTIALS`, `insufficient_scope`, `QUERY_LIMIT_EXCEEDED`, …) приходят строкой `error` + `error_description`. Клиент обязан понимать оба вида; ошибку определяем по наличию ключа `error`, а не по статусу.
- Заголовок **`Idempotency-Key`** (только v3): успешный ответ хранится 24 часа, повтор с тем же ключом и телом возвращает его без дубля и с заголовком `Idempotent-Replayed: true`. Ключ уникален в пределах вебхука, пользователя и метода; при том же ключе и другом теле — 422.
- Лимит интенсивности (leaky bucket) считается на портал и на IP источника: наш сервер делит корзину с любыми другими интеграциями, которые ходят в тот же портал с того же IP. Не Enterprise — 2 запроса/с при корзине 50, Enterprise — 5/с и 250; превышение — `QUERY_LIMIT_EXCEEDED` (HTTP 503). Отдельно лимит ресурсоёмкости: `OPERATION_TIME_LIMIT` (HTTP 429) блокирует метод для этого вебхука до `time.operating_reset_at`. Одно создание задачи — не больше пяти вызовов, в корзину 50 укладывается всегда; автоповтора нет.
- `OVERLOAD_LIMIT` (401) — ручная блокировка портала, снимается только поддержкой; `PORTAL_DELETED` (403) — закрыта публичная часть сайта. Повтор и переподключение не помогают.

### Проверено на живом портале (bitrix24.team, 17.09.2026)

Тестовые задачи и файлы созданы и удалены через вебхук автора. Результаты — факты, на них стоит Секция 2:

- **Тег через v3 не ставится.** `tags` есть в `tasks.task.field.list`, но `tasks.task.add` и `tasks.task.update` v3 с `tags: [{ name }]` отвечают 400 `BITRIX_REST_V3_EXCEPTION_VALIDATION_DTOVALIDATIONEXCEPTION` «Поле "tags" не доступно к заполнению», а со строками — 500. **Работает старый REST**: `tasks.task.update { taskId, fields: { TAGS: ['retro'] } }` после создания; v3 `tasks.task.get` затем показывает `tags: [{ id, name: 'retro' }]`. Значит тег — отдельный best-effort вызов после `tasks.task.add`.
- **Несуществующая `groupId`** → 403 `BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION` «Доступ запрещен». При выставленной группе этот код трактуем как `group`, а не `access`.
- **`link` в ответе `tasks.task.add`** учитывает группу: `/workgroups/group/2014/tasks/task/view/745181/`; тот же таск через `tasks.task.get` отдаёт личный `/company/personal/user/…/`. Берём из ответа `add`.
- **`Idempotency-Key`** работает: повтор вернул тот же id и заголовок `Idempotent-Replayed: true`.
- **Переносы строк и bare-URL** в `description` сохраняются как есть.
- **`profile.TIME_ZONE`** пришёл как `Europe/Kaliningrad`.
- **Файлы**: `disk.storage.getlist { filter: { ENTITY_TYPE: 'user', ENTITY_ID } }` находит личный Диск (`ID`, `ROOT_OBJECT_ID`); `disk.storage.uploadFile { id, data: { NAME }, fileContent: [NAME, base64], generateUniqueName: true }` отдаёт `ID` (объект Диска) и `FILE_ID` (внутренний, другое число); `tasks.task.file.attach { taskId, fileIds: [ID объекта] }` → `true`, и старый `tasks.task.get` показывает вложение в `ufTaskWebdavFiles`. С `FILE_ID` и с `fileIds` внутри `tasks.task.add` — «Не удалось найти файл». v3 `tasks.task.get` поле `fileIds` не заполняет — на проверку вложения не полагаемся.
- У вебхука автора нет права «Рабочие группы соцсети»: `sonet_group.get` → 401 `insufficient_scope`. Сценарий «id без названия» — не гипотетический.

## Архитектура в одном абзаце

Вся логика интеграции в SvelteKit: клиент Bitrix в `src/lib/server/bitrix.ts`, три экшена на маршруте пространства, один экшен и один JSON-эндпоинт на маршруте доски. `server.js` получает две колонки в копии схемы `cards`, одну в копии `spaces`, ретранслятор шины в комнату доски и одно событие-счётчик. Результат хранится в двух колонках `cards`, состояние подключения — в таблице `space_bitrix`. Остальные участники узнают о задаче событием `card:task` через шину `globalThis.__retroBus` → комната доски. Преформа заполняется на клиенте чистым модулем, сервер принимает готовые поля и только валидирует.

Отвергнутые варианты: обработчик в `server.js` (логика интеграции в двух кодовых базах, у сокетов нет соглашения об ошибках); только комната пространства без канала доски (гость по ссылке без пароля пространства увидел бы бейдж лишь после перезагрузки).

---

## Секция 1 — Данные и миграция

Одна миграция `drizzle/0008_bitrix.sql` (формат как `0006_space_analyses.sql`, разделитель `--> statement-breakpoint`; применяет `migrate.js` по имени файла). Три изменения.

### Таблица `space_bitrix`

| Колонка | Тип | Заметка |
|---|---|---|
| `space_id` | uuid PK → `spaces.id` ON DELETE CASCADE | ровно одна строка на пространство |
| `webhook_enc` | text NOT NULL | шифротекст полного адреса `https://host/rest/{userId}/{code}/` |
| `portal` | text NOT NULL | хост, например `bitrix24.team` |
| `user_id` | integer NOT NULL | владелец, из `profile.ID` |
| `user_name` | text NOT NULL | «Имя Фамилия», из `profile` |
| `time_zone` | text NULL | IANA-идентификатор из `profile.TIME_ZONE`; NULL, если пустая строка |
| `portal_offset` | text NULL | смещение из `time.date_finish` ответа `profile` при подключении, например `+03:00` |
| `group_id` | integer NULL | группа по умолчанию |
| `group_name` | text NULL | из `sonet_group.get`; NULL, если права нет |
| `connected_at` | timestamptz NOT NULL DEFAULT now() | |
| `last_error` | text NULL | вид последней ошибки портала (`invalid_webhook` / `scope` / `access`), пишут только экшены на пути `fail`; успешный экшен стирает |

Хост и id владельца не секрет — они есть в адресе каждой созданной задачи. Секрет только код, он живёт лишь внутри шифротекста.

### Колонки на `cards`

`bitrix_task_id integer NULL`, `bitrix_task_url text NULL`. Ссылку считаем один раз при создании (`https://{portal}{item.link}`) и храним готовой. Обратной синхронизации с порталом нет: удалили задачу в Битриксе — бейдж останется ссылкой в никуда, это осознанно.

Удаление пространства: `space_bitrix` уходит каскадом, доски остаются без пространства (`boards.space_id` SET NULL) — кнопки и пункта меню больше нет, `bitrix_task_*`, бейджи и `task` в экспорте остаются, как после `bitrixDisconnect`.

### Колонка `spaces.access_token` (предпосылка для прав)

Сейчас cookie доступа к закрытому пространству `retro_space_{slug}` — константа `authenticated`, и `canViewSpace` проверяет лишь её наличие: гость с ссылкой на закрытое пространство подделывает cookie, создаёт доску, становится её создателем и получает право писать задачи в чужой портал. Поэтому в этой же миграции: `spaces.access_token text NOT NULL` с бэкфиллом `gen_random_uuid()::text`. `enablePassword` выдаёт новый `nanoid(32)` (старые cookie перестают работать сами), `verify` и `?admin=` кладут в cookie `space.access_token`, `canViewSpace` и `server.js` `space:join` сравнивают значение cookie с колонкой, а не проверяют непустоту; `createBoard` переходит на `canViewSpace`. Тот же паттерн, что у `creator_token`: случайный токен и простое равенство в обеих кодовых базах.

### Дубли схемы

- `src/lib/server/db/schema.ts`: `spaceBitrix`, две колонки в `cards`, `accessToken` в `spaces`. `db/index.ts` регистрирует модуль целиком, ничего больше не нужно.
- `server.js` (копии `cards` и `spaces`): те же колонки. `decryptCard` разворачивает строку целиком (`{ ...card }`), поэтому `board:state`, `card:created`, `card:updated` понесут поля задачи без правки обработчиков. Таблицу `space_bitrix` в `server.js` не дублируем — он её не читает.
- Клиентский тип `Card` (`src/lib/types.ts`): `bitrixTaskId: number | null`, `bitrixTaskUrl: string | null`.

### Что отдают load()

- Страница пространства (`spaces/[slug]/+page.server.ts`), только создателю: `bitrix: { portal, userName, groupId, groupName, lastError } | null` и `encryptionEnabled: boolean`. Не-создателю ничего. Панель рендерится из `data.bitrix`; после успешного экшена `use:enhance` по умолчанию делает `invalidateAll()`, и load перечитывает строку.
- Страница доски (`[slug]/+page.server.ts`): всем — карточки с двумя новыми полями. `bitrix: { spaceSlug, userName, groupId, groupName } | null` для преформы — при `isCreator && spaceViewable` и наличии строки; `bitrixOffer: true` для пункта меню — только при `spaceCreator && spaceViewable` и отсутствии строки (обычный создатель доски подключить ничего не может, ему пункт не показываем). Строка пространства уже загружается на этом маршруте, лишнего запроса нет.

### Экспорт

`src/lib/server/export.ts`: у карточки `task: { id, url } | null` в JSON; в Markdown под карточкой строка со ссылкой (ключ `apiExport.task`). API пространства (`space-export.ts`) использует ту же сборку и наследует поле. Экспорт не читает пространство, поэтому доска, оставшаяся без пространства, экспортируется так же.

---

## Секция 2 — Клиент Bitrix и ошибки

Модуль `src/lib/server/bitrix.ts` по образцу `deepseek.ts`: `fetch` с `AbortController`, подменяемый `fetchFn` для vitest, типизированная ошибка, секрет никогда не попадает в сообщения, логи и метрики (в логах только хост, метод, код и статус).

### Адрес вебхука

`parseWebhookUrl(raw, { allowHttp })` → `{ url, portal, userId }` или `null`. Принимает только `https://{host}/rest/{цифры}/{код}/` (код — `[A-Za-z0-9]+`), нормализует хост в нижний регистр и завершающий слэш; query, fragment и любые лишние сегменты — отказ. При `allowHttp` (флаг окружения `BITRIX_ALLOW_HTTP=1`, ставится только в `playwright.config.ts`) дополнительно принимает `http://localhost:{port}/...`.

Защита от SSRF (наш сервер шлёт POST по адресу, который ввёл пользователь):
- только https;
- хост проверяем по `new URL(raw).hostname` после парсинга (числовые формы IPv4 вроде `2130706433`, `0x7f000001`, `127.1` парсер уже сводит к `127.0.0.1`): отклоняем `localhost`, хосты без точки (`db`, `netdata`, `app`), `*.local`, IPv4 из 0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16, IPv6 `::`, `::1`, `fc00::/7`, `fe80::/10`, а также `::ffff:`-mapped адреса (парсер отдаёт их в hex, `[::ffff:7f00:1]` — разбираем последние 32 бита как IPv4). DNS не резолвим: https с проверкой сертификата делает подмену DNS на приватный адрес бесполезной;
- все `fetch` идут с `redirect: 'manual'`: любой 3xx — ошибка `invalid_webhook` («портал переехал или вебхук изменился — подключите заново»), потому что следование редиректу, в том числе https → http, — единственный путь к внутренним сервисам без TLS;
- тело ответа читается как JSON с потолком 1 МБ; клиенту уходит только вид ошибки и обрезанное сообщение портала. Флаг `BITRIX_ALLOW_HTTP` снимает первые два ограничения только в e2e.

### Транспорт

- `callLegacy(webhook, method, params)` — `POST {url}{method}`, JSON-тело.
- `callV3(webhook, method, params, { idempotencyKey? })` — `POST {url с /rest/api/}{method}`, JSON-тело, заголовок `Idempotency-Key` если передан.
- Таймаут 15 с на вызов, 30 с на загрузку файла.
- Ответ нормализуется: `error` строкой → `{ code: error, message: error_description }`; `error` объектом → `{ code, message, validation }`. Успех v3 — `result.item` / `result.items` / `result.result`; успех старого REST — `result` как есть.

### Функции

| Функция | Вызовы | Возвращает |
|---|---|---|
| `verifyWebhook(url)` | `profile` (старый) | `{ userId, userName, timeZone, portalOffset }`; пустой объект → `invalid_webhook`; `portalOffset` из `time.date_finish` |
| `checkTasksScope(url)` | `tasks.task.field.list` (v3) | ok / `scope`; 404 `ERROR_METHOD_NOT_FOUND` на v3-адресе тоже `scope` (нет права или портал без REST 3.0) |
| `resolveGroup(url, groupId)` | `sonet_group.get { FILTER: { ID } }` (старый) | `{ name }` / `notFound` (пустой массив) / `noScope` |
| `createTask(url, fields, key)` | `tasks.task.add` (v3) с `Idempotency-Key` | `{ id, url }`; `item.id` — целое > 0, `item.link` — строка, начинающаяся с одного `/` (не `//`), иначе `shape`; `url = https://{portal}` + `item.link` только после этой проверки |
| `tagTask(url, taskId)` | `tasks.task.update { taskId, fields: { TAGS: ['retro'] } }` (старый) | ok или `BitrixError`; best-effort |
| `attachImage(url, userId, taskId, image)` | `disk.storage.getlist { filter: { ENTITY_TYPE: 'user', ENTITY_ID: userId } }` (пустой массив → `shape`) → `disk.storage.uploadFile { id: storage.ID, data: { NAME }, fileContent: [NAME, base64], generateUniqueName: true }` → `tasks.task.file.attach { taskId, fileIds: [result.ID] }` (v3) | ok или `BitrixError`; best-effort. Имя файла `retro-{cardId}.{ext}`, `ext` по `images.mime_type` (`image/webp` → `webp`, `image/gif` → `gif`); файл ложится в корень личного Диска владельца |

Память при загрузке файла: сначала `SELECT octet_length(data) FROM images WHERE id = ?` без чтения байтов; больше `BITRIX_IMAGE_MAX_BYTES` (по умолчанию 4 МБ; анимированный GIF после Sharp может весить до 20 МБ) — картинку не прикрепляем, `imageAttached: false`, метрика `retro.bitrix.task.image_skipped`. В процессе одновременно идёт не больше одной загрузки: модульный семафор в `bitrix.ts` захватывается до чтения байтов, base64 и `JSON.stringify`; 30-секундный таймаут считается с постановки в очередь. Причина: контейнер живёт с `--max-old-space-size=256` в `mem_limit: 384m`, один attach стоит примерно тройной размер файла в куче.

### Поля `tasks.task.add`

`title` (обрезано до 250), `description` (как пришло из преформы, до 20 000), `responsibleId` и `creatorId` равны `user_id` и выставляются явно, `groupId` если задана, `deadline` = выбранная дата + `T19:00:00` + смещение зоны `time_zone` на эту дату (IANA-имя → смещение через `Intl.DateTimeFormat(..., { timeZone, timeZoneName: 'longOffset' })`; зона пустая или неизвестна рантайму → `portal_offset`, а если и его нет — `+03:00`; влияет только на час, не на дату), `priority: 'high'` для «важной» (иначе поле не передаём). Тег в `add` не передаём — v3 его не принимает; ставим отдельным `tagTask` сразу после создания, его неудача считается (`retro.bitrix.task.tag_failed`), но задачу не отменяет и пользователю не показывается.

Ключ идемпотентности: `sha256(cardId + JSON полей)` в hex — детерминированный и привязанный к телу. Повтор той же формы после обрыва сети вернёт ту же задачу; правка формы меняет ключ сама.

### Таксономия ошибок портала

`class BitrixError extends Error { kind; code?; status?; message; field? }`. Виды и ключи i18n `bitrix.error.{kind}`:

| Вид | Коды портала | Что видит пользователь |
|---|---|---|
| `invalid_url` | без вызова: адрес не прошёл `parseWebhookUrl` | «Это не похоже на входящий вебхук. Нужна ссылка вида https://портал.bitrix24.ru/rest/1/…/» (только панель) |
| `invalid_webhook` | `INVALID_CREDENTIALS`, `NO_AUTH_FOUND`, пустой `profile`, любой 3xx | панель: «Портал отклонил вебхук. Проверьте, что он не удалён и не истёк»; модалка: «Вебхук больше не работает — портал отклонил запрос» + ссылка «Настройки пространства →» |
| `scope` | `insufficient_scope`, `BITRIX_REST_V3_EXCEPTION_INSUFFICIENTSCOPEEXCEPTION`, `ERROR_METHOD_NOT_FOUND` на v3-адресе | панель: текст из заметки 9 (все три права); модалка: «У вебхука нет права «Задачи»» + ссылка «Настройки пространства →» |
| `access` | `ACCESS_DENIED`, `BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION` (без `groupId`), `OVERLOAD_LIMIT`, `PORTAL_DELETED` | «Портал отказал: проверьте тариф и права или обратитесь в поддержку Битрикс24», без кнопки «Повторить» |
| `limit` | `QUERY_LIMIT_EXCEEDED`, `OPERATION_TIME_LIMIT` | «Портал перегружен, попробуйте через минуту», кнопка «Повторить» |
| `group` | пустой `sonet_group.get`; `ACCESSDENIEDEXCEPTION` или валидация в ответ на `tasks.task.add` при выставленной `groupId` | «Группа не найдена или недоступна», подсветка поля |
| `rejected` | `BITRIX_REST_V3_EXCEPTION_VALIDATION_*` (с `field`), `ERROR_CORE`, прочие 4xx | текст портала без `<br>`, форма остаётся, поле подсвечивается, если названо |
| `network`, `timeout`, `shape` | без ответа / abort / 2xx без `result` / не-JSON / плохой `link` | панель: «Портал не отвечает. Попробуйте через минуту»; модалка: «Портал не отвечает. Задача не создана — проверьте связь и попробуйте ещё раз», главная кнопка становится «Повторить» |

`scope` — один вид с одним ключом; отсутствие прав «Диск» и «Рабочие группы соцсети» никогда не приходит как `scope`: картинка — best-effort (`imageAttached: false`), группа — `noScope` / `{ unknown: true }`. `invalid_webhook`, `scope`, `access` пишутся в `space_bitrix.last_error` только экшенами на пути `fail`; ошибки `tagTask` и `attachImage` в `last_error` не попадают (только метрики), успешный экшен его стирает.

### Ошибки экшенов (не портала)

Возвращаются теми же `fail(status, { bitrixError: kind, ... })`, клиент ветвится **только по `bitrixError`**, никогда по статусу:

| Вид | Статус | Где | Что видит пользователь |
|---|---|---|---|
| `forbidden` | 403 | `createTask`, `GET /[slug]/bitrix/group` | тост «Нет прав создавать задачи с этой доски», модалка закрывается |
| `not_found` | 404 | `createTask` (карточка не на этой доске или удалена) | тост «Карточка удалена — задача не создана», модалка закрывается |
| `not_connected` | 409 | `createTask` | текст в модалке + ссылка «Настройки пространства →» |
| `exists` | 409 (+ `task`) | `createTask` | без текста: модалка закрывается, бейдж из ответа |
| `running` | 409 | `createTask` | «Задачу уже создаёт другой ведущий — подождите», кнопка «Повторить» |
| `invalid` | 422 (+ `field`) | `createTask` | подсветка поля, форма остаётся |
| `rate_limited` | 429 | `createTask`, `bitrixConnect`, группа | «Лимит: 30 задач в час на пространство и 10 в минуту. Попробуйте позже», кнопка «Повторить» |
| `encryption` | 503 | `bitrixConnect` | панель: «На сервере не настроено шифрование, подключение недоступно» |

Статусы по видам: 401 `invalid_webhook` · 403 `forbidden` / `scope` / `access` · 404 `not_found` · 409 `not_connected` / `exists` / `running` / `group` · 422 `invalid` / `rejected` · 429 `rate_limited` · 502 `network` / `timeout` / `shape` / `limit` · 503 `encryption`.

### Шифрование

`crypto.ts` получает экспорт `encryptionEnabled = !!encKey` (сейчас без ключа `encrypt` молча возвращает открытый текст — для вебхука это недопустимо). После `decrypt` результат прогоняется через `parseWebhookUrl`; не сошлось (сменили ключ, испортили данные) → `invalid_webhook`, `last_error` выставляется, панель просит подключить заново. Расшифрованный адрес живёт в памяти одного запроса и нигде не кэшируется.

---

## Секция 3 — Экшены и права

| Действие | Кто | Проверка на сервере |
|---|---|---|
| Подключить, отключить, сменить группу, видеть панель | создатель пространства | cookie `retro_space_creator_{slug}` = `spaces.creator_token`, непустой (как `rename`) |
| Создать задачу из карточки, проверить группу | создатель доски или пространства, с доступом к пространству | cookie `retro_creator_{slug}` = `boards.creator_token` **или** cookie создателя пространства; плюс `canViewSpace` с проверяемой cookie `retro_space_{slug}` = `spaces.access_token` |
| Видеть бейдж | все на доске | без проверки |

Создатель пространства уже считается создателем каждой его доски. Создатель доски без доступа к закрытому пространству (пароль включили после создания доски) кнопки не видит и получает `forbidden`; объяснения в интерфейсе нет — это тот же режим, что у анализа.

### Маршрут пространства `/spaces/[slug]`

Три экшена; проверка создателя — `throw error(403)` «как rename» (панель не-создателю не показывается). Контракт результата один на всех: успех `{ bitrixAction: 'connect' | 'disconnect' | 'setGroup', bitrixSuccess: true, groupNameUnavailable?: true }`, отказ `fail(status, { bitrixAction, bitrixError: kind, field?: 'webhook' | 'groupId' })`. Данные панель берёт из `data.bitrix` после `invalidateAll()`, второго источника правды нет.

- **`bitrixConnect`** (`webhook`, `groupId?`). Порядок строго: cookie создателя → `connectLimiter` 5 попыток в минуту с IP (иначе `rate_limited`; лимитер стоит до любого исходящего вызова, чтобы сервер не стал прокси для перебора чужих вебхуков) → `encryptionEnabled` (иначе `encryption`) → `parseWebhookUrl` (иначе `invalid_url`) → `verifyWebhook` → `checkTasksScope` → `resolveGroup`, если группа указана (`notFound` → `group` с `field: 'groupId'`; `noScope` → сохраняем id без названия и `groupNameUnavailable: true`) → upsert `space_bitrix` с `encrypt(url)`, `last_error = NULL`. Любой шаг падает — ничего не сохраняется.
- **`bitrixDisconnect`**: удаляет строку. Задачи на карточках остаются ссылками.
- **`bitrixSetGroup`** (`groupId` или пусто): cookie создателя → `groupLimiter` (общий с `GET /[slug]/bitrix/group`, 30 в минуту с IP) → `resolveGroup` через сохранённый вебхук → update. Меняет группу без повторного ввода вебхука, ведь мы его не показываем.

### Проверка группы из преформы `GET /[slug]/bitrix/group?id={n}`

Макет проверяет группу через 400 мс после ввода. Эндпоинт `src/routes/[slug]/bitrix/group/+server.ts`: та же проверка прав, что у `createTask` (иначе 403 `{ bitrixError: 'forbidden' }`), `groupLimiter`, `resolveGroup` через вебхук пространства; ответ `{ name }` / `{ notFound: true }` / `{ unknown: true }` (нет права «Рабочие группы соцсети» или портал не ответил — поле не подсвечиваем). Значение по умолчанию из `bitrix.groupName` показывается без запроса. Никогда не `throw error()`.

### Маршрут доски `/[slug]?/createTask`

У маршрута доски экшенов пока нет — это первый. Вход: `cardId`, `title`, `description`, `groupId` (строка, может быть пустой), `deadline` (`YYYY-MM-DD` или пусто), `important` (`on`/отсутствует), `source` (`card`/`summary`; любое другое значение игнорируется и в имя метрики не попадает).

Проверки по порядку, каждая со своим `fail`, `throw error()` не используется:
1. права → 403 `forbidden`;
2. у пространства доски есть `space_bitrix` → 409 `not_connected`;
3. карточка принадлежит этой доске → 404 `not_found`;
4. у карточки нет задачи → 409 `exists` с текущими `task`;
5. карточка не «в работе» — in-memory `Set<cardId>` на процесс → 409 `running`; запись снимается в `finally` после `attachImage`;
6. лимиты: `createLimiter` 10 задач в минуту с IP и 30 в час на пространство (`createRateLimiter` с ключом `space:{id}`) → 429 `rate_limited`;
7. валидация полей: `title` непустой и ≤ 250, `description` ≤ 20 000, `groupId` целое > 0 или пусто, `deadline` валидная дата → 422 `invalid` с `field`.

Далее: метрика `requested` → расшифровка и проверка формы адреса (иначе `invalid_webhook` + `last_error`) → `createTask` → `UPDATE cards SET bitrix_task_id, bitrix_task_url WHERE id = ? AND bitrix_task_id IS NULL`; 0 строк (карточку удалили, пока шёл запрос) → задача в портале остаётся сиротой, метрика `retro.bitrix.task.orphaned`, ответ `not_found` → `tagTask` best-effort → `attachImage` best-effort (если у карточки есть `image_id`) → метрики → **только теперь** `emitBoard(slug, 'card:task', { cardId, task })` → ответ `{ task: { id, url }, imageAttached: true | false | null }` (`null` — картинки не было). Порядок важен: сокет создателя тоже в комнате, и если рассылать до вложения, бейдж появится под ещё крутящейся модалкой.

Ошибка: `fail(status, { bitrixError: kind, field?, message? })`; `invalid_webhook`/`scope`/`access` пишутся в `last_error`.

---

## Секция 4 — Клиент и live-обновления

### Шина в комнату доски

`src/lib/server/bus.ts`: `emitBoard(boardSlug, event, payload)` рядом с `emitSpace`, канал `'board'`. `server.js`: `bus.on('board', ({ boardSlug, event, payload }) => io.to(boardSlug).emit(event, payload))` — комната доски и есть её slug (`socket.join(slug)` при `board:join`). В `npm run dev` шины нет, поэтому клиент создателя обновляется из ответа экшена, а не ждёт сокета.

### Стор

- `boardStore`: поля `bitrix` (`{ spaceSlug, userName, groupId, groupName } | null`) и `bitrixOffer: boolean`, выставляются из page data в том же `$effect`, что и `isCreator`; метод `setTask(cardId, task)` патчит `bitrixTaskId`/`bitrixTaskUrl` карточки; `removeCard(cardId)` дополнительно зовёт `bitrixTaskStore.cardGone(cardId)`.
- `socket.svelte.ts`: `socket.on('card:task', ({ cardId, task }) => boardStore.setTask(cardId, task))`; `board:state` после реконнекта несёт колонки сам. Новый метод `trackTaskOpened(source)` шлёт `bitrix:opened { source, creatorToken: this.currentCreatorToken }` — токен уже хранится в сторе для повторного `board:join`, пропсы компонентов не растут.
- Новый `bitrixTaskStore` (`.svelte.ts`): `open(cardId, source)` (зовёт `trackTaskOpened`) / `close()` / `cardGone(cardId)`, состояние `{ cardId, source } | null` — одна модалка на доску.
- `toast.svelte.ts`: у `ToastAction` появляется `external?: boolean`; `Toasts.svelte` рисует такую ссылку с `target="_blank" rel="noopener"`.

### Точки входа

- `Card.svelte`: кнопка «В задачу» при `boardStore.isCreator && boardStore.bitrix && !card.bitrixTaskId`; бейдж-ссылка при `card.bitrixTaskUrl`, для всех, открывается в новой вкладке. Пропсы карточки не растут — читает стор напрямую, как `Header`.
- `SummaryRow.svelte`: в обычной строке компактный бейдж при наличии задачи (`pointer-events-auto`, см. заметку 29); в сфокусированной строке кнопка «В задачу» в ряду управления при `canControl && boardStore.bitrix && !card.bitrixTaskId`, после создания — бейдж.
- `Header.svelte`, меню `⋯` доски: пункт «Подключить Битрикс24» при `bitrixOffer` (только создатель пространства), ведёт на `/spaces/{slug}?bitrix=1` — страница пространства открывает панель и ставит фокус в поле вебхука (параметр читается в `+page.svelte`, в load не участвует).
- Доски-анализы используют те же компоненты, отдельной ветки нет.

### Преформа `BitrixTaskModal.svelte`

По рецепту `NewBoardModal` (overlay `bg-scrim`, `role="dialog"`, Escape и клик по фону закрывают, фокус внутри). Смонтирована один раз в `Board.svelte`. Черновик считает чистый модуль `src/lib/bitrix-draft.ts`:

```
buildTaskDraft({ card, board, column, comments, likes, dislikes, origin, locale }) → { title, description }
```

- `title`: первая непустая строка `content`, обрезка до 100 символов по границе слова с многоточием; для карточки без текста (только фото) — «Карточка из ретро «{board}»».
- `description`, блоки через пустую строку, каждый только если есть данные: текст карточки; «Из ретро «{board}» · колонка «{column}»» (на доске-анализе — «Из AI-анализа «{board}»») и на следующей строке `{origin}/{slug}`; «Автор: {name} · голосов: {likes}» (дизлайки через «против», если есть); «Комментарии:» и строки «{name}: {text}» (комментарий без имени — «Аноним», комментарий без текста, только фото — `{name}: {summary.photo}`). Подписи через `translate(locale, 'bitrix.draft.*')` — `locale` приходит аргументом, `t()` в чистом модуле не используется, поэтому тест гоняет обе локали без подмены стора.

Черновик считается один раз при открытии: `buildTaskDraft(...)` и `card.imageId` попадают в локальный `$state` формы в момент монтирования; последующие `card:updated`, `vote:toggled`, `comment:created`, `board:renamed` поля не трогают — это и есть «что в поле, то и уходит». Если карточку удалили, пока модалка открыта (`cardGone`): запрос не идёт — модалка закрывается, тост `bitrix.toast.cardGone` «Карточка удалена — задача не создана»; запрос идёт — ничего, исход решает ответ сервера. Модалка закрывается по `card:task` для своей карточки в любом состоянии — так второй ведущий узнаёт, что задачу создали без него.

Поля формы: название (`maxlength` 250), описание (textarea), группа (число, предзаполнена из `bitrix.groupId`, под полем название группы / «не найдена» / пусто), срок (`type="date"`, пусто), «Важная задача» (`ToggleSwitch`), индикатор «Картинка карточки будет прикреплена» если `card.imageId`, строка «Ответственный и постановщик: {userName}». Скрытые поля `cardId`, `source`.

Отправка `<form method="POST" action="/{slug}?/createTask" use:enhance>` в стиле `AnalyzeButton`: колбэк разбирает `result` сам и **не вызывает `update()`** — `invalidateAll()` перезапустил бы load доски и `$effect` входа в комнату (повторный `board:join`, двойной `users:count` и `board:state` всем). Пока запрос идёт: спиннер на кнопке с подписью «Создаём…» (при `card.imageId` — «Создаём и прикрепляем картинку…», ключ `bitrix.form.creatingWithImage`), все поля disabled, Escape не закрывает. Своего таймаута у клиента нет — его задают серверные таймауты вызовов (до пяти вызовов, худший случай около минуты с картинкой).

Реакция на `result` (ветвление по `bitrixError`, никогда по статусу):

| Результат | Поведение |
|---|---|
| успех | модалка закрывается, `boardStore.setTask` сразу, тост `success` «Задача #{id} создана» с действием «Открыть» (`external`); при `imageAttached === false` — «Задача #{id} создана, картинка не прикреплена» |
| `exists` | модалка закрывается, бейдж из ответа |
| `invalid_webhook`, `scope`, `access`, `not_connected` | текст в модалке + ссылка «Настройки пространства →» |
| `group` | подсветка поля группы + «Группа не найдена — проверьте id или очистите поле», форма остаётся; отправку не блокируем — поле можно очистить и создать без группы |
| `invalid` | подсветка поля из `field`, форма остаётся |
| `network`, `timeout`, `shape`, `limit`, `rate_limited`, `running` | текст + главная кнопка «Повторить», форма остаётся (ключ идемпотентности тот же; после `running` повтор вернёт `exists`, если другой ведущий успел, или создаст задачу) |
| `rejected` | текст портала в модалке; поле подсвечено, если портал его назвал |
| `forbidden`, `not_found` | тост `error`, модалка закрывается |
| `result.type === 'error'` (неожиданный 5xx) | тост `error`, форма остаётся |

### Панель пространства `BitrixPanel.svelte`

Только для `data.isCreator`. Триггер — кнопка «Битрикс24» в ряду создателя перед тумблером «Пароль» (не тумблер: у подключения нет состояния «вкл/выкл» без данных), раскрывает тот же `collapsible`, что и пароль; открыта одна панель за раз. Состояния: **не подключено** (поле вебхука, поле группы, «Подключить», подсказка где взять вебхук и какие галочки нужны: Задачи, Диск, Рабочие группы соцсети — в макете написано «Пользователи», это исправлено, см. Секцию 5), **проверка** (спиннер, поля disabled), **подключено** (портал, «Задачи создаёт: {userName}», группа с названием и правкой, «Отключить» с подтверждением первым кликом на 3 с, без браузерных диалогов), **ошибка** (13 `text-bad` под полем + `shake`; при `last_error` — `error-box` «вебхук перестал работать» над формой повторного подключения), **шифрование не настроено** (форма заменена на пояснение, если `!encryptionEnabled`). Реакция на `form` через `$effect`, как у пароля: `bitrixAction` + `bitrixSuccess` дают бейдж «Подключено»/«Отключено»/«Сохранено» на 2,5 с, `bitrixError` + `field` — текст и подсветка; данные — из `data.bitrix`.

### i18n

Ключи в `en.json` и `ru.json`: `bitrix.panel.*` (панель, включая `bitrix.panel.encryptionOff`), `bitrix.menu.connect`, `bitrix.card.create` / `bitrix.card.task` (кнопка и бейдж), `bitrix.form.*` (преформа, включая `creating`, `creatingWithImage`, `retry`, `settingsLink`), `bitrix.draft.*` (подписи описания), `bitrix.error.{invalid_url|invalid_webhook|scope|access|limit|group|rejected|network|timeout|shape|forbidden|not_found|not_connected|running|invalid|rate_limited|encryption}` (`exists` без текста), `bitrix.toast.{created|createdNoImage|open|cardGone|forbidden|notFound}`, `apiExport.task`. Слово «вебхук» допустимо только в панели.

### Аналитика

Серверные StatsD-счётчики, как `retro.analysis.*`. В имя метрики попадают только серверные перечисления, клиентская строка — никогда: `source` принимается только как `'card'` или `'summary'`, обработчик `bitrix:opened` при другом значении делает `return` до метрики, экшен — игнорирует поле.

| Метрика | Когда |
|---|---|
| `retro.bitrix.task.opened.{card\|summary}` | открылась преформа — клиент шлёт `bitrix:opened { source, creatorToken }`; `server.js`: `if (!currentRoom \|\| !isRoomCreator(payload?.creatorToken)) return;` + whitelist `source`, затем `metric` |
| `retro.bitrix.task.requested` | экшен `createTask` прошёл права, лимиты и валидацию |
| `retro.bitrix.task.created.{card\|summary}`, `retro.bitrix.task.duration_ms` (тип `ms`) | портал вернул задачу; `source` неизвестен → `created.other` |
| `retro.bitrix.task.failed.{kind}` | по виду ошибки, включая `rate_limited` и `running` |
| `retro.bitrix.task.image_attached`, `image_failed`, `image_skipped` | судьба картинки |
| `retro.bitrix.task.tag_failed`, `retro.bitrix.task.orphaned` | тег не поставился; карточка исчезла после создания |
| `retro.bitrix.connected`, `retro.bitrix.connect_failed.{kind}`, `retro.bitrix.disconnected` | панель |

---

## Секция 5 — Макет Claude Design

Макет «Bitrix24 - карточка в задачу.dc.html» (Claude Design, проект `0f8b7992-02cf-4764-a677-e052071471d3`, светлая и тёмная тема, состояния A1–A4, B1–B4, C1–C4, D1–D2). Ниже его заметки для разработчика 1–31 в сжатом виде — они обязательны для реализации — и решения по расхождениям с остальной спекой.

### A · Панель пространства (заметки 1–9)

1. Триггер — `btn btn-secondary btn-md pr-3.5` в ряду создателя перед тумблером «Пароль»: глиф-ссылка 16 `text-text-secondary`, подпись «Битрикс24», шеврон 14 `text-text-muted` (180° когда открыто), `aria-expanded`. Подключено → вместо ссылки ✓ 16 `text-well`. Ряд 38px: [Битрикс24 ⌄] [Пароль ◯] [🗑].
2. Панель — тот же `collapsible` + `mt-7 rounded-2xl border border-border bg-surface-card p-4`, что у пароля. Открыта одна панель за раз; режим удаления пространства сворачивает обе.
3. Поля `input input-md` с подписями 14/600: вебхук `flex-1` (`type=url autocomplete=off`), группа `w-[290px]` (`inputmode=numeric`). «Подключить» `btn btn-primary btn-md` — единственная терракота в блоке; «Отмена» сворачивает панель. Enter в любом поле = «Подключить».
4. Подсказка 13 `text-text-muted`, одна строка: «Где взять: Битрикс24 → Разработчикам → Другое → Входящий вебхук. Права: Задачи, Диск, Рабочие группы соцсети». Слово «вебхук» живёт только здесь.
5. Проверка: кнопка `disabled` со спиннером 16 `animate-spin` и подписью «Проверяем…»; поля `opacity-50 pointer-events-none`. Сервер: `profile`, пробный `tasks.task.field.list`, название группы отдельным `sonet_group.get`, его неудача не ошибка — покажем только id.
6. Подключено: заголовок 14/600 «Битрикс24 · {portal}», `badge badge-outline` «Подключено» с ✓ 12; аватар-инициал 32 `bg-text-primary text-surface` 13/700; «Задачи создаёт: {userName}» (метка `text-text-secondary`, имя 600) и пояснение 13 «ответственный и постановщик всех задач из этого пространства». Клиенту уходят только `portal`, `userName`, `groupId`, `groupName`, `lastError`.
7. Группа по умолчанию: «42 · Платформа» (название, если портал вернул; пусто → «не задана» `text-text-muted`). Карандаш `btn-icon btn-icon-sm` → инлайн `input input-md w-32` + «Сохранить» `btn btn-dark btn-md` + «Отмена»; Enter/Esc/blur как у переименования; подпись «пусто = без группы». Экшен `bitrixSetGroup`.
8. «Отключить» `btn btn-secondary btn-md hover:bg-bad-bg hover:text-bad`. Первый клик → `btn btn-danger btn-md` «Нажмите ещё раз — отключить» на 3 с, второй — `bitrixDisconnect`, без браузерных диалогов. После — состояние A1, у заголовка `badge badge-success badge-pop` «Отключено» на 2,5 с. Бейджи на карточках остаются.
9. Ошибки: поле вебхука `border-bad` + `animate-[shake_0.5s_ease]` (снимаем через 600 мс), текст 13 `text-bad` под рядом, фокус остаётся в поле, введённое не стираем. Тексты панели (RU/EN):
   - `invalid_url`: «Это не похоже на входящий вебхук. Нужна ссылка вида https://портал.bitrix24.ru/rest/1/…/» / «That doesn't look like an inbound webhook. Expected https://portal.bitrix24.com/rest/1/…/»
   - `invalid_webhook`: «Портал отклонил вебхук. Проверьте, что он не удалён и не истёк.» / «The portal rejected the webhook. Check it hasn't been deleted or expired.»
   - `scope`: «У вебхука нет права «Задачи». Добавьте права Задачи, Диск и Рабочие группы соцсети и попробуйте снова.» / «The webhook lacks the Tasks permission. Add Tasks, Drive and Social network workgroups, then try again.»
   - `access`: «Портал отказал: проверьте тариф и права или обратитесь в поддержку Битрикс24.» / «The portal refused: check your plan and permissions or contact Bitrix24 support.»
   - `network`, `timeout`, `shape`, `limit`: «Портал не отвечает. Попробуйте через минуту.» / «The portal isn't responding. Try again in a minute.»
   - `rate_limited`: «Слишком много попыток. Попробуйте через минуту.» / «Too many attempts. Try again in a minute.»

   Состояния «шифрование не настроено» и предупреждение по `last_error` в макете не нарисованы: первое — та же панель с текстом вместо формы, второе — `error-box` над формой повторного подключения в состоянии A1.

### B · Карточка (заметки 10–16)

10. «В задачу» — четвёртая иконка верхней группы, `btn-icon btn-icon-sm` (28, радиус 8, глиф 16 «квадрат с галочкой»), первая слева: [задача] [переместить] [редактировать] [удалить]. Условие: `(isBoardCreator || isSpaceCreator) && bitrix && !card.bitrixTaskId`. Сверху, потому что верхняя группа — действия над карточкой, нижний ряд — её состояние.
11. Tooltip: `title` + `aria-label` «В задачу Битрикс24»; визуально идиома FocusTimer (`rounded-xl bg-text-primary text-surface px-3 py-2 text-[13px] shadow-1`, `mt-1.5`, прижат к правому краю группы, 150 мс по hover и focus-within). Рекомендация макета применить ту же подсказку ко всем четырём иконкам — принимается.
12. Бейдж «Задача #123» — `<a target="_blank" rel="noopener">`: `inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface-card px-3 text-[13px] font-semibold text-text-primary`, глиф внешней ссылки 14 `text-text-muted`. Hover `border-border-strong bg-surface-hover`; focus — системное кольцо; `active:scale-[0.97]`; появление `badgePop`; `title` — полная ссылка. Стоит после пилюли комментариев, автор остаётся `ml-auto`.
13. Нейтральный: не цвет колонки, не терракота, не improve. На доске-анализе рядом с `AiBadge` (тинт improve, 20px, капитель) бейдж задачи — рамка, 32px, обычный регистр, с глифом.
14. Телефон: бейдж `max-md:h-10 max-md:px-4`; ряд действий `flex-wrap gap-2`, бейдж уходит на вторую строку, автор на той же строке, что и бейдж.
15. B3: пункт «Подключить Битрикс24» — `dropdown-item` с глифом-ссылкой 16 `text-text-muted` между «Переименовать доску» и «Удалить доску». Ведёт на `/spaces/{slug}?bitrix=1` — панель A1 открыта, фокус в поле вебхука. Только создателю пространства (`bitrixOffer`).
16. B4: доска-анализ — всё идентично; у карточек анализа нет автора, бейдж стоит последним. Первая служебная строка описания — «Из AI-анализа «…»».

### C · Преформа (заметки 17–28)

17. База — `NewBoardModal`: overlay `fixed inset-0 z-[70] bg-scrim p-4` (`modalFadeIn`), карточка `w-[480px] max-w-full rounded-3xl bg-surface-card p-6 sm:p-8 shadow-2 gap-[18px]` (`modalZoomIn`), `role="dialog" aria-modal="true"`. Фокус в «Название» с `select()`; Escape и клик по оверлею закрывают (кроме C2); фокус-ловушка. Tab-порядок: закрыть → название → описание → группа → срок → важная → отмена → создать.
18. Заголовок Unbounded 21 «Задача в Битрикс24»; строка 14 `text-text-secondary` «{portal} · тег retro добавится автоматически» — единственное упоминание тега; закрыть `btn-icon btn-icon-lg btn-icon-bordered`.
19. Название: `input input-lg bg-surface`, подпись 14/600; предзаполнение — первая строка карточки до 100 символов по границе слова + «…»; `maxlength=250`, счётчика нет; пустое → «Создать задачу» `disabled`. Карточка-фото без текста → «Карточка из ретро «{board}»».
20. Описание: `textarea bg-surface px-[18px] py-3 text-[15px] leading-[1.5]`, авторост 4–8 строк, дальше `max-h-[204px] overflow-y-auto`. Предзаполнение построчно, как в Секции 4; Enter — перенос строки.
21. Группа: `input input-lg bg-surface inputmode=numeric`, предзаполнена значением пространства; строка-состояние 13 под полем (`mt-1.5`): название `text-text-muted` / «Группа не найдена — проверьте id или очистите поле» `text-bad` / пусто — проверка через 400 мс после ввода через `GET /[slug]/bitrix/group`. Срок: нативный `input type=date` в `input input-lg`, пусто по умолчанию, `min` = сегодня, иконка календаря 16 muted. На телефоне сетка одной колонкой.
22. «Важная задача» — `ToggleSwitch` (38, подпись 14/600), по умолчанию выключен. В макете написано `PRIORITY: 2` (старый REST); мы шлём v3 `priority: 'high'`.
23. Строки-индикаторы 13 `text-text-secondary` с глифами 14: «Картинка карточки будет прикреплена» — только при `card.imageId`; «Ответственный и постановщик: {userName}» — всегда. Не контролы, не в Tab-порядке.
24. Кнопки: «Отмена» `btn btn-secondary btn-lg flex-1`, «Создать задачу» `btn btn-primary btn-lg flex-[2]` — единственная терракота в модалке. Enter в названии, группе и сроке отправляет форму.
25. Отправка: кнопка `disabled` со спиннером 16 и подписью «Создаём…» (с картинкой — «Создаём и прикрепляем картинку…»); форма и «закрыть» `opacity-50 pointer-events-none`, `aria-busy`; Escape и оверлей игнорируются; повторная отправка невозможна. «Таймаут 15 с → C3» из макета означает серверный таймаут одного вызова портала; клиент своего таймера не держит.
26. Ошибки не закрывают модалку и не стирают поля: `error-box` (`rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad-strong`, `fadeUp`) над кнопками, `role="alert"`. Вебхук отклонён → текст + ссылка «Настройки пространства →» 700 `text-bad-strong underline` на `/spaces/{slug}?bitrix=1`. Портал не отвечает → главная кнопка «Повторить» с теми же данными. Группа не найдена → поле `border-bad` + shake + строка `text-bad`; отправку не блокируем.
27. Успех: модалка закрывается, бейдж (`badgePop`) у всех через сокет; `toastStore.push({ kind: 'success', text: 'Задача #123 создана', action: { label: 'Открыть', href, external: true } })`, 8 с. Ошибочных тостов нет, кроме случаев, когда форму сохранять незачем: `forbidden`, `not_found`, удалённая карточка — тогда модалка закрывается с тостом `error`. При `imageAttached === false` текст тоста: «Задача #123 создана, картинка не прикреплена».
28. Телефон: та же модалка становится листом во весь экран — `max-sm:fixed max-sm:inset-0 max-sm:h-[100dvh] max-sm:rounded-none`, без scrim, вход `fly y:24`. Шапка и ряд кнопок `sticky` (`bg-surface-card`, разделитель `border-border`), поля прокручиваются между ними; `100dvh` сжимается с клавиатурой — «Создать задачу» всегда видна.

### D · Итоги (заметки 29–30)

29. D1: у строки с задачей — компактная ссылка «#123»: `inline-flex h-7 items-center gap-1 rounded-full border border-border px-2.5 text-[13px] font-semibold text-text-secondary`, глиф 12, между автором и пилюлей комментариев; hover `border-border-strong text-text-primary`; `title` «Задача #123 в Битрикс24». Обязательно `pointer-events-auto` — иначе клик уйдёт в прозрачный слой прыжка фокуса. При нехватке места первым уступает автор (`max-w-28 truncate`).
30. D2: в ряду управления после «Далее →» — «В задачу» `btn btn-secondary btn-sm` с глифом 14 (только `canControl && bitrix && !card.bitrixTaskId`); «Далее →» остаётся единственной терракотой. Открывает C1 с текущей карточкой, обсуждение и FocusTimer не прерываются. После создания на том же месте — бейдж 32 как на карточке (`badgePop`), у всех. Ряд `flex-wrap`; кнопка и бейдж `pointer-events-auto`.

### Общее (заметка 31) и расхождения

31. Задача хранится на карточке, сервер рассылает событие — бейдж появляется у всех без перезагрузки и переживает переименование доски. Экспорт получает поле задачи. Все строки через `t()` в обеих локалях. Без пространства не рендерятся кнопка «В задачу», пункт меню и преформа (A, B10, B15, C, D2); бейджи (B12, D1) рендерятся по `card.bitrixTaskUrl` независимо от пространства.

Расхождения макета со спекой и как они разрешены:

| Макет | Спека | Решение |
|---|---|---|
| Права в подсказке: «Задачи, Диск, Пользователи»; «профиль владельца (user.current)» | `profile` работает без права «Пользователи»; для названия группы нужно «Рабочие группы соцсети» | Подсказка и текст ошибки `scope` говорят «Задачи, Диск, Рабочие группы соцсети» |
| Событие сокета `card:updated` | отдельное `card:task` | `card:task` — не нужно собирать полный объект карточки в SvelteKit |
| `PRIORITY: 2` | v3 `priority: 'high'` | v3 |
| Ключи ошибок `bitrix.error.{invalid|denied|scope|unreachable}` | виды из Секции 2 | ключи `bitrix.error.{kind}` по видам Секции 2; тексты панели из макета переиспользуются несколькими видами |
| «Ошибочных тостов нет» | `forbidden` / `not_found` / удалённая карточка | тост и закрытие модалки только там, где форму сохранять незачем |
| Обрезка названия 100 символов | было 120 | 100, по границе слова |
| Проверка группы через 400 мс | не было | эндпоинт `GET /[slug]/bitrix/group` (Секция 3) |
| Пункт меню ведёт на `?bitrix=1` | было без параметра | `?bitrix=1` открывает панель и ставит фокус |
| Пункт меню «создателю доски или пространства» | только создатель пространства может подключить | `bitrixOffer` только создателю пространства |
| Подсказка-tooltip на всех четырёх иконках карточки | не было | принимается, попутное улучшение `Card.svelte` |

---

## Секция 6 — Тесты

### Vitest

- `src/lib/server/bitrix.test.ts`: `parseWebhookUrl` (валидный, http без флага, localhost с флагом и без, приватные IPv4 в обычной, числовой и hex-форме, `[::1]`, `[::ffff:7f00:1]`, `https://db/rest/1/x/`, `*.local`, лишние сегменты, query, нормализация); оба транспорта через `fetchFn` (адрес с `/rest/api/`, JSON-тело, `Idempotency-Key`, `redirect: 'manual'`, 3xx → `invalid_webhook`); нормализация ошибок обоих форматов и таблица «код → вид», включая `ACCESSDENIEDEXCEPTION` с группой → `group`, `OVERLOAD_LIMIT` → `access`; `timeout`, не-JSON, ответ без `result`; `createTask` → id и склеенная ссылка, `link` вида `@evil.com/…`, `//evil.com/…` и отсутствующий → `shape`; `tagTask` шлёт `TAGS` старым REST; `attachImage` — три вызова по порядку с `generateUniqueName` и `result.ID` (не `FILE_ID`), ошибка пробрасывается, семафор пропускает по одному; пустой `profile` → `invalid_webhook`; смещение дедлайна для IANA-зоны, для пустой зоны с `portal_offset` и без; секрет не попадает в `message`.
- `src/lib/bitrix-draft.test.ts`: название (первая непустая строка, обрезка по слову, карточка без текста), описание со всеми блоками и без каждого, комментарий без имени, комментарий без текста (только фото), доска-анализ, обе локали через `translate`.
- `crypto.test.ts`: `encryptionEnabled` с ключом и без.
- `space-access.test.ts`: `canViewSpace` принимает только cookie, равную `access_token`.
- `export.test.ts`: `task` в JSON и строка в Markdown.
- `dictionaries.test.ts` уже ловит рассинхрон словарей.

### E2E

`e2e/mock-bitrix.mjs` — третий `webServer` в `playwright.config.ts` (порт 4779, `GET /health`), по образцу `mock-deepseek.mjs`. Обслуживает старый и v3-адреса: `profile` (с `TIME_ZONE: 'Europe/Kaliningrad'` и `time.date_finish`), `tasks.task.field.list`, `sonet_group.get`, `tasks.task.add` (отвечает `item.id` и `item.link` с группой, как живой портал), `tasks.task.update` (тег), `disk.storage.getlist`, `disk.storage.uploadFile` (отвечает `ID` и `FILE_ID` разными числами, второй файл с тем же `NAME` без `generateUniqueName` отклоняет), `tasks.task.file.attach` (принимает только `ID` объекта). Код в адресе не `testcode` → `INVALID_CREDENTIALS`; `groupId` не из списка мока → 403 `ACCESSDENIEDEXCEPTION`. `POST /__mode` переключает `ok | invalid_webhook | scope | disk_fail | error | delay`, `GET /__calls` отдаёт перехваченные тела и заголовки, `POST /__reset` чистит. В env конфига `BITRIX_ALLOW_HTTP=1`; тест вставляет `http://localhost:4779/rest/1/testcode/` как пользователь.

Хелперы в `e2e/helpers.ts`: существующие `createSpace`, `createLockedSpace`, `createBoardInSpace`, `addCard`; `createBoardInSpace` начинает возвращать `{ slug, adminUrl }` (страница после редиректа стоит на `/{slug}?admin=…`, как у `createSpace`); новый `addCardWithImage(page, column, text, fixture)` — открывает композер, заполняет текст, `setInputFiles` на скрытый `input[type=file]` внутри колонки, ждёт `POST /api/upload` до Enter (у `CardForm.submit()` нет защиты от раннего Enter), затем ждёт `img[src^="/api/image/"]` в карточке; фикстура `e2e/fixtures/card.png`. Прямой POST в экшен из теста нужен с заголовками `x-sveltekit-action: true` и `Origin`, иначе SvelteKit отдаст 405 или CSRF-403 до обработчика.

`e2e/bitrix.spec.ts`, каждый тест на своём пространстве:
1. Подключение с группой: панель показывает портал, владельца, название группы; переживает перезагрузку; второй контекст без cookie панели не видит.
2. Неверный вебхук: ошибка в панели, после перезагрузки состояние «не подключено».
3. Доска в пространстве: у создателя есть «В задачу», у гостя нет; после создания гость видит бейдж без перезагрузки; в `/__calls` у `tasks.task.add` совпадают `title`, `description` со ссылкой на доску, `responsibleId` = `creatorId` = 1, `groupId`, `priority`, `deadline` со смещением `+02:00`, заголовок `Idempotency-Key`; следом мок видит `tasks.task.update` с `TAGS: ['retro']`.
4. Повторно кнопки нет; бейдж ведёт на ссылку из ответа мока и имеет `target="_blank"`.
5. Карточка с картинкой (`addCardWithImage`): мок видит `uploadFile` с `NAME` = `retro-{cardId}.webp` и `file.attach` с `ID` объекта; в `disk_fail` задача создана, тост предупреждает.
6. `invalid_webhook` при создании: ошибка в модалке со ссылкой в пространство; после перезагрузки панель показывает предупреждение.
7. Создание из сфокусированной строки Summary.
8. Экспорт JSON содержит `task`.
9. Доска-анализ (через мок DeepSeek): у создателя пространства кнопка есть.
10. Отключение: после перезагрузки кнопки нет, бейджи остались.
11. Закрытое пространство, создатель доски без пароля пространства: контекст A создаёт закрытое пространство, подключает мок и доску с карточкой; контекст B открывает `adminUrl` доски (есть `retro_creator_{slug}`, нет `retro_space_{slug}`): пункт «Переименовать доску» есть, «В задачу» нет, «Подключить Битрикс24» нет, прямой POST в `createTask` → 403 `forbidden`. Отдельной строкой: гость без cookie тоже получает 403.
12. Пункт «Подключить Битрикс24» в меню доски без подключения ведёт на `/spaces/{slug}?bitrix=1`, панель открыта, фокус в поле вебхука; после подключения пункта нет; обычный создатель доски (не пространства) пункта не видит.
13. В преформе ввод чужого id группы через 400 мс показывает «Группа не найдена», ввод существующего — название из мока.
14. Удаление пространства: доска с задачей после удаления пространства показывает бейдж с `target="_blank"`, но не кнопку и не пункт меню.
15. Подделанная cookie `retro_space_{slug}=x` на закрытом пространстве не открывает его и не даёт создать доску.

---

## Конфигурация и деплой

- Новых обязательных переменных нет. `ENCRYPTION_KEY` на проде уже стоит. `BITRIX_ALLOW_HTTP` только в `playwright.config.ts`; `BITRIX_IMAGE_MAX_BYTES` необязательна (4 МБ по умолчанию); обе описаны в `.env.example` одной строкой каждая.
- Dockerfile не меняется: новые файлы лежат в `src/`, `drizzle/` уже копируется.
- `docker-compose.prod.yml` не меняется; в `docker-compose.yml` добавляется проброс `ENCRYPTION_KEY: ${ENCRYPTION_KEY:-}` после `ORIGIN` — без ключа панель локально показывает «шифрование не настроено». В `.env.example` у `ENCRYPTION_KEY` появляется комментарий: 64 hex-символа, `openssl rand -hex 32`. Для `npm run dev` ключ экспортируется в оболочку.
- Любой новый маршрут автоматически получает `X-Robots-Tag: noindex` (`seo-paths.js`), тест `seo.test.ts` не затрагивается.
- `entrypoint.sh` применяет миграцию при старте контейнера.

## Порядок реализации (набросок для плана)

1. ~~Проверка на живом портале~~ — сделана 17.09, результаты в разделе «Проверено на живом портале».
2. Миграция (`space_bitrix`, колонки `cards`, `spaces.access_token`), схемы в `schema.ts` и `server.js`, типы, экспорт; проверяемая cookie доступа (`verify`, `enablePassword`, `?admin=`, `canViewSpace`, `space:join`, `createBoard`).
3. `crypto.encryptionEnabled`, `bitrix.ts` с тестами.
4. Экшены пространства, `bitrix`/`encryptionEnabled` в load() пространства, `BitrixPanel` на утилитах дизайн-системы, `?bitrix=1`.
5. `bus.emitBoard`, ретранслятор и счётчик `bitrix:opened` в `server.js`, стор (`setTask`, `trackTaskOpened`, `bitrixTaskStore`), `card:task`.
6. Маршрут доски: экшен `createTask` и эндпоинт `GET /[slug]/bitrix/group` (Секция 3), `bitrix`/`bitrixOffer` в load() доски и в `$effect` страницы → `boardStore`.
7. `bitrix-draft.ts` с тестами, `BitrixTaskModal`, кнопки и бейджи в `Card`/`SummaryRow`/`Header`, тосты с `external`, i18n.
8. Мок, хелперы и e2e; `docker-compose.yml`, `.env.example`.
9. Сверить панель, модалку, кнопку, бейдж и строки Summary с заметками 1–31 макета (Секция 5); компоненты с самого начала строятся по ним, этот шаг — контрольный проход.
10. Запись в `/changelog`, `CLAUDE.md` (раздел Features), память проекта.

## Вне охвата

Массовое создание задач из Summary; обратная синхронизация статуса задачи; несколько задач на карточку; вебхук на уровне доски; доски вне пространства; выбор ответственного; загрузка картинок комментариев; вызов `tasks.api.scrum.task.update` для бэклога скрама (не нужен на портале автора, вернёмся, если понадобится другим); следование за редиректом при смене адреса портала (переподключение вручную).

Альтернативы, вынесенные дизайнером за скобки макета и осознанно не взятые: подписанная кнопка «В задачу» в нижнем ряду карточки вместо иконки (пересмотреть через 2–3 спринта по метрике `opened.card` против `opened.summary`); срок по умолчанию «+14 дней от даты доски»; пункт «Отвязать задачу» в меню карточки для удалённых в портале задач.
