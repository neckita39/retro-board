import { normalizeQuery } from '$lib/search.js';

// Поиск по доске. Живёт только в памяти вкладки: запрос — это то, что человек
// ищет прямо сейчас, а не настройка доски. Ни на сервер, ни в localStorage.
class SearchStore {
	open = $state(false);
	query = $state('');

	/** Поиск считается включённым, только когда в запросе есть что искать */
	get active(): boolean {
		return this.open && normalizeQuery(this.query).length > 0;
	}

	show() {
		this.open = true;
	}

	close() {
		this.open = false;
		this.query = '';
	}

	toggle() {
		if (this.open) this.close();
		else this.show();
	}

	/** Смена доски не должна тащить чужой запрос на новую */
	reset() {
		this.open = false;
		this.query = '';
	}
}

export const searchStore = new SearchStore();
