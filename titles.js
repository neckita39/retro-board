// Единая проверка имени доски и пространства при переименовании.
// Лежит в корне, как board-formats.js: server.js в проде живёт рядом с build/,
// а src/ в рантайм-образ не копируется (см. Dockerfile).

export const TITLE_MAX = 100;

/**
 * Приводит введённое имя к хранимому виду: обрезает края, схлопывает
 * пробелы. Возвращает null, если имя пустое, не строка или длиннее лимита.
 * @param {unknown} input
 * @returns {string | null}
 */
export function normalizeTitle(input) {
	if (typeof input !== 'string') return null;
	const title = input.replace(/\s+/g, ' ').trim();
	if (!title || title.length > TITLE_MAX) return null;
	return title;
}
