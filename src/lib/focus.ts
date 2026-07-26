// Навигация по повестке обсуждения — чистые функции без рун и сокета.
// Повестка приходит из boardStore.getSummaryCards(): колонки по порядку,
// внутри колонки — по лайкам. Фокус привязан к id, а не к позиции: во время
// обсуждения прилетают голоса и порядок едет.

type AgendaCard = { id: string };

export function focusIndex(cards: AgendaCard[], cardId: string | null): number {
	if (!cardId) return -1;
	return cards.findIndex((c) => c.id === cardId);
}

/** Первая карточка, на которой ещё не было фокуса. */
function firstUndiscussed(cards: AgendaCard[], discussed: string[]): string | null {
	const seen = new Set(discussed);
	return cards.find((c) => !seen.has(c.id))?.id ?? null;
}

export function nextCardId(
	cards: AgendaCard[],
	cardId: string | null,
	discussed: string[]
): string | null {
	const i = focusIndex(cards, cardId);
	// Обсуждение ещё не начиналось или текущую карточку удалили —
	// подхватываем повестку с первой непройденной.
	if (i === -1) return firstUndiscussed(cards, discussed);
	return cards[i + 1]?.id ?? null;
}

export function prevCardId(cards: AgendaCard[], cardId: string | null): string | null {
	const i = focusIndex(cards, cardId);
	if (i <= 0) return null;
	return cards[i - 1].id;
}
