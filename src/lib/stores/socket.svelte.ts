import { io, type Socket } from 'socket.io-client';
import { boardStore } from './board.svelte.js';
import { getSessionToken, setSessionToken, getLegacySessionId } from '$lib/session.js';
import { encryptIfKeyed, decryptIfKeyed, hasKey } from '$lib/crypto.js';
import type { Card, Comment, BoardState } from '$lib/types.js';

async function decryptCard(card: Card): Promise<Card> {
	return {
		...card,
		content: await decryptIfKeyed(card.content),
		authorName: card.authorName ? await decryptIfKeyed(card.authorName) : null
	};
}

async function decryptComment(comment: Comment): Promise<Comment> {
	return {
		...comment,
		content: await decryptIfKeyed(comment.content),
		authorName: comment.authorName ? await decryptIfKeyed(comment.authorName) : null
	};
}

class SocketStore {
	socket = $state<Socket | null>(null);
	connected = $state(false);
	usersCount = $state(0);
	timerEnd = $state<number | null>(null);
	timerDuration = $state<number | null>(null);

	connect() {
		if (this.socket) return;

		const token = getSessionToken();
		const legacySessionId = getLegacySessionId();

		this.socket = io({
			transports: ['websocket', 'polling'],
			auth: { token, legacySessionId }
		});

		this.socket.on('connect', () => {
			this.connected = true;
		});

		this.socket.on('disconnect', () => {
			this.connected = false;
		});

		this.socket.on('session:init', ({ token }: { token: string }) => {
			setSessionToken(token);
		});

		this.socket.on('board:state', async (data: BoardState) => {
			const cards = await Promise.all(data.cards.map(decryptCard));
			const comments = await Promise.all(data.comments.map(decryptComment));
			boardStore.setState({ ...data, cards, comments });
		});

		this.socket.on('card:created', async ({ card }: { card: Card }) => {
			boardStore.addCard(await decryptCard(card));
		});

		this.socket.on('card:updated', async ({ card }: { card: Card }) => {
			boardStore.updateCard(await decryptCard(card));
		});

		this.socket.on('card:deleted', ({ cardId }: { cardId: string }) => {
			boardStore.removeCard(cardId);
		});

		this.socket.on('vote:toggled', ({ cardId, votes }: { cardId: string; votes: any[] }) => {
			boardStore.setVotes(cardId, votes);
		});

		this.socket.on('comment:created', async ({ comment }: { comment: Comment }) => {
			boardStore.addComment(await decryptComment(comment));
		});

		this.socket.on('users:count', ({ count }: { count: number }) => {
			this.usersCount = count;
		});

		this.socket.on('timer:state', ({ endTime, duration }: { endTime: number | null; duration: number | null }) => {
			this.timerEnd = endTime;
			this.timerDuration = duration;
		});
	}

	joinBoard(slug: string) {
		this.socket?.emit('board:join', { slug });
	}

	async createCard(boardId: string, column: string, content: string, authorName?: string) {
		this.socket?.emit('card:create', {
			boardId,
			column,
			content: await encryptIfKeyed(content),
			authorName: authorName ? await encryptIfKeyed(authorName) : undefined
		});
	}

	async updateCard(cardId: string, content: string) {
		this.socket?.emit('card:update', {
			cardId,
			content: await encryptIfKeyed(content)
		});
	}

	deleteCard(cardId: string) {
		this.socket?.emit('card:delete', { cardId });
	}

	startTimer(duration: number) {
		this.socket?.emit('timer:start', { duration });
	}

	stopTimer() {
		this.socket?.emit('timer:stop');
	}

	toggleVote(cardId: string, type: 'like' | 'dislike') {
		this.socket?.emit('vote:toggle', { cardId, type });
	}

	async createComment(cardId: string, content: string, authorName?: string) {
		this.socket?.emit('comment:create', {
			cardId,
			content: await encryptIfKeyed(content),
			authorName: authorName ? await encryptIfKeyed(authorName) : undefined
		});
	}

	disconnect() {
		this.socket?.disconnect();
		this.socket = null;
		this.connected = false;
	}
}

export const socketStore = new SocketStore();
