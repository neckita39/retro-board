/**
 * Пресеты форматов доски. Единственный источник правды о колонках.
 *
 * Лежит в корне рядом с seo-paths.js по той же причине: server.js работает
 * в рантайм-образе без src/, а колонки ему нужны, чтобы отсекать карточки
 * в несуществующей колонке. Отсюда реестр читают server.js, src/lib/formats.ts
 * и экспорт — разъехаться им негде.
 *
 * Id формата совпадает со slug страницы /formats/<slug>: ссылка «Создать
 * доску в этом формате» ведёт на /new?format=<slug> без таблицы соответствий.
 * Формат фиксируется при создании доски и не меняется.
 */

export const DEFAULT_FORMAT = 'classic';

/**
 * @typedef {{ en: string, ru: string }} Localized
 * Тон колонки — только семантика цвета: well/bad/improve — зелёный/красный/синий,
 * plum — сливовый для четвёртой колонки (4L, Sailboat). Терракота (accent) колонкам
 * не достаётся: она за главным действием на экране.
 * @typedef {'well' | 'bad' | 'improve' | 'plum'} Tone
 * @typedef {{ id: string, tone: Tone, title: Localized, short: Localized }} BoardColumn
 * @typedef {{ id: string, hidden?: boolean, columns: BoardColumn[] }} BoardFormat
 */

/** @type {BoardFormat[]} */
export const BOARD_FORMATS = [
	{
		id: 'classic',
		columns: [
			{ id: 'went_well', tone: 'well', title: { en: 'Went Well', ru: 'Прошло хорошо' }, short: { en: 'Good', ru: 'Хорошо' } },
			{ id: 'didnt_go_well', tone: 'bad', title: { en: "Didn't Go Well", ru: 'Не получилось' }, short: { en: 'Bad', ru: 'Плохо' } },
			{ id: 'improve', tone: 'improve', title: { en: 'To Improve', ru: 'Улучшить' }, short: { en: 'Improve', ru: 'Улучшить' } }
		]
	},
	{
		id: 'start-stop-continue',
		columns: [
			{ id: 'start', tone: 'improve', title: { en: 'Start', ru: 'Начать' }, short: { en: 'Start', ru: 'Начать' } },
			{ id: 'stop', tone: 'bad', title: { en: 'Stop', ru: 'Прекратить' }, short: { en: 'Stop', ru: 'Стоп' } },
			{ id: 'continue', tone: 'well', title: { en: 'Continue', ru: 'Продолжить' }, short: { en: 'Continue', ru: 'Дальше' } }
		]
	},
	{
		id: 'mad-sad-glad',
		columns: [
			{ id: 'mad', tone: 'bad', title: { en: 'Mad', ru: 'Злит' }, short: { en: 'Mad', ru: 'Злит' } },
			{ id: 'sad', tone: 'improve', title: { en: 'Sad', ru: 'Огорчает' }, short: { en: 'Sad', ru: 'Грустно' } },
			{ id: 'glad', tone: 'well', title: { en: 'Glad', ru: 'Радует' }, short: { en: 'Glad', ru: 'Радует' } }
		]
	},
	{
		id: '4l',
		columns: [
			{ id: 'liked', tone: 'well', title: { en: 'Liked', ru: 'Понравилось' }, short: { en: 'Liked', ru: 'Нравится' } },
			{ id: 'learned', tone: 'improve', title: { en: 'Learned', ru: 'Узнали' }, short: { en: 'Learned', ru: 'Узнали' } },
			{ id: 'lacked', tone: 'bad', title: { en: 'Lacked', ru: 'Не хватило' }, short: { en: 'Lacked', ru: 'Не хватило' } },
			{ id: 'longed', tone: 'plum', title: { en: 'Longed for', ru: 'Хотелось бы' }, short: { en: 'Longed', ru: 'Хотелось' } }
		]
	},
	{
		id: 'sailboat',
		columns: [
			{ id: 'wind', tone: 'well', title: { en: 'Wind', ru: 'Ветер' }, short: { en: 'Wind', ru: 'Ветер' } },
			{ id: 'anchors', tone: 'bad', title: { en: 'Anchors', ru: 'Якоря' }, short: { en: 'Anchors', ru: 'Якоря' } },
			{ id: 'rocks', tone: 'improve', title: { en: 'Rocks', ru: 'Рифы' }, short: { en: 'Rocks', ru: 'Рифы' } },
			{ id: 'island', tone: 'plum', title: { en: 'Island', ru: 'Остров' }, short: { en: 'Island', ru: 'Остров' } }
		]
	},
	{
		// Доска-анализ пространства: создаётся сервером, в пикерах не показывается
		id: 'analysis',
		hidden: true,
		columns: [
			{ id: 'again_well', tone: 'well', title: { en: 'Still good', ru: 'Снова хорошо' }, short: { en: 'Good', ru: 'Хорошо' } },
			{ id: 'again_bad', tone: 'bad', title: { en: 'Still bad', ru: 'Снова плохо' }, short: { en: 'Bad', ru: 'Плохо' } },
			{ id: 'again_improve', tone: 'improve', title: { en: 'Still to improve', ru: 'Снова стоит улучшить' }, short: { en: 'Improve', ru: 'Улучшить' } }
		]
	}
];

export const ANALYSIS_FORMAT = 'analysis';

/** Форматы, которые можно выбрать руками. Скрытые (analysis) создаёт только сервер. */
export const VISIBLE_FORMATS = BOARD_FORMATS.filter((f) => !f.hidden);

/**
 * Неизвестный или пустой id — classic: так старые доски и любой мусор
 * в запросе получают рабочую доску, а не пустой экран.
 * @param {string | null | undefined} id
 * @returns {BoardFormat}
 */
export function findBoardFormat(id) {
	return BOARD_FORMATS.find((f) => f.id === id) ?? BOARD_FORMATS[0];
}

/** Принимает только видимые форматы: скрытые нельзя создать через форму. @param {unknown} id */
export function isValidFormat(id) {
	return typeof id === 'string' && VISIBLE_FORMATS.some((f) => f.id === id);
}

/**
 * @param {string} formatId
 * @param {unknown} columnId
 */
export function isValidColumn(formatId, columnId) {
	return findBoardFormat(formatId).columns.some((c) => c.id === columnId);
}
