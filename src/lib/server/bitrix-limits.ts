// Лимиты интеграции с Битрикс24 — in-memory, один процесс (как ratelimit.ts).
// Подключение ограничено до любого исходящего вызова: сервер не должен стать
// прокси для перебора чужих вебхуков. Проверка группы — общий лимитер экшена
// bitrixSetGroup и GET /[slug]/bitrix/group.
import { createRateLimiter, type RateLimiter } from './ratelimit.js';

/** Подключение вебхука: 5 попыток в минуту с IP */
export const connectLimiter: RateLimiter = createRateLimiter({ max: 5, windowMs: 60_000 });
/** Проверка группы (панель и преформа): 30 в минуту с IP */
export const groupLimiter: RateLimiter = createRateLimiter({ max: 30, windowMs: 60_000 });
/** Создание задачи: 10 в минуту с IP */
export const createIpLimiter: RateLimiter = createRateLimiter({ max: 10, windowMs: 60_000 });
/** Создание задачи: 30 в час на пространство, ключ `space:${spaceId}` */
export const createSpaceLimiter: RateLimiter = createRateLimiter({ max: 30, windowMs: 3_600_000 });

/** Карточки, для которых прямо сейчас идёт создание задачи (409 running) */
export const runningCards = new Set<string>();
