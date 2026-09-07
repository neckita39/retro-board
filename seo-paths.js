/**
 * Единый список страниц, открытых поисковикам.
 *
 * Лежит в корне, а не в src/, намеренно: server.js работает в продакшене рядом
 * с build/, и папку src/ в рантайм-образ не копируют (см. Dockerfile). Импорт
 * из src/ уронил бы контейнер на старте. Отсюда список читают все трое —
 * server.js, sitemap.xml и robots-тест, — поэтому разъехаться они не могут.
 *
 * Доски /{slug} и пространства /spaces/* сюда не попадают никогда: они защищены
 * только неугадываемой ссылкой, а утёкшую в индекс ретроспективу уже не отозвать.
 */

export const SITE = 'https://retrospectrix.ru';

/** @type {string[]} Пути, которые можно индексировать. */
export const INDEXABLE_PATHS = [
	'/',
	'/formats',
	'/formats/start-stop-continue',
	'/formats/mad-sad-glad',
	'/formats/4l',
	'/formats/sailboat',
	'/how-to-run-a-retro',
	'/changelog',
	'/api'
];

/**
 * Файлы, которым noindex не нужен: краулер по ним и ходит. Файлы верификации
 * Google и Яндекса тоже здесь — их периодически перепроверяют, и лишний
 * заголовок в этот момент только повод для ложной диагностики.
 * @type {string[]}
 */
export const CRAWLER_FILES = [
	'/robots.txt',
	'/sitemap.xml',
	'/google55ffc062319d38bd.html',
	'/yandex_f733dfd3901e361e.html'
];

/**
 * Отдавать ли странице noindex. Хвостовой слэш нормализуем: /formats/ и
 * /formats — один и тот же адрес, а промахнуться тут значит закрыть страницу.
 * @param {string} pathname
 * @returns {boolean}
 */
export function isIndexable(pathname) {
	const clean = pathname.split('?')[0].split('#')[0];
	const path = clean.length > 1 ? clean.replace(/\/+$/, '') || '/' : clean;
	return INDEXABLE_PATHS.includes(path) || CRAWLER_FILES.includes(path);
}
