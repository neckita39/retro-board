// Мост SvelteKit → Socket.IO. Сокет-сервер живёт в server.js в том же процессе
// и кладёт EventEmitter в globalThis; здесь мы только кидаем в него события.
// В npm run dev шины нет — события молча теряются.
export interface SpaceBusMessage {
	spaceSlug: string;
	event: string;
	payload: unknown;
}

interface Bus {
	emit(name: 'space', msg: SpaceBusMessage): unknown;
}

export function emitSpace(spaceSlug: string, event: string, payload: unknown): boolean {
	const bus = (globalThis as { __retroBus?: Bus }).__retroBus;
	if (!bus) return false;
	bus.emit('space', { spaceSlug, event, payload });
	return true;
}
