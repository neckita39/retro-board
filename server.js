import { handler } from './build/handler.js';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import crypto from 'crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, inArray } from 'drizzle-orm';
import {
	pgTable,
	uuid,
	text,
	timestamp,
	pgEnum,
	unique
} from 'drizzle-orm/pg-core';

// --- Schema (duplicated for standalone server) ---
const columnTypeEnum = pgEnum('column_type', ['went_well', 'didnt_go_well', 'improve']);
const voteTypeEnum = pgEnum('vote_type', ['like', 'dislike']);

const boards = pgTable('boards', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: text('slug').notNull().unique(),
	title: text('title').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

const cards = pgTable('cards', {
	id: uuid('id').primaryKey().defaultRandom(),
	boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
	columnType: columnTypeEnum('column_type').notNull(),
	content: text('content').notNull(),
	authorName: text('author_name'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

const votes = pgTable(
	'votes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
		type: voteTypeEnum('type').notNull(),
		sessionId: text('session_id').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [unique().on(t.cardId, t.sessionId, t.type)]
);

const comments = pgTable('comments', {
	id: uuid('id').primaryKey().defaultRandom(),
	cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
	content: text('content').notNull(),
	authorName: text('author_name'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

const schema = { boards, cards, votes, comments };

// --- DB ---
const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL || 'postgresql://retro:retro@localhost:5432/retro'
});
const db = drizzle(pool, { schema });

// --- Signed sessions ---
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function signSession(id) {
	const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(id).digest();
	const sig = hmac.toString('base64url');
	return `${id}.${sig}`;
}

function verifySession(token) {
	if (!token || typeof token !== 'string') return null;
	const dotIdx = token.indexOf('.');
	if (dotIdx === -1) return null;
	const id = token.slice(0, dotIdx);
	const sig = token.slice(dotIdx + 1);
	const expected = crypto.createHmac('sha256', SESSION_SECRET).update(id).digest('base64url');
	if (sig.length !== expected.length) return null;
	if (!crypto.timingSafeCompare(Buffer.from(sig), Buffer.from(expected))) return null;
	return id;
}

// --- Input validation ---
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_COLUMNS = ['went_well', 'didnt_go_well', 'improve'];
const VALID_VOTE_TYPES = ['like', 'dislike'];
const MAX_CONTENT_LEN = 5000;
const MAX_AUTHOR_LEN = 100;

function isValidUUID(v) {
	return typeof v === 'string' && UUID_RE.test(v);
}

function isValidString(v, maxLen) {
	return typeof v === 'string' && v.length > 0 && v.length <= maxLen;
}

// --- Rate limiting ---
const RATE_LIMITS = {
	'card:create': { max: 30, windowMs: 60_000 },
	'card:update': { max: 60, windowMs: 60_000 },
	'card:delete': { max: 30, windowMs: 60_000 },
	'vote:toggle': { max: 60, windowMs: 60_000 },
	'comment:create': { max: 30, windowMs: 60_000 },
	'timer:start': { max: 10, windowMs: 60_000 },
	'timer:stop': { max: 10, windowMs: 60_000 }
};

function checkRateLimit(socket, event) {
	const limit = RATE_LIMITS[event];
	if (!limit) return true;

	if (!socket.data.rateLimits) socket.data.rateLimits = {};
	const now = Date.now();
	let bucket = socket.data.rateLimits[event];

	if (!bucket || now - bucket.windowStart > limit.windowMs) {
		bucket = { windowStart: now, count: 0 };
		socket.data.rateLimits[event] = bucket;
	}

	bucket.count++;
	if (bucket.count > limit.max) {
		socket.emit('error', { message: `Rate limit exceeded for ${event}` });
		return false;
	}
	return true;
}

// --- HTTP + Socket.IO ---
const origin = process.env.ORIGIN || undefined;

const httpServer = createServer((req, res) => {
	// Security headers
	res.setHeader('X-Robots-Tag', 'noindex, nofollow');
	res.setHeader('X-Frame-Options', 'DENY');
	res.setHeader('X-Content-Type-Options', 'nosniff');
	handler(req, res);
});

const io = new SocketIOServer(httpServer, {
	cors: { origin: origin || '*' }
});

const roomUsers = new Map();
const roomTimers = new Map();

io.on('connection', (socket) => {
	let currentRoom = null;

	// --- Session handshake ---
	const token = socket.handshake.auth?.token;
	const legacyId = socket.handshake.auth?.legacySessionId;
	let sessionId = verifySession(token);

	if (!sessionId && legacyId && typeof legacyId === 'string' && legacyId.length <= 64) {
		sessionId = legacyId;
	}

	if (!sessionId) {
		sessionId = crypto.randomUUID();
	}

	socket.data.sessionId = sessionId;
	socket.emit('session:init', { token: signSession(sessionId) });

	socket.on('board:join', async ({ slug }) => {
		if (typeof slug !== 'string' || slug.length === 0 || slug.length > 100) return;

		if (currentRoom) {
			socket.leave(currentRoom);
			const users = roomUsers.get(currentRoom);
			if (users) {
				users.delete(socket.id);
				io.to(currentRoom).emit('users:count', { count: users.size });
			}
		}

		currentRoom = slug;
		socket.join(slug);

		if (!roomUsers.has(slug)) roomUsers.set(slug, new Set());
		roomUsers.get(slug).add(socket.id);
		io.to(slug).emit('users:count', { count: roomUsers.get(slug).size });

		try {
			const board = await db.query.boards.findFirst({
				where: eq(boards.slug, slug)
			});
			if (!board) return;

			const boardCards = await db.query.cards.findMany({
				where: eq(cards.boardId, board.id)
			});

			const cardIds = boardCards.map((c) => c.id);
			let boardVotes = [];
			let boardComments = [];

			if (cardIds.length > 0) {
				[boardVotes, boardComments] = await Promise.all([
					db.select().from(votes).where(inArray(votes.cardId, cardIds)),
					db.select().from(comments).where(inArray(comments.cardId, cardIds))
				]);
			}

			socket.emit('board:state', {
				board,
				cards: boardCards,
				votes: boardVotes,
				comments: boardComments
			});

			const timer = roomTimers.get(slug);
			if (timer && timer.endTime > Date.now()) {
				socket.emit('timer:state', timer);
			}
		} catch (err) {
			console.error('Error loading board state:', err);
		}
	});

	socket.on('card:create', async ({ boardId, column, content, authorName }) => {
		if (!checkRateLimit(socket, 'card:create')) return;
		if (!isValidUUID(boardId)) return;
		if (!VALID_COLUMNS.includes(column)) return;
		if (!isValidString(content, MAX_CONTENT_LEN)) return;
		if (authorName != null && !isValidString(authorName, MAX_AUTHOR_LEN)) return;

		try {
			const [card] = await db
				.insert(cards)
				.values({ boardId, columnType: column, content, authorName: authorName || null })
				.returning();
			if (currentRoom) io.to(currentRoom).emit('card:created', { card });
		} catch (err) {
			console.error('Error creating card:', err);
		}
	});

	socket.on('card:update', async ({ cardId, content }) => {
		if (!checkRateLimit(socket, 'card:update')) return;
		if (!isValidUUID(cardId)) return;
		if (!isValidString(content, MAX_CONTENT_LEN)) return;

		try {
			const [card] = await db
				.update(cards)
				.set({ content })
				.where(eq(cards.id, cardId))
				.returning();
			if (currentRoom) io.to(currentRoom).emit('card:updated', { card });
		} catch (err) {
			console.error('Error updating card:', err);
		}
	});

	socket.on('card:delete', async ({ cardId }) => {
		if (!checkRateLimit(socket, 'card:delete')) return;
		if (!isValidUUID(cardId)) return;

		try {
			await db.delete(cards).where(eq(cards.id, cardId));
			if (currentRoom) io.to(currentRoom).emit('card:deleted', { cardId });
		} catch (err) {
			console.error('Error deleting card:', err);
		}
	});

	socket.on('vote:toggle', async ({ cardId, type }) => {
		if (!checkRateLimit(socket, 'vote:toggle')) return;
		if (!isValidUUID(cardId)) return;
		if (!VALID_VOTE_TYPES.includes(type)) return;

		const sid = socket.data.sessionId;

		try {
			const existing = await db.query.votes.findFirst({
				where: and(eq(votes.cardId, cardId), eq(votes.sessionId, sid), eq(votes.type, type))
			});

			if (existing) {
				await db.delete(votes).where(eq(votes.id, existing.id));
			} else {
				await db.insert(votes).values({ cardId, type, sessionId: sid });
			}

			const cardVotes = await db.query.votes.findMany({
				where: eq(votes.cardId, cardId)
			});

			if (currentRoom) io.to(currentRoom).emit('vote:toggled', { cardId, votes: cardVotes });
		} catch (err) {
			console.error('Error toggling vote:', err);
		}
	});

	socket.on('comment:create', async ({ cardId, content, authorName }) => {
		if (!checkRateLimit(socket, 'comment:create')) return;
		if (!isValidUUID(cardId)) return;
		if (!isValidString(content, MAX_CONTENT_LEN)) return;
		if (authorName != null && !isValidString(authorName, MAX_AUTHOR_LEN)) return;

		try {
			const [comment] = await db
				.insert(comments)
				.values({ cardId, content, authorName: authorName || null })
				.returning();
			if (currentRoom) io.to(currentRoom).emit('comment:created', { comment });
		} catch (err) {
			console.error('Error creating comment:', err);
		}
	});

	socket.on('timer:start', ({ duration }) => {
		if (!checkRateLimit(socket, 'timer:start')) return;
		if (typeof duration !== 'number' || duration <= 0 || duration > 3600) return;
		if (!currentRoom) return;
		const endTime = Date.now() + duration * 1000;
		roomTimers.set(currentRoom, { endTime, duration });
		io.to(currentRoom).emit('timer:state', { endTime, duration });
	});

	socket.on('timer:stop', () => {
		if (!checkRateLimit(socket, 'timer:stop')) return;
		if (!currentRoom) return;
		roomTimers.delete(currentRoom);
		io.to(currentRoom).emit('timer:state', { endTime: null, duration: null });
	});

	socket.on('disconnect', () => {
		if (currentRoom) {
			const users = roomUsers.get(currentRoom);
			if (users) {
				users.delete(socket.id);
				io.to(currentRoom).emit('users:count', { count: users.size });
				if (users.size === 0) roomUsers.delete(currentRoom);
			}
		}
	});
});

const port = parseInt(process.env.PORT || '3000');
httpServer.listen(port, () => {
	console.log(`Retro Board running on http://localhost:${port}`);
});
