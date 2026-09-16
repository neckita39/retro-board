// Типизированный вход в titles.js (корень репо) — см. комментарий там.
import { normalizeTitle as normalize, TITLE_MAX } from '../../titles.js';

export { TITLE_MAX };
export const normalizeTitle = normalize as (input: unknown) => string | null;
