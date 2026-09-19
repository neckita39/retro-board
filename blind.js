// Слепой ввод. Пока режим включён, карточку видит только её автор, остальные —
// рубашку: место в колонке остаётся, содержимого нет. Это снимает якорение —
// первый написал «релизы», и дальше все пишут про релизы.
//
// Автор определяется по author_session (тот же идентификатор браузера, что у
// голосов). Наружу он не уходит НИКОГДА, даже своему владельцу: иначе по нему
// можно было бы сгруппировать карточки по авторам и снять анонимность ретро.
//
// Лежит в корне, как board-formats.js и titles.js: server.js в проде живёт
// рядом с build/, а src/ в рантайм-образ не копируется (см. Dockerfile).

/** @param {Record<string, any>} card */
function strip(card) {
	const { authorSession: _drop, ...rest } = card;
	return rest;
}

/**
 * Одна карточка глазами конкретного зрителя.
 *
 * Скрытая карточка сохраняет id, колонку и время создания — чтобы её место
 * в колонке и счётчик «сколько уже написали» были честными, — но теряет текст,
 * автора, картинку и задачу.
 *
 * @param {Record<string, any>} card
 * @param {boolean} blind
 * @param {string} viewerSession
 */
export function viewCard(card, blind, viewerSession) {
	const mine = !!card.authorSession && card.authorSession === viewerSession;
	if (!blind || mine) return strip(card);
	return {
		...strip(card),
		content: '',
		authorName: null,
		imageId: null,
		imageWidth: null,
		imageHeight: null,
		bitrixTaskId: null,
		bitrixTaskUrl: null,
		hidden: true
	};
}

/**
 * @param {Record<string, any>[]} cards
 * @param {boolean} blind
 * @param {string} viewerSession
 */
export function viewCards(cards, blind, viewerSession) {
	return cards.map((c) => viewCard(c, blind, viewerSession));
}

/** @param {{ hidden?: boolean }} card */
export function isHidden(card) {
	return card.hidden === true;
}

/**
 * Комментарии скрытых карточек тоже не отдаём: по ним восстанавливается
 * содержимое рубашки. Возвращаем только те, чья карточка видна.
 *
 * @param {{ cardId: string }[]} comments
 * @param {{ id: string, hidden?: boolean }[]} cards
 */
export function visibleComments(comments, cards) {
	const hidden = new Set(cards.filter(isHidden).map((c) => c.id));
	return comments.filter((c) => !hidden.has(c.cardId));
}
