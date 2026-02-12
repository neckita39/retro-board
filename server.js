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

// --- Server-side encryption (data at rest) ---
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || null;
let encKey = null;

if (ENCRYPTION_KEY) {
	encKey = Buffer.from(ENCRYPTION_KEY, 'hex');
	if (encKey.length !== 32) {
		console.error('ENCRYPTION_KEY must be 64 hex chars (32 bytes). Encryption disabled.');
		encKey = null;
	}
}

function encrypt(plaintext) {
	if (!encKey || !plaintext) return plaintext;
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return iv.toString('base64url') + '.' + Buffer.concat([encrypted, tag]).toString('base64url');
}

function decrypt(data) {
	if (!encKey || !data) return data;
	if (!data.includes('.')) return data; // unencrypted legacy data
	try {
		const [ivStr, ctStr] = data.split('.');
		const iv = Buffer.from(ivStr, 'base64url');
		const buf = Buffer.from(ctStr, 'base64url');
		const tag = buf.subarray(buf.length - 16);
		const encrypted = buf.subarray(0, buf.length - 16);
		const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
		decipher.setAuthTag(tag);
		return decipher.update(encrypted, null, 'utf8') + decipher.final('utf8');
	} catch {
		return data; // unencrypted legacy data
	}
}

function decryptCard(card) {
	return { ...card, content: decrypt(card.content), authorName: decrypt(card.authorName) };
}

function decryptComment(comment) {
	return { ...comment, content: decrypt(comment.content), authorName: decrypt(comment.authorName) };
}

// --- HTTP + Socket.IO ---
const httpServer = createServer(handler);
const io = new SocketIOServer(httpServer, {
	cors: { origin: '*' }
});

const roomUsers = new Map();
const roomTimers = new Map();

io.on('connection', (socket) => {
	let currentRoom = null;

	socket.on('board:join', async ({ slug }) => {
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
				cards: boardCards.map(decryptCard),
				votes: boardVotes,
				comments: boardComments.map(decryptComment)
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
		try {
			const [card] = await db
				.insert(cards)
				.values({
					boardId,
					columnType: column,
					content: encrypt(content),
					authorName: encrypt(authorName) || null
				})
				.returning();
			if (currentRoom) io.to(currentRoom).emit('card:created', { card: decryptCard(card) });
		} catch (err) {
			console.error('Error creating card:', err);
		}
	});

	socket.on('card:update', async ({ cardId, content }) => {
		try {
			const [card] = await db
				.update(cards)
				.set({ content: encrypt(content) })
				.where(eq(cards.id, cardId))
				.returning();
			if (currentRoom) io.to(currentRoom).emit('card:updated', { card: decryptCard(card) });
		} catch (err) {
			console.error('Error updating card:', err);
		}
	});

	socket.on('card:delete', async ({ cardId }) => {
		try {
			await db.delete(cards).where(eq(cards.id, cardId));
			if (currentRoom) io.to(currentRoom).emit('card:deleted', { cardId });
		} catch (err) {
			console.error('Error deleting card:', err);
		}
	});

	socket.on('vote:toggle', async ({ cardId, type, sessionId }) => {
		try {
			const existing = await db.query.votes.findFirst({
				where: and(eq(votes.cardId, cardId), eq(votes.sessionId, sessionId), eq(votes.type, type))
			});

			if (existing) {
				await db.delete(votes).where(eq(votes.id, existing.id));
			} else {
				await db.insert(votes).values({ cardId, type, sessionId });
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
		try {
			const [comment] = await db
				.insert(comments)
				.values({
					cardId,
					content: encrypt(content),
					authorName: encrypt(authorName) || null
				})
				.returning();
			if (currentRoom) io.to(currentRoom).emit('comment:created', { comment: decryptComment(comment) });
		} catch (err) {
			console.error('Error creating comment:', err);
		}
	});

	socket.on('timer:start', ({ duration }) => {
		if (!currentRoom) return;
		const endTime = Date.now() + duration * 1000;
		roomTimers.set(currentRoom, { endTime, duration });
		io.to(currentRoom).emit('timer:state', { endTime, duration });
	});

	socket.on('timer:stop', () => {
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
	if (encKey) console.log('Database encryption: ENABLED');
	else console.log('Database encryption: DISABLED (set ENCRYPTION_KEY to enable)');
});
