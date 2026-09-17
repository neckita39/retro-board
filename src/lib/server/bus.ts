// Мост SvelteKit → Socket.IO. Сокет-сервер живёт в server.js в том же процессе
// и кладёт EventEmitter в globalThis; здесь мы только кидаем в него события.
// В npm run dev шины нет — события молча теряются.
export interface SpaceBusMessage {
	spaceSlug: string;
	event: string;
	payload: unknown;
}

// Комната доски в server.js называется её slug (socket.join(slug) в board:join)
interface BoardBusMessage {
	boardSlug: string;
	event: string;
	payload: unknown;
}

interface Bus {
	emit(name: 'space', msg: SpaceBusMessage): unknown;
	emit(name: 'board', msg: BoardBusMessage): unknown;
}

function currentBus(): Bus | undefined {
	return (globalThis as { __retroBus?: Bus }).__retroBus;
}

export function emitSpace(spaceSlug: string, event: string, payload: unknown): boolean {
	const bus = currentBus();
	if (!bus) return false;
	bus.emit('space', { spaceSlug, event, payload });
	return true;
}

/** Событие всем, кто сейчас на доске: server.js ретранслирует канал board в комнату boardSlug */
export function emitBoard(boardSlug: string, event: string, payload: unknown): boolean {
	const bus = currentBus();
	if (!bus) return false;
	bus.emit('board', { boardSlug, event, payload });
	return true;
}
