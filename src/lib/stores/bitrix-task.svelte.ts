import { socketStore } from './socket.svelte.js';

// Преформа «В задачу Битрикс24»: одна на доску, открыта для одной карточки.
// Удалённую карточку и чужой card:task отслеживает сама BitrixTaskModal ($effect):
// board.svelte.ts и socket.svelte.ts этот стор не импортируют, иначе цикл
// board.svelte.ts → bitrix-task.svelte.ts → socket.svelte.ts → board.svelte.ts.
class BitrixTaskStore {
	current = $state<{ cardId: string; source: 'card' | 'summary' } | null>(null);
	/** Запрос createTask в пути: модалка не закрывается ни Escape, ни кликом по фону */
	submitting = $state(false);

	open(cardId: string, source: 'card' | 'summary') {
		this.current = { cardId, source };
		this.submitting = false;
		socketStore.trackTaskOpened(source);
	}

	close() {
		this.current = null;
		this.submitting = false;
	}
}

export const bitrixTaskStore = new BitrixTaskStore();
