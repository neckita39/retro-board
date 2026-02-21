# Retro Board

Доска для ретроспектив в реальном времени. Создай доску, отправь ссылку команде и работайте вместе — без регистрации.

## Возможности

- **Три колонки**: Что прошло хорошо, Что пошло не так, Что улучшить
- **Совместная работа** в реальном времени через WebSocket (Socket.IO)
- **Голосование** (лайк/дизлайк) и **комментарии** к карточкам
- **Таймер** для ограничения обсуждений по времени
- **Тёмная тема**
- **i18n** — английский и русский языки
- **Экспорт** доски в JSON или Markdown
- **Копирование ссылки или кода доски** для быстрого доступа
- **Шифрование данных** в БД (AES-256-GCM)
- **Мониторинг** — StatsD + Netdata, Pino logging
- **CI/CD** — автоматические тесты и деплой через GitHub Actions

## Безопасность

При установке переменной `ENCRYPTION_KEY` содержимое карточек, имена авторов и комментарии шифруются на сервере алгоритмом AES-256-GCM перед записью в базу данных. При чтении — расшифровываются обратно. Без ключа данные хранятся как есть.

Старые данные, созданные до включения шифрования, продолжают работать — сервер отдаёт их без расшифровки.

## Установка

### Переменные окружения

Скопируйте `.env.example` в `.env` и настройте:

```
DATABASE_URL=postgresql://retro:retro@localhost:5432/retro
PORT=3000
ORIGIN=http://localhost:3000
ENCRYPTION_KEY=           # 64 hex-символа (32 байта), пусто = без шифрования
```

Сгенерировать ключ: `openssl rand -hex 32`

### Docker (локальная разработка)

```sh
docker compose up -d --build
```

Приложение доступно на http://localhost:3777

### Docker (продакшен)

```sh
docker compose -f docker-compose.prod.yml up -d --build
```

## Тесты

```sh
npm test
```

21 unit-тест, запускаются за <1 секунду без Docker, БД или браузера.

## CI/CD

При пуше в `main` GitHub Actions автоматически:
1. Устанавливает зависимости
2. Запускает тесты
3. Собирает проект
4. Деплоит на сервер через SSH

<details>
<summary><h2>Мониторинг</h2></summary>

### Архитектура

```
App (Pino logs + StatsD UDP) → Netdata Agent → Netdata Cloud (дашборды, алерты)
```

| Компонент | RAM | Назначение |
|-----------|-----|------------|
| Pino | ~3MB | Структурированные JSON-логи |
| StatsD (dgram UDP) | 0MB | Кастомные метрики в Netdata |
| SvelteKit hooks | ~1MB | Логирование HTTP ошибок и медленных запросов |
| Netdata Agent | ~100-150MB | Сбор метрик, StatsD сервер, алертинг |
| Netdata Cloud | 0MB (внешний) | Веб-дашборд с графиками |

### Эндпоинты

| Эндпоинт | Назначение | Пример |
|----------|------------|--------|
| `GET /health` | Liveness-проверка (без БД) | `{"status":"ok","uptime":123.4,"wsConnections":2}` |
| `GET /ready` | Readiness-проверка (с БД) | `{"status":"ready","db":"ok"}` |
| `GET /metrics` | Метрики приложения (JSON) | Память, счётчики, PG stats, пул |

### Настройка Netdata Cloud

**1. Регистрация**

1. Зайти на https://app.netdata.cloud и создать аккаунт
2. Создать Space (например, "Retro Board")
3. Перейти в Rooms → создать Room (или использовать "General")
4. Нажать "Connect Nodes" → Docker → скопировать `CLAIM_TOKEN` и `CLAIM_ROOMS`

**2. Переменные окружения** — добавить в `.env` на сервере:

```env
NETDATA_CLAIM_TOKEN=your-claim-token-here
NETDATA_CLAIM_ROOMS=your-room-id-here
```

**3. Запуск** — `docker compose -f docker-compose.prod.yml up -d`. Netdata агент автоматически подключится к Cloud, начнёт собирать системные метрики и запустит StatsD сервер на порту 8125.

**4. Алерты** — в Netdata Cloud UI: Alerts → Alert Notifications → добавить Telegram или Email. Алерты на CPU, RAM, диск работают из коробки.

### Кастомные метрики

| Метрика | Тип | Описание |
|---------|-----|----------|
| `retro.board.created` | counter | Создание новой доски |
| `retro.card.created` | counter | Создание новой карточки |

Метрики автоматически появятся в Netdata Cloud → Charts → StatsD.

### Логи

Pino JSON-логирование. Уровень: `LOG_LEVEL` (default: `info`). SvelteKit hooks логируют HTTP >= 400 и медленные запросы (> 1с).

```bash
# Все логи
docker compose -f docker-compose.prod.yml logs app -f

# Только ошибки
docker compose -f docker-compose.prod.yml logs app -f | grep '"level":50'
```

Log rotation: максимум 3 файла по 10MB на контейнер.

### Проверка

```bash
curl http://localhost/health     # Liveness
curl http://localhost/ready      # Readiness (с БД)
curl http://localhost/metrics    # Метрики приложения
```

</details>

## Архитектура

- **Фронтенд**: SvelteKit (Svelte 5 runes), Tailwind CSS 4
- **Бэкенд**: Node.js HTTP-сервер с Socket.IO + SvelteKit handler
- **База данных**: PostgreSQL через Drizzle ORM
- **Мониторинг**: StatsD + Netdata, Pino logging
- **Тесты**: Vitest
- **CI/CD**: GitHub Actions
