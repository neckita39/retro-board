import { io, type Socket } from 'socket.io-client';
import { boardStore } from './board.svelte.js';

class SocketStore {
	socket = $state<Socket | null>(null);
	connected = $state(false);
	usersCount = $state(0);
	timerEnd = $state<number | null>(null);
	timerDuration = $state<number | null>(null);

	connect() {
		if (this.socket) return;

		this.socket = io({ transports: ['websocket', 'polling'] });

		this.socket.on('connect', () => {
			this.connected = true;
		});

		this.socket.on('disconnect', () => {
			this.connected = false;
		});

		this.socket.on('board:state', (data) => {
			boardStore.setState(data);
		});

		this.socket.on('card:created', ({ card }) => {
			boardStore.addCard(card);
		});

		this.socket.on('card:updated', ({ card }) => {
			boardStore.updateCard(card);
		});

		this.socket.on('card:deleted', ({ cardId }) => {
			boardStore.removeCard(cardId);
		});

		this.socket.on('vote:toggled', ({ cardId, votes }) => {
			boardStore.setVotes(cardId, votes);
		});

		this.socket.on('comment:created', ({ comment }) => {
			boardStore.addComment(comment);
		});

		this.socket.on('users:count', ({ count }) => {
			this.usersCount = count;
		});

		this.socket.on('timer:state', ({ endTime, duration }) => {
			this.timerEnd = endTime;
			this.timerDuration = duration;
		});
	}

	joinBoard(slug: string, creatorToken?: string | null) {
		this.socket?.emit('board:join', { slug, creatorToken: creatorToken ?? '' });
	}

	createCard(boardId: string, column: string, content: string, authorName?: string, imageId?: string) {
		this.socket?.emit('card:create', { boardId, column, content, authorName, imageId });
	}

	updateCard(cardId: string, content: string, imageId?: string | null) {
		this.socket?.emit('card:update', { cardId, content, imageId });
	}

	deleteCard(cardId: string) {
		this.socket?.emit('card:delete', { cardId });
	}

	startTimer(duration: number, creatorToken?: string | null) {
		this.socket?.emit('timer:start', { duration, creatorToken: creatorToken ?? '' });
	}

	stopTimer(creatorToken?: string | null) {
		this.socket?.emit('timer:stop', { creatorToken: creatorToken ?? '' });
	}

	toggleVote(cardId: string, type: 'like' | 'dislike', sessionId: string) {
		this.socket?.emit('vote:toggle', { cardId, type, sessionId });
	}

	createComment(cardId: string, content: string, authorName?: string, imageId?: string) {
		this.socket?.emit('comment:create', { cardId, content, authorName, imageId });
	}

	disconnect() {
		this.socket?.disconnect();
		this.socket = null;
		this.connected = false;
	}
}

export const socketStore = new SocketStore();
