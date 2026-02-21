# Мониторинг Retro Board

## Архитектура

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

## Эндпоинты

| Эндпоинт | Назначение | Пример |
|----------|------------|--------|
| `GET /health` | Liveness-проверка (без БД) | `{"status":"ok","uptime":123.4,"wsConnections":2}` |
| `GET /ready` | Readiness-проверка (с БД) | `{"status":"ready","db":"ok"}` |
| `GET /metrics` | Метрики приложения (JSON) | Память, счётчики, PG stats, пул |

## Настройка Netdata Cloud

### 1. Регистрация

1. Зайти на https://app.netdata.cloud и создать аккаунт
2. Создать Space (например, "Retro Board")
3. Перейти в Rooms → создать Room (или использовать "General")
4. Нажать "Connect Nodes" → Docker → скопировать `CLAIM_TOKEN` и `CLAIM_ROOMS`

### 2. Переменные окружения

Добавить в `.env` на сервере:

```env
NETDATA_CLAIM_TOKEN=your-claim-token-here
NETDATA_CLAIM_ROOMS=your-room-id-here
```

### 3. Запуск

```bash
docker compose -f docker-compose.prod.yml up -d
```

Netdata агент автоматически:
- Подключится к Netdata Cloud через исходящее соединение
- Начнёт собирать системные метрики (CPU, RAM, диск, сеть)
- Запустит StatsD сервер на порту 8125 (доступен только внутри Docker-сети)

### 4. Настройка алертов

В Netdata Cloud UI:
1. Перейти в **Alerts** → **Alert Notifications**
2. Добавить канал: **Telegram** или **Email**
3. Для Telegram: создать бота через @BotFather, получить токен и chat_id
4. Алерты на системные метрики (CPU, RAM, диск) работают из коробки

### 5. Кастомные health-check алерты

Для мониторинга доступности приложения через `/health` и `/ready` — настроить HTTP check в Netdata Cloud или использовать внешний сервис (UptimeRobot, Healthchecks.io).

## Кастомные метрики

Приложение отправляет StatsD-метрики:

| Метрика | Тип | Описание |
|---------|-----|----------|
| `retro.board.created` | counter | Создание новой доски |
| `retro.card.created` | counter | Создание новой карточки |

Эти метрики автоматически появятся в Netdata Cloud → Charts → StatsD.

## Логи

Приложение использует Pino для структурированного JSON-логирования. Уровень задаётся через `LOG_LEVEL` (default: `info`).

SvelteKit hooks логируют:
- HTTP ответы с кодом >= 400 (4xx, 5xx)
- Медленные запросы (> 1 секунды)

Просмотр логов:

```bash
# Все логи приложения
docker compose -f docker-compose.prod.yml logs app -f

# Только ошибки (grep по JSON)
docker compose -f docker-compose.prod.yml logs app -f | grep '"level":50'
```

Log rotation настроен: максимум 3 файла по 10MB на контейнер.

## Проверка работоспособности

```bash
# Liveness
curl http://localhost/health

# Readiness (с проверкой БД)
curl http://localhost/ready

# Метрики приложения
curl http://localhost/metrics

# Docker healthcheck статус
docker inspect --format='{{.State.Health.Status}}' retro-app-1
```
