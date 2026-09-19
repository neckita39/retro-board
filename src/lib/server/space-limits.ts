// Лимиты пространства — in-memory, один процесс (как ratelimit.ts и bitrix-limits.ts).
// Пароль пространства теперь закрывает и доски внутри, то есть стал единственным
// замком на содержимое. Перебор ограничиваем по двум причинам: сам подбор пароля
// и стоимость проверки — verifyPassword считает scrypt, и без лимита форма входа
// превращается в дешёвый способ нагрузить процессор.
import { createRateLimiter, type RateLimiter } from './ratelimit.js';

/** Ввод пароля пространства (форма и доска внутри него): 10 попыток в минуту с IP */
export const spaceVerifyLimiter: RateLimiter = createRateLimiter({ max: 10, windowMs: 60_000 });
