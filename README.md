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

## Мониторинг

Приложение отправляет метрики через **StatsD** (UDP) и пишет логи через **Pino**.

### Переменные

```
STATSD_HOST=netdata       # хост StatsD-сервера (по умолчанию localhost)
STATSD_PORT=8125          # порт StatsD (по умолчанию 8125)
LOG_LEVEL=info            # уровень логирования: debug, info, warn, error
```

В `docker-compose.prod.yml` уже настроен контейнер **Netdata**. Если хотите добавить мониторинг в свой docker-compose, добавьте:

**1. В секцию `services.app.environment`:**
```yaml
      STATSD_HOST: netdata
      STATSD_PORT: "8125"
```

**2. Новый сервис `netdata`:**
```yaml
  netdata:
    image: netdata/netdata:stable
    volumes:
      - netdataconfig:/etc/netdata
      - netdatalib:/var/lib/netdata
      - netdatacache:/var/cache/netdata
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
    environment:
      - NETDATA_CLAIM_TOKEN=${NETDATA_CLAIM_TOKEN:-}
      - NETDATA_CLAIM_ROOMS=${NETDATA_CLAIM_ROOMS:-}
      - NETDATA_CLAIM_URL=https://app.netdata.cloud
    mem_limit: 150m
    cap_add:
      - SYS_PTRACE
    security_opt:
      - apparmor:unconfined
    restart: unless-stopped
```

**3. В секцию `volumes`:**
```yaml
  netdataconfig:
  netdatalib:
  netdatacache:
```

Netdata собирает StatsD-метрики приложения (`retro.board.created`, `retro.card.created` и др.) и системные метрики (CPU, RAM, диск). Для привязки к Netdata Cloud задайте `NETDATA_CLAIM_TOKEN` и `NETDATA_CLAIM_ROOMS` в `.env`.

### Health check

```
GET /health → 200 OK
```

## Архитектура

- **Фронтенд**: SvelteKit (Svelte 5 runes), Tailwind CSS 4
- **Бэкенд**: Node.js HTTP-сервер с Socket.IO + SvelteKit handler
- **База данных**: PostgreSQL через Drizzle ORM
- **Тесты**: Vitest
- **CI/CD**: GitHub Actions
- **Мониторинг**: StatsD + Netdata, Pino logging
