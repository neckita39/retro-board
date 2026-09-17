import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

// Настоящий socket.io-client полез бы в сеть: подменяем io() сокетом,
// который запоминает обработчики и отправленные события
const fake = vi.hoisted(() => {
	const handlers = new Map<string, (payload: unknown) => void>();
	return {
		handlers,
		socket: {
			on: (event: string, handler: (payload: unknown) => void) => {
				handlers.set(event, handler);
			},
			emit: vi.fn(),
			disconnect: vi.fn()
		}
	};
});
vi.mock('socket.io-client', () => ({ io: () => fake.socket }));

import { socketStore } from './socket.svelte.js';
import { boardStore } from './board.svelte.js';
import type { Card } from '$lib/types.js';

const card: Card = {
	id: 'c1',
	boardId: 'b1',
	columnType: 'went_well',
	content: 'Созвоны по часу',
	authorName: null,
	imageId: null,
	imageWidth: null,
	imageHeight: null,
	createdAt: '2025-01-01T00:00:00Z',
	bitrixTaskId: null,
	bitrixTaskUrl: null
};

beforeEach(() => {
	fake.handlers.clear();
	fake.socket.emit.mockClear();
	boardStore.setState({
		board: { id: 'b1', slug: 'brd', title: 'Ретро', format: 'classic', createdAt: '2025-01-01T00:00:00Z' },
		cards: [card],
		votes: [],
		comments: []
	});
	socketStore.connect();
});

afterEach(() => {
	socketStore.disconnect();
});

describe('socketStore — Битрикс24', () => {
	it('card:task от сервера проставляет задачу карточке', () => {
		const task = { id: 745181, url: 'https://portal.bitrix24.ru/workgroups/group/2014/tasks/task/view/745181/' };
		const onTask = fake.handlers.get('card:task');
		expect(onTask).toBeDefined();
		onTask!({ cardId: 'c1', task });
		expect(boardStore.cards[0]).toMatchObject({ bitrixTaskId: 745181, bitrixTaskUrl: task.url });
	});

	it('trackTaskOpened шлёт bitrix:opened с источником и токеном создателя из board:join', () => {
		socketStore.joinBoard('brd', 'creator-token');
		fake.socket.emit.mockClear();

		socketStore.trackTaskOpened('summary');

		expect(fake.socket.emit).toHaveBeenCalledWith('bitrix:opened', { source: 'summary', creatorToken: 'creator-token' });
	});

	it('trackTaskOpened без токена создателя шлёт пустую строку — сервер сам отбросит', () => {
		socketStore.joinBoard('brd', null);
		fake.socket.emit.mockClear();

		socketStore.trackTaskOpened('card');

		expect(fake.socket.emit).toHaveBeenCalledWith('bitrix:opened', { source: 'card', creatorToken: '' });
	});
});
