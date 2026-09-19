// Поиск по доске. Совпадения подсвечиваются, остальные карточки гаснут —
// карточка не исчезает, потому что на ретро важно видеть, где она лежит
// и сколько всего в колонке.
//
// Ищем по тексту карточки, имени автора и тексту комментариев: обсуждение
// часто уходит в комментарии, и «где мы говорили про флаки-тесты» должно
// находиться именно там.

/** Регистр не важен, ё и е — одна буква, лишние пробелы не мешают */
export function normalizeQuery(raw: string): string {
	return raw.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function haystack(parts: (string | null | undefined)[]): string {
	return normalizeQuery(parts.filter(Boolean).join(' '));
}

export interface SearchableCard {
	content: string;
	authorName?: string | null;
}

export interface SearchableComment {
	content: string;
	authorName?: string | null;
}

/**
 * Подходит ли карточка под запрос. Пустой запрос подходит всем — поиск
 * выключен, и гасить нечего.
 *
 * Каждое слово запроса должно найтись, но не обязательно подряд: «флаки тесты»
 * находит «тесты стали флаки». Совпадением считается вхождение подстроки,
 * поэтому «тест» находит и «тесты», и «тестирование».
 */
export function cardMatches(
	card: SearchableCard,
	comments: SearchableComment[],
	query: string
): boolean {
	const q = normalizeQuery(query);
	if (!q) return true;
	const text = haystack([
		card.content,
		card.authorName,
		...comments.flatMap((c) => [c.content, c.authorName])
	]);
	return q.split(' ').every((word) => text.includes(word));
}
