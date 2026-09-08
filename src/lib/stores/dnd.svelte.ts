// Что сейчас тащат мышью: id карточки и колонка-источник. Стор общий,
// потому что карточка и колонки — разные компоненты, а подсветка цели
// зависит от того, откуда карточку взяли.
import type { ColumnType } from '$lib/types.js';

class DndStore {
	cardId = $state<string | null>(null);
	from = $state<ColumnType | null>(null);

	start(cardId: string, from: ColumnType) {
		this.cardId = cardId;
		this.from = from;
	}

	end() {
		this.cardId = null;
		this.from = null;
	}
}

export const dndStore = new DndStore();
