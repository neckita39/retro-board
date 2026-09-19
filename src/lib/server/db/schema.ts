import { pgTable, uuid, text, timestamp, pgEnum, unique, integer, boolean, customType } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const bytea = customType<{ data: Buffer }>({
	dataType() {
		return 'bytea';
	}
});

export const voteTypeEnum = pgEnum('vote_type', ['like', 'dislike']);

export const spaces = pgTable('spaces', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull(),
	passwordHash: text('password_hash'),
	creatorToken: text('creator_token').notNull().default(''),
	// Формат последней созданной здесь доски — предвыбор для следующей
	lastFormat: text('last_format'),
	// Значение cookie доступа к закрытому пространству; новое при каждом включении пароля
	accessToken: text('access_token').notNull().default(sql`gen_random_uuid()::text`),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const boards = pgTable('boards', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: text('slug').notNull().unique(),
	title: text('title').notNull(),
	creatorToken: text('creator_token').notNull().default(''),
	spaceId: uuid('space_id').references(() => spaces.id, { onDelete: 'set null' }),
	// Id из board-formats.js; фиксируется при создании
	format: text('format').notNull().default('classic'),
	// Слепой ввод: карточку видит только её автор, пока ведущий не выключит режим
	blind: boolean('blind').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export type AnalysisRowState = 'pending' | 'ready' | 'failed';

// Ход AI-анализа пространства: pending → ready (доска создана) | failed.
// Доска-анализ появляется только при успехе, поэтому состояние живёт отдельно.
export const spaceAnalyses = pgTable('space_analyses', {
	id: uuid('id').primaryKey().defaultRandom(),
	spaceId: uuid('space_id')
		.notNull()
		.references(() => spaces.id, { onDelete: 'cascade' }),
	state: text('state').$type<AnalysisRowState>().notNull().default('pending'),
	error: text('error'),
	title: text('title').notNull(),
	locale: text('locale').notNull().default('en'),
	// slug и токен будущей доски генерируются при старте: нажавший сразу получает cookie
	boardSlug: text('board_slug').notNull(),
	creatorToken: text('creator_token').notNull(),
	boardId: uuid('board_id').references(() => boards.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	finishedAt: timestamp('finished_at', { withTimezone: true })
});

// Подключение Битрикс24: одна строка на пространство. Секрет — только код вебхука,
// он живёт внутри шифротекста webhook_enc; хост и id владельца не секрет.
export const spaceBitrix = pgTable('space_bitrix', {
	spaceId: uuid('space_id')
		.primaryKey()
		.references(() => spaces.id, { onDelete: 'cascade' }),
	webhookEnc: text('webhook_enc').notNull(),
	portal: text('portal').notNull(),
	userId: integer('user_id').notNull(),
	userName: text('user_name').notNull(),
	// IANA-зона из profile.TIME_ZONE; NULL, если портал вернул пустую строку
	timeZone: text('time_zone'),
	// Смещение сервера портала из time.date_finish ответа profile, например '+03:00'
	portalOffset: text('portal_offset'),
	groupId: integer('group_id'),
	groupName: text('group_name'),
	connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
	// invalid_webhook | scope | access — пишут только экшены на пути fail
	lastError: text('last_error')
});

export const images = pgTable('images', {
	id: uuid('id').primaryKey().defaultRandom(),
	data: bytea('data').notNull(),
	mimeType: text('mime_type').notNull(),
	width: integer('width').notNull().default(0),
	height: integer('height').notNull().default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const cards = pgTable('cards', {
	id: uuid('id').primaryKey().defaultRandom(),
	boardId: uuid('board_id')
		.notNull()
		.references(() => boards.id, { onDelete: 'cascade' }),
	// Id колонки внутри формата доски (board-formats.js); валидируется сервером
	columnType: text('column_type').notNull(),
	content: text('content').notNull(),
	authorName: text('author_name'),
	// Идентификатор браузера автора (тот же, что у голосов). Нужен только чтобы
	// показать человеку его собственные карточки в слепом вводе; наружу не уходит
	authorSession: text('author_session'),
	imageId: uuid('image_id').references(() => images.id, { onDelete: 'set null' }),
	// Задача Битрикс24 из карточки: id и готовая ссылка, считаются один раз при создании
	bitrixTaskId: integer('bitrix_task_id'),
	bitrixTaskUrl: text('bitrix_task_url'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const votes = pgTable(
	'votes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		cardId: uuid('card_id')
			.notNull()
			.references(() => cards.id, { onDelete: 'cascade' }),
		type: voteTypeEnum('type').notNull(),
		sessionId: text('session_id').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [unique().on(t.cardId, t.sessionId, t.type)]
);

export const comments = pgTable('comments', {
	id: uuid('id').primaryKey().defaultRandom(),
	cardId: uuid('card_id')
		.notNull()
		.references(() => cards.id, { onDelete: 'cascade' }),
	content: text('content').notNull(),
	authorName: text('author_name'),
	imageId: uuid('image_id').references(() => images.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
