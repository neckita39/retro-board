import en from './i18n/en.json';

// Тексты панели Битрикс24 на странице пространства. Чистый модуль: тест гоняет
// его без стора локали, компонент берёт ключ и сам зовёт t().

const DICT: Record<string, string> = en;

// Все сбои связи панель называет одной фразой «Портал не отвечает. Попробуйте
// через минуту» (заметка 9 макета). Общий текст timeout говорит «задача не
// создана» — в панели он не к месту, поэтому вид сводим к network до поиска ключа.
const PANEL_ALIAS = new Map<string, string>([
	['timeout', 'network'],
	['shape', 'network'],
	['limit', 'network']
]);

const SUCCESS_KEYS = new Map<string, string>([
	['connect', 'bitrix.panel.connected'],
	['disconnect', 'bitrix.panel.disconnected'],
	['setGroup', 'bitrix.panel.saved']
]);

/** Ключ текста ошибки в панели: bitrix.error.{kind}_panel, если такой есть, иначе bitrix.error.{kind} */
export function panelErrorKey(kind: string): string {
	const base = PANEL_ALIAS.get(kind) ?? kind;
	const panelKey = `bitrix.error.${base}_panel`;
	if (Object.hasOwn(DICT, panelKey)) return panelKey;
	const key = `bitrix.error.${base}`;
	return Object.hasOwn(DICT, key) ? key : 'bitrix.error.network_panel';
}

/** Бейдж на 2,5 с после успешного экшена панели; null — экшен не из панели */
export function panelSuccessKey(action: string | null | undefined): string | null {
	return (action && SUCCESS_KEYS.get(action)) || null;
}
