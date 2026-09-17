import { io, type Socket } from 'socket.io-client';
import { boardStore } from './board.svelte.js';
import { toastStore } from './toast.svelte.js';
import { t } from '$lib/i18n/index.js';
import { analysisTransition, PENDING_STALE_MS, type AnalysisState } from '$lib/analysis-state.js';
import type { CardTask } from '$lib/types.js';

class SocketStore {
	socket = $state<Socket | null>(null);
	connected = $state(false);
	usersCount = $state(0);
	timerEnd = $state<number | null>(null);
	timerDuration = $state<number | null>(null);
	focusCardId = $state<string | null>(null);
	focusEndTime = $state<number | null>(null);
	focusDuration = $state<number | null>(null);
	focusDiscussed = $state<string[]>([]);
	/** Статус AI-анализа текущего пространства; null — пространство не подключено */
	analysis = $state<AnalysisState | null>(null);

	private currentSlug: string | null = null;
	private currentSpace: string | null = null;
	// Растёт на каждом сокет-событии статуса: ответ HTTP, стартовавший раньше
	// события, уже устарел и не должен затирать новое состояние
	private analysisSeq = 0;
	private staleTimer: ReturnType<typeof setTimeout> | undefined;
	private currentCreatorToken = '';
	private everConnected = false;

	connect() {
		if (this.socket) return;

		this.socket = io({ transports: ['websocket', 'polling'] });

		this.socket.on('connect', () => {
			this.connected = true;
			// Re-join the room after a reconnect (deploy, network blip) — the first
			// join is emitted by joinBoard() and buffered by socket.io, so skip it here.
			if (this.everConnected && this.currentSlug) {
				this.socket?.emit('board:join', {
					slug: this.currentSlug,
					creatorToken: this.currentCreatorToken
				});
			}
			if (this.everConnected && this.currentSpace) this.emitSpaceJoin(this.currentSpace);
			this.everConnected = true;
		});

		this.socket.on('disconnect', () => {
			this.connected = false;
		});

		this.socket.on('board:state', (data) => {
			boardStore.setState(data);
		});

		this.socket.on('board:renamed', ({ title }) => {
			boardStore.setTitle(title);
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

		// Задачу Битрикс24 создал ведущий: бейдж появляется у всех без перезагрузки
		this.socket.on('card:task', ({ cardId, task }: { cardId: string; task: CardTask }) => {
			boardStore.setTask(cardId, task);
		});

		this.socket.on('users:count', ({ count }) => {
			this.usersCount = count;
		});

		this.socket.on('timer:state', ({ endTime, duration }) => {
			this.timerEnd = endTime;
			this.timerDuration = duration;
		});

		this.socket.on('focus:state', ({ cardId, endTime, duration, discussed }) => {
			this.focusCardId = cardId ?? null;
			this.focusEndTime = endTime ?? null;
			this.focusDuration = duration ?? null;
			this.focusDiscussed = discussed ?? [];
		});

		this.socket.on('analysis:state', (state: AnalysisState) => {
			this.analysisSeq++;
			this.applyAnalysis(state);
		});
	}

	/** Комната пространства — статус анализа для всех, кто в нём. Первый статус
	 *  добираем по HTTP, но только после подтверждения входа в комнату (ack):
	 *  событие между fetch и join иначе терялось бы. */
	joinSpace(slug: string) {
		this.currentSpace = slug;
		this.emitSpaceJoin(slug);
	}

	private emitSpaceJoin(slug: string) {
		this.socket?.emit('space:join', { slug }, () => {
			if (this.currentSpace === slug) void this.refreshAnalysis();
		});
	}

	async refreshAnalysis() {
		const slug = this.currentSpace;
		if (!slug) return;
		const seq = this.analysisSeq;
		try {
			const res = await fetch(`/spaces/${slug}/analysis`);
			if (!res.ok) return;
			const state = (await res.json()) as AnalysisState;
			// Пока ждали ответ, по сокету могло прийти более свежее состояние
			if (this.currentSpace === slug && this.analysisSeq === seq) this.applyAnalysis(state);
		} catch {
			// сеть моргнула — следующий сокет-ивент или реконнект всё поправят
		}
	}

	/** pending старше 5 минут сервер считает упавшим, но события об этом не будет:
	 *  задача потеряна вместе с процессом. Один отложенный fetch покажет плитку с «Повторить». */
	private scheduleStaleCheck(createdAt: string) {
		clearTimeout(this.staleTimer);
		const delay = new Date(createdAt).getTime() + PENDING_STALE_MS + 1_000 - Date.now();
		this.staleTimer = setTimeout(() => void this.refreshAnalysis(), Math.max(1_000, delay));
	}

	/** Состояние из данных страницы: молча, если ещё ничего не знали */
	seedAnalysis(state: AnalysisState | null) {
		if (!state) return;
		if (this.analysis === null) this.analysis = state;
		else this.applyAnalysis(state);
	}

	applyAnalysis(next: AnalysisState) {
		const prev = this.analysis;
		// Завершённая попытка не возвращается в pending: это запоздавший ответ HTTP
		if (
			next.state === 'pending' &&
			prev &&
			(prev.state === 'ready' || prev.state === 'failed') &&
			prev.id === next.id
		) {
			return;
		}
		const transition = analysisTransition(prev, next);
		this.analysis = next;
		clearTimeout(this.staleTimer);
		if (next.state === 'pending') this.scheduleStaleCheck(next.createdAt);
		if (!transition || next.state === 'idle') return;
		if (transition === 'started') {
			toastStore.push({ kind: 'info', text: t('space.analysis.toast.started', { title: next.title }) });
		} else if (transition === 'ready' && next.state === 'ready') {
			toastStore.push({
				kind: 'success',
				text: t('space.analysis.toast.ready', { title: next.title }),
				action: { label: t('space.analysis.toast.open'), href: `/${next.board.slug}` }
			});
		} else if (transition === 'failed' && next.state === 'failed') {
			toastStore.push({ kind: 'error', text: t(`space.analysis.error.${next.error}`) });
		}
	}

	joinBoard(slug: string, creatorToken?: string | null) {
		// Переход с доски на доску не перемонтирует страницу: сбрасываем состояние
		// прошлой комнаты, сервер пришлёт свежее сразу после входа
		if (this.currentSlug && this.currentSlug !== slug) {
			this.usersCount = 0;
			this.timerEnd = null;
			this.timerDuration = null;
			this.focusCardId = null;
			this.focusEndTime = null;
			this.focusDuration = null;
			this.focusDiscussed = [];
		}
		this.currentSlug = slug;
		this.currentCreatorToken = creatorToken ?? '';
		this.socket?.emit('board:join', { slug, creatorToken: creatorToken ?? '' });
	}

	clearTimerLocal() {
		this.timerEnd = null;
		this.timerDuration = null;
	}

	createCard(boardId: string, column: string, content: string, authorName?: string, imageId?: string) {
		this.socket?.emit('card:create', { boardId, column, content, authorName, imageId });
	}

	updateCard(cardId: string, content: string, imageId?: string | null) {
		this.socket?.emit('card:update', { cardId, content, imageId });
	}

	moveCard(cardId: string, columnType: string) {
		this.socket?.emit('card:update', { cardId, columnType });
	}

	deleteCard(cardId: string) {
		this.socket?.emit('card:delete', { cardId });
	}

	renameBoard(title: string, creatorToken?: string | null) {
		this.socket?.emit('board:rename', { title, creatorToken: creatorToken ?? '' });
	}

	startTimer(duration: number, creatorToken?: string | null) {
		this.socket?.emit('timer:start', { duration, creatorToken: creatorToken ?? '' });
	}

	stopTimer(creatorToken?: string | null) {
		this.socket?.emit('timer:stop', { creatorToken: creatorToken ?? '' });
	}

	startFocus(cardId: string, creatorToken?: string | null) {
		this.socket?.emit('focus:start', { cardId, creatorToken: creatorToken ?? '' });
	}

	setFocus(cardId: string, creatorToken?: string | null) {
		this.socket?.emit('focus:set', { cardId, creatorToken: creatorToken ?? '' });
	}

	stopFocus(creatorToken?: string | null) {
		this.socket?.emit('focus:stop', { creatorToken: creatorToken ?? '' });
	}

	toggleVote(cardId: string, type: 'like' | 'dislike', sessionId: string) {
		this.socket?.emit('vote:toggle', { cardId, type, sessionId });
	}

	createComment(cardId: string, content: string, authorName?: string, imageId?: string) {
		this.socket?.emit('comment:create', { cardId, content, authorName, imageId });
	}

	/** Счётчик открытий преформы задачи. Токен тот же, что ушёл в board:join, —
	 *  сервер считает только создателя комнаты и только известный source */
	trackTaskOpened(source: 'card' | 'summary') {
		this.socket?.emit('bitrix:opened', { source, creatorToken: this.currentCreatorToken });
	}

	disconnect() {
		this.socket?.disconnect();
		this.socket = null;
		this.connected = false;
		this.currentSlug = null;
		this.currentCreatorToken = '';
		this.currentSpace = null;
		this.analysis = null;
		clearTimeout(this.staleTimer);
		this.everConnected = false;
		this.timerEnd = null;
		this.timerDuration = null;
		this.focusCardId = null;
		this.focusEndTime = null;
		this.focusDuration = null;
		this.focusDiscussed = [];
	}
}

export const socketStore = new SocketStore();
