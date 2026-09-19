import { handler } from './build/handler.js';
import { isIndexable } from './seo-paths.js';
import { isValidColumn } from './board-formats.js';
import { normalizeTitle } from './titles.js';
import { createServer } from 'http';
import { EventEmitter } from 'events';
import { Server as SocketIOServer } from 'socket.io';
import crypto from 'crypto';
import pg from 'pg';
import dgram from 'dgram';
import pino from 'pino';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, inArray, sql, isNull, lt, isNotNull } from 'drizzle-orm';
import {
	pgTable,
	uuid,
	text,
	timestamp,
	pgEnum,
	unique,
	integer,
	customType
} from 'drizzle-orm/pg-core';

const bytea = customType({
	dataType() {
		return 'bytea';
	}
});

// Шина SvelteKit → Socket.IO: form action анализа пространства шлёт сюда события,
// а мы ретранслируем их комнате space:{slug}. Один процесс, поэтому globalThis хватает.
const bus = new EventEmitter();
globalThis.__retroBus = bus;

// --- Logger ---
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// --- StatsD UDP client ---
const statsd = dgram.createSocket('udp4');
const STATSD_HOST = process.env.STATSD_HOST || 'localhost';
const STATSD_PORT = parseInt(process.env.STATSD_PORT || '8125');

function metric(name, value, type = 'c') {
	const msg = Buffer.from(`${name}:${value}|${type}`);
	statsd.send(msg, STATSD_PORT, STATSD_HOST);
}

// --- Schema (duplicated for standalone server) ---
const voteTypeEnum = pgEnum('vote_type', ['like', 'dislike']);

const spaces = pgTable('spaces', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull(),
	passwordHash: text('password_hash').notNull(),
	creatorToken: text('creator_token').notNull().default(''),
	lastFormat: text('last_format'),
	accessToken: text('access_token').notNull().default(sql`gen_random_uuid()::text`),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

const boards = pgTable('boards', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: text('slug').notNull().unique(),
	title: text('title').notNull(),
	creatorToken: text('creator_token').notNull().default(''),
	spaceId: uuid('space_id').references(() => spaces.id, { onDelete: 'set null' }),
	format: text('format').notNull().default('classic'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

const images = pgTable('images', {
	id: uuid('id').primaryKey().defaultRandom(),
	data: bytea('data').notNull(),
	mimeType: text('mime_type').notNull(),
	width: integer('width').notNull().default(0),
	height: integer('height').notNull().default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

const cards = pgTable('cards', {
	id: uuid('id').primaryKey().defaultRandom(),
	boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
	columnType: text('column_type').notNull(),
	content: text('content').notNull(),
	authorName: text('author_name'),
	imageId: uuid('image_id').references(() => images.id, { onDelete: 'set null' }),
	bitrixTaskId: integer('bitrix_task_id'),
	bitrixTaskUrl: text('bitrix_task_url'),
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
	imageId: uuid('image_id').references(() => images.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

const schema = { spaces, boards, cards, votes, comments, images };

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
		logger.warn('ENCRYPTION_KEY must be 64 hex chars (32 bytes). Encryption disabled.');
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

function decryptCard(card, imageMeta) {
	const result = { ...card, content: decrypt(card.content), authorName: decrypt(card.authorName) };
	if (imageMeta) {
		result.imageWidth = imageMeta.width;
		result.imageHeight = imageMeta.height;
	} else {
		result.imageWidth = null;
		result.imageHeight = null;
	}
	return result;
}

function decryptComment(comment, imageMeta) {
	const result = { ...comment, content: decrypt(comment.content), authorName: decrypt(comment.authorName) };
	if (imageMeta) {
		result.imageWidth = imageMeta.width;
		result.imageHeight = imageMeta.height;
	} else {
		result.imageWidth = null;
		result.imageHeight = null;
	}
	return result;
}

// --- In-memory metrics counters ---
const metrics = {
	requestCount: 0,
	errorCount: 0,
	wsConnections: 0,
	startedAt: Date.now()
};

// --- HTTP + Socket.IO ---
const httpServer = createServer(async (req, res) => {
	// Health/Ready/Metrics endpoints
	if (req.method === 'GET' && req.url === '/health') {
		const data = {
			status: 'ok',
			uptime: process.uptime(),
			wsConnections: metrics.wsConnections,
			timestamp: new Date().toISOString()
		};
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(data));
		return;
	}

	if (req.method === 'GET' && req.url === '/ready') {
		try {
			await pool.query('SELECT 1');
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ status: 'ready', db: 'ok' }));
		} catch (err) {
			logger.error({ err }, 'Readiness check failed');
			res.writeHead(503, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ status: 'error', db: 'unreachable' }));
		}
		return;
	}

	if (req.method === 'GET' && req.url === '/metrics') {
		const mem = process.memoryUsage();
		let pgStats = null;
		try {
			const [connResult, cacheResult, sizeResult] = await Promise.all([
				pool.query("SELECT count(*) AS total FROM pg_stat_activity WHERE datname = current_database()"),
				pool.query("SELECT ROUND(sum(blks_hit)::numeric / NULLIF(sum(blks_hit) + sum(blks_read), 0), 4) AS ratio FROM pg_stat_database WHERE datname = current_database()"),
				pool.query("SELECT pg_database_size(current_database()) AS size")
			]);
			pgStats = {
				connections: parseInt(connResult.rows[0].total),
				cacheHitRatio: parseFloat(cacheResult.rows[0].ratio) || 0,
				dbSizeBytes: parseInt(sizeResult.rows[0].size)
			};
		} catch (err) {
			logger.error({ err }, 'Failed to collect PG stats');
		}

		const data = {
			process: {
				memoryMB: {
					rss: Math.round(mem.rss / 1048576),
					heapUsed: Math.round(mem.heapUsed / 1048576),
					heapTotal: Math.round(mem.heapTotal / 1048576)
				},
				uptime: process.uptime()
			},
			counters: {
				requests: metrics.requestCount,
				errors: metrics.errorCount
			},
			ws: {
				connections: metrics.wsConnections
			},
			pool: {
				total: pool.totalCount,
				idle: pool.idleCount,
				waiting: pool.waitingCount
			},
			pg: pgStats,
			timestamp: new Date().toISOString()
		};
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(data));
		return;
	}

	// --- Serve images (bypass SvelteKit for performance) ---
	const imageMatch = req.method === 'GET' && req.url?.match(/^\/api\/image\/([0-9a-f-]{36})$/);
	if (imageMatch) {
		try {
			const [image] = await db
				.select({ data: images.data, mimeType: images.mimeType })
				.from(images)
				.where(eq(images.id, imageMatch[1]))
				.limit(1);

			if (!image) {
				res.writeHead(404, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ error: 'Not found' }));
				return;
			}

			res.writeHead(200, {
				'Content-Type': image.mimeType,
				'Cache-Control': 'public, max-age=31536000, immutable',
				'Content-Length': image.data.length
			});
			res.end(image.data);
		} catch (err) {
			logger.error({ err }, 'Image serve failed');
			res.writeHead(500);
			res.end();
		}
		return;
	}

	// --- Security headers ---
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('X-Frame-Options', 'DENY');
	res.setHeader('X-XSS-Protection', '0');
	res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
	res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (process.env.ORIGIN?.startsWith('https')) {
		res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	// Индексируем только контентные страницы из seo-paths.js. Доски и пространства
	// открыты по неугадываемой ссылке — утёкшая в индекс ретроспектива уже не
	// отзывается. robots.txt просит туда не ходить, а этот заголовок сработает,
	// даже если краулер пришёл по прямой ссылке в обход robots.txt.
	if (!isIndexable(req.url || '/')) {
		res.setHeader('X-Robots-Tag', 'noindex, nofollow');
	}

	// Track requests for metrics
	metrics.requestCount++;

	// Pass to SvelteKit handler
	handler(req, res);
});

const io = new SocketIOServer(httpServer, {
	cors: { origin: '*' }
});

const roomUsers = new Map();
const roomTimers = new Map();
const roomCreatorTokens = new Map();
// Обсуждение: slug -> { cardId, endTime, duration, discussed: Set<cardId> }.
// Живёт только в памяти комнаты, как таймер — это состояние встречи, не доски.
const roomFocus = new Map();
const FOCUS_DURATION = 300;
// Обсуждение, к которому полчаса никто не притрагивался, считаем брошенным:
// иначе зашедший назавтра участник получит серый список и застывший таймер,
// а выключить их может только создатель.
const FOCUS_STALE_MS = 30 * 60 * 1000;
// Потолок на отметки «обсудили»: реальной повестке хватит с запасом, а вот
// пейлоад focus:state рассылается всей комнате на каждом переходе.
const FOCUS_DISCUSSED_MAX = 500;

/** Cookie из рукопожатия сокета: name=value; ... → объект. Битые пары пропускаем. */
function parseCookies(header) {
	const jar = {};
	for (const part of String(header || '').split(';')) {
		const idx = part.indexOf('=');
		if (idx <= 0) continue;
		const name = part.slice(0, idx).trim();
		if (!name) continue;
		try {
			jar[name] = decodeURIComponent(part.slice(idx + 1).trim());
		} catch {
			// значение с кривым percent-encoding — пропускаем
		}
	}
	return jar;
}

function roomIsEmpty(slug) {
	return (roomUsers.get(slug)?.size ?? 0) === 0;
}

function focusPayload(focus) {
	return {
		cardId: focus.cardId,
		endTime: focus.endTime,
		duration: focus.duration,
		discussed: [...focus.discussed]
	};
}

bus.on('space', ({ spaceSlug, event, payload }) => {
	if (typeof spaceSlug !== 'string' || typeof event !== 'string') return;
	io.to(`space:${spaceSlug}`).emit(event, payload);
});

// Канал доски: экшен createTask сообщает всем на доске о созданной задаче (card:task).
// Комната доски — её slug без префикса, как в board:join.
bus.on('board', ({ boardSlug, event, payload }) => {
	if (typeof boardSlug !== 'string' || !boardSlug || typeof event !== 'string') return;
	io.to(boardSlug).emit(event, payload);
});

// Любая запись разрешена только в ту доску, в комнату которой сокет действительно вошёл.
// board:join проверяет пароль пространства, поэтому привязка к комнате и есть проверка
// доступа. Раньше boardId и cardId брались прямо из payload: этого хватало, чтобы писать
// и удалять в любой доске продукта, зная только её id, вообще не заходя в комнату.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Доступ к пространству по cookie рукопожатия. Дубль равенства из canViewSpace
// (src/lib/server/space-access.ts): server.js не импортирует src/, меняйте обе.
function spaceAllowedByCookies(space, cookieHeader) {
	if (!space.passwordHash) return true;
	const jar = parseCookies(cookieHeader);
	const creator = !!space.creatorToken && jar[`retro_space_creator_${space.slug}`] === space.creatorToken;
	const access = !!space.accessToken && jar[`retro_space_${space.slug}`] === space.accessToken;
	return creator || access;
}

// Пускать ли сокет на доску: своя доска — по неугадываемой ссылке, доска внутри
// пространства с паролем — только тем, кто пароль ввёл
async function boardAllowed(board, cookieHeader) {
	if (!board.spaceId) return true;
	const space = await db.query.spaces.findFirst({ where: eq(spaces.id, board.spaceId) });
	if (!space) return true;
	return spaceAllowedByCookies(space, cookieHeader);
}

async function boardOfRoom(room) {
	if (typeof room !== 'string' || !room) return null;
	const [row] = await db
		.select({ id: boards.id, format: boards.format })
		.from(boards)
		.where(eq(boards.slug, room))
		.limit(1);
	return row ?? null;
}

// Карточка существует И лежит в доске этой комнаты; иначе null
async function cardOfRoom(cardId, room) {
	if (typeof room !== 'string' || !room) return null;
	if (typeof cardId !== 'string' || !UUID.test(cardId)) return null;
	const [row] = await db
		.select({ id: cards.id, boardId: boards.id, format: boards.format })
		.from(cards)
		.innerJoin(boards, eq(cards.boardId, boards.id))
		.where(and(eq(cards.id, cardId), eq(boards.slug, room)))
		.limit(1);
	return row ?? null;
}

io.on('connection', (socket) => {
	metrics.wsConnections++;
	let currentRoom = null;
	let socketCreatorToken = '';
	// Комната пространства: только статус AI-анализа. Пространство без пароля защищено
	// неугадываемой ссылкой, пространство с паролем проверяется в space:join ниже
	let currentSpace = null;

	// Пространство с паролем: в комнату пускаем только с cookie доступа, равной
	// spaces.access_token, или cookie создателя (те же правила, что у страницы). Статус анализа несёт
	// slug доски-анализа, а он должен быть виден лишь тем, кто прошёл пароль.
	// ack: клиент запрашивает состояние по HTTP только после входа в комнату,
	// иначе событие между fetch и join терялось бы.
	socket.on('space:join', async (payload, ack) => {
		const slug = payload?.slug;
		if (typeof slug !== 'string' || !slug || slug.length > 64) return;
		try {
			const space = await db.query.spaces.findFirst({ where: eq(spaces.slug, slug) });
			if (!space) return;
			if (!spaceAllowedByCookies(space, socket.handshake?.headers?.cookie)) return;
			if (currentSpace) socket.leave(`space:${currentSpace}`);
			currentSpace = slug;
			socket.join(`space:${slug}`);
			if (typeof ack === 'function') ack();
		} catch (err) {
			logger.error({ err, event: 'space:join', slug }, 'Failed to join space room');
		}
	});

	socket.on('board:join', async ({ slug, creatorToken: joinToken }) => {
		socketCreatorToken = joinToken || '';
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
			if (!board) {
				// Комнаты несуществующей доски быть не должно: иначе у неё нет токена
				// создателя, а значит управлять таймером и обсуждением в ней может кто угодно
				socket.leave(slug);
				const ghosts = roomUsers.get(slug);
				if (ghosts) {
					ghosts.delete(socket.id);
					if (ghosts.size === 0) roomUsers.delete(slug);
				}
				currentRoom = null;
				return;
			}

			// Пароль пространства закрывает и доски внутри: без него комната не отдаёт
			// board:state, а значит и запись в неё невозможна (вся запись привязана к комнате)
			if (!(await boardAllowed(board, socket.handshake?.headers?.cookie))) {
				socket.leave(slug);
				const locked = roomUsers.get(slug);
				if (locked) {
					locked.delete(socket.id);
					io.to(slug).emit('users:count', { count: locked.size });
					if (locked.size === 0) roomUsers.delete(slug);
				}
				currentRoom = null;
				return;
			}

			roomCreatorTokens.set(slug, board.creatorToken || '');

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

			// Batch lookup image metadata for cards and comments
			const allImageIds = [
				...boardCards.map(c => c.imageId).filter(Boolean),
				...boardComments.map(c => c.imageId).filter(Boolean)
			];
			let imageMetaMap = {};
			if (allImageIds.length > 0) {
				const imageMetas = await db
					.select({ id: images.id, width: images.width, height: images.height })
					.from(images)
					.where(inArray(images.id, allImageIds));
				for (const m of imageMetas) imageMetaMap[m.id] = m;
			}

			socket.emit('board:state', {
				// Whitelist board fields — never leak creatorToken to visitors
				board: {
					id: board.id,
					slug: board.slug,
					title: board.title,
					format: board.format,
					spaceId: board.spaceId,
					createdAt: board.createdAt
				},
				cards: boardCards.map(c => decryptCard(c, c.imageId ? imageMetaMap[c.imageId] : null)),
				votes: boardVotes,
				comments: boardComments.map(c => decryptComment(c, c.imageId ? imageMetaMap[c.imageId] : null))
			});

			const timer = roomTimers.get(slug);
			if (timer && timer.endTime > Date.now()) {
				socket.emit('timer:state', timer);
			}

			// Состояние обсуждения шлём ВСЕГДА, в том числе пустое: board:join
			// переотправляется после реконнекта, и если промолчать, клиент,
			// переживший рестарт сервера или пропустивший focus:stop, останется
			// с намертво подсвеченной карточкой.
			const focus = roomFocus.get(slug);
			const live = focus && Date.now() - focus.endTime < FOCUS_STALE_MS;
			if (focus && !live) roomFocus.delete(slug);
			socket.emit(
				'focus:state',
				live ? focusPayload(focus) : { cardId: null, endTime: null, duration: null, discussed: [] }
			);
		} catch (err) {
			logger.error({ err, event: 'board:join', slug }, 'Failed to load board state');
		}
	});

	socket.on('card:create', async ({ column, content, authorName, imageId: imgId }) => {
		const hasContent = content && typeof content === 'string' && content.trim().length > 0;
		const hasImage = imgId && typeof imgId === 'string';
		if (!hasContent && !hasImage) return;
		if (hasContent && content.length > 2000) return;
		if (authorName && (typeof authorName !== 'string' || authorName.length > 100)) return;
		// Доска берётся из комнаты, а не из payload: boardId клиента не доверяем.
		// Колонка обязана существовать в формате этой доски — иначе карточка
		// исчезнет с экрана у всех, а в базе останется
		const owner = await boardOfRoom(currentRoom);
		if (!owner || !isValidColumn(owner.format, column)) return;
		// Validate imageId exists
		let imageMeta = null;
		if (hasImage) {
			const [img] = await db.select({ id: images.id, width: images.width, height: images.height }).from(images).where(eq(images.id, imgId)).limit(1);
			if (!img) return;
			imageMeta = img;
		}
		try {
			const [card] = await db
				.insert(cards)
				.values({
					boardId: owner.id,
					columnType: column,
					content: encrypt(content || ''),
					authorName: encrypt(authorName) || null,
					imageId: hasImage ? imgId : null
				})
				.returning();
			if (currentRoom) io.to(currentRoom).emit('card:created', { card: decryptCard(card, imageMeta) });
			metric('retro.card.created', 1);
		} catch (err) {
			logger.error({ err, event: 'card:create' }, 'Failed to create card');
		}
	});

	socket.on('card:update', async ({ cardId, content, imageId: imgId, columnType }) => {
		const hasContent = content && typeof content === 'string' && content.trim().length > 0;
		const hasImage = imgId && typeof imgId === 'string';
		const hasColumn = columnType !== undefined;
		const owner = await cardOfRoom(cardId, currentRoom);
		if (!owner) return;
		if (hasColumn && !isValidColumn(owner.format, columnType)) return;
		if (!hasContent && imgId === undefined && !hasColumn) return; // must update something
		if (hasContent && content.length > 2000) return;

		let imageMeta = null;
		const updates = {};
		if (content !== undefined) updates.content = encrypt(content || '');
		if (hasColumn) updates.columnType = columnType;
		if (imgId !== undefined) {
			if (hasImage) {
				const [img] = await db.select({ id: images.id, width: images.width, height: images.height }).from(images).where(eq(images.id, imgId)).limit(1);
				if (!img) return;
				imageMeta = img;
				updates.imageId = imgId;
			} else {
				updates.imageId = null;
			}
		}

		try {
			const [card] = await db
				.update(cards)
				.set(updates)
				.where(eq(cards.id, cardId))
				.returning();
			// Fetch image meta if card has imageId but we didn't update it
			if (card.imageId && !imageMeta) {
				const [img] = await db.select({ id: images.id, width: images.width, height: images.height }).from(images).where(eq(images.id, card.imageId)).limit(1);
				imageMeta = img || null;
			}
			if (currentRoom) io.to(currentRoom).emit('card:updated', { card: decryptCard(card, imageMeta) });
		} catch (err) {
			logger.error({ err, event: 'card:update', cardId }, 'Failed to update card');
		}
	});

	socket.on('card:delete', async ({ cardId }) => {
		if (!(await cardOfRoom(cardId, currentRoom))) return;
		try {
			await db.delete(cards).where(eq(cards.id, cardId));
			// Удалённой карточке нечего делать в отметках обсуждения
			roomFocus.get(currentRoom)?.discussed.delete(cardId);
			if (currentRoom) io.to(currentRoom).emit('card:deleted', { cardId });
		} catch (err) {
			logger.error({ err, event: 'card:delete', cardId }, 'Failed to delete card');
		}
	});

	socket.on('vote:toggle', async ({ cardId, type, sessionId }) => {
		if (!(await cardOfRoom(cardId, currentRoom))) return;
		try {
			const existing = await db.query.votes.findFirst({
				where: and(eq(votes.cardId, cardId), eq(votes.sessionId, sessionId), eq(votes.type, type))
			});

			if (existing) {
				await db.delete(votes).where(eq(votes.id, existing.id));
			} else {
				// Remove opposite vote first
				const opposite = type === 'like' ? 'dislike' : 'like';
				const oppositeVote = await db.query.votes.findFirst({
					where: and(eq(votes.cardId, cardId), eq(votes.sessionId, sessionId), eq(votes.type, opposite))
				});
				if (oppositeVote) {
					await db.delete(votes).where(eq(votes.id, oppositeVote.id));
				}
				await db.insert(votes).values({ cardId, type, sessionId });
			}

			const cardVotes = await db.query.votes.findMany({
				where: eq(votes.cardId, cardId)
			});

			if (currentRoom) io.to(currentRoom).emit('vote:toggled', { cardId, votes: cardVotes });
		} catch (err) {
			logger.error({ err, event: 'vote:toggle', cardId }, 'Failed to toggle vote');
		}
	});

	socket.on('comment:create', async ({ cardId, content, authorName, imageId: imgId }) => {
		const hasContent = content && typeof content === 'string' && content.trim().length > 0;
		const hasImage = imgId && typeof imgId === 'string';
		if (!hasContent && !hasImage) return;
		if (hasContent && content.length > 1000) return;
		if (authorName && (typeof authorName !== 'string' || authorName.length > 100)) return;
		if (!(await cardOfRoom(cardId, currentRoom))) return;
		let imageMeta = null;
		if (hasImage) {
			const [img] = await db.select({ id: images.id, width: images.width, height: images.height }).from(images).where(eq(images.id, imgId)).limit(1);
			if (!img) return;
			imageMeta = img;
		}
		try {
			const [comment] = await db
				.insert(comments)
				.values({
					cardId,
					content: encrypt(content || ''),
					authorName: encrypt(authorName) || null,
					imageId: hasImage ? imgId : null
				})
				.returning();
			if (currentRoom) io.to(currentRoom).emit('comment:created', { comment: decryptComment(comment, imageMeta) });
		} catch (err) {
			logger.error({ err, event: 'comment:create', cardId }, 'Failed to create comment');
		}
	});

	socket.on('timer:start', ({ duration, creatorToken }) => {
		if (!currentRoom) return;
		if (!Number.isFinite(duration) || duration < 60 || duration > 3600) return;
		const roomToken = roomCreatorTokens.get(currentRoom) || '';
		if (roomToken && creatorToken !== roomToken) return;
		const endTime = Date.now() + duration * 1000;
		roomTimers.set(currentRoom, { endTime, duration });
		io.to(currentRoom).emit('timer:state', { endTime, duration });
	});

	socket.on('timer:stop', ({ creatorToken } = {}) => {
		if (!currentRoom) return;
		const roomToken = roomCreatorTokens.get(currentRoom) || '';
		if (roomToken && creatorToken !== roomToken) return;
		roomTimers.delete(currentRoom);
		io.to(currentRoom).emit('timer:state', { endTime: null, duration: null });
	});

	// --- Переименование доски: только создатель, новое имя летит всей комнате ---

	socket.on('board:rename', async (payload) => {
		if (!currentRoom || !isRoomCreator(payload?.creatorToken)) return;
		const title = normalizeTitle(payload?.title);
		if (!title) return;
		try {
			const [board] = await db
				.update(boards)
				.set({ title })
				.where(eq(boards.slug, currentRoom))
				.returning({ title: boards.title });
			if (board) io.to(currentRoom).emit('board:renamed', { title: board.title });
		} catch (err) {
			logger.error({ err, event: 'board:rename', slug: currentRoom }, 'Failed to rename board');
		}
	});

	// --- Обсуждение: фокус на одной карточке, общий для всей комнаты ---

	function isRoomCreator(creatorToken) {
		const roomToken = roomCreatorTokens.get(currentRoom) || '';
		return !roomToken || creatorToken === roomToken;
	}

	function validCardId(cardId) {
		return typeof cardId === 'string' && cardId.length > 0 && cardId.length <= 64;
	}

	socket.on('focus:start', (payload) => {
		const cardId = payload?.cardId;
		if (!currentRoom || !validCardId(cardId) || !isRoomCreator(payload?.creatorToken)) return;
		const focus = {
			cardId,
			endTime: Date.now() + FOCUS_DURATION * 1000,
			duration: FOCUS_DURATION,
			discussed: new Set([cardId])
		};
		roomFocus.set(currentRoom, focus);
		io.to(currentRoom).emit('focus:state', focusPayload(focus));
		metric('retro.focus.started', 1);
	});

	socket.on('focus:set', (payload) => {
		const cardId = payload?.cardId;
		if (!currentRoom || !validCardId(cardId) || !isRoomCreator(payload?.creatorToken)) return;
		const current = roomFocus.get(currentRoom);
		// Переход имеет смысл только внутри уже идущего обсуждения
		if (!current) return;
		current.cardId = cardId;
		if (current.discussed.size < FOCUS_DISCUSSED_MAX) current.discussed.add(cardId);
		current.endTime = Date.now() + FOCUS_DURATION * 1000;
		current.duration = FOCUS_DURATION;
		io.to(currentRoom).emit('focus:state', focusPayload(current));
	});

	socket.on('focus:stop', (payload) => {
		if (!currentRoom || !isRoomCreator(payload?.creatorToken)) return;
		roomFocus.delete(currentRoom);
		io.to(currentRoom).emit('focus:state', { cardId: null, endTime: null, duration: null, discussed: [] });
	});

	// --- Битрикс24: открыли преформу задачи — только счётчик ---
	// В имя метрики попадает лишь значение из белого списка, клиентская строка — никогда
	socket.on('bitrix:opened', (payload) => {
		const source = payload?.source;
		if (!currentRoom || !isRoomCreator(payload?.creatorToken)) return;
		if (source !== 'card' && source !== 'summary') return;
		metric('retro.bitrix.task.opened.' + source, 1);
	});

	socket.on('disconnect', () => {
		metrics.wsConnections--;
		if (currentRoom) {
			const users = roomUsers.get(currentRoom);
			if (users) {
				users.delete(socket.id);
				io.to(currentRoom).emit('users:count', { count: users.size });
				if (users.size === 0) {
					roomUsers.delete(currentRoom);
					roomCreatorTokens.delete(currentRoom);
					// Таймер и фокус НЕ трогаем: комната пустеет и на обычной перезагрузке
					// страницы, а терять отметки «обсудили» на релоаде нельзя.
					// Их подчищает часовая уборка ниже.
				}
			}
		}
	});
});

// --- Orphan image cleanup (every hour, images older than 24h not referenced by any card/comment) ---
setInterval(async () => {
	try {
		const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
		// Find images not referenced by any card or comment
		const orphans = await db
			.select({ id: images.id })
			.from(images)
			.where(lt(images.createdAt, cutoff))
			.leftJoin(cards, eq(cards.imageId, images.id))
			.leftJoin(comments, eq(comments.imageId, images.id))
			.having(sql`count(${cards.id}) = 0 AND count(${comments.id}) = 0`)
			.groupBy(images.id);

		if (orphans.length > 0) {
			const ids = orphans.map(o => o.id);
			await db.delete(images).where(inArray(images.id, ids));
			logger.info({ count: ids.length }, 'Cleaned up orphan images');
		}
	} catch (err) {
		logger.error({ err }, 'Orphan image cleanup failed');
	}

	// Состояние встречи для комнат, где давно никого нет: держать его вечно незачем.
	// Час — с большим запасом на перезагрузку страницы и обрыв связи.
	for (const slug of [...roomTimers.keys()]) {
		if (roomIsEmpty(slug)) roomTimers.delete(slug);
	}
	for (const slug of [...roomFocus.keys()]) {
		if (roomIsEmpty(slug)) roomFocus.delete(slug);
	}
}, 60 * 60 * 1000);

const port = parseInt(process.env.PORT || '3000');
httpServer.listen(port, () => {
	logger.info({ port, encryption: !!encKey }, 'Retro Board started');
});
