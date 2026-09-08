import { pgTable, uuid, text, timestamp, pgEnum, unique, integer, customType } from 'drizzle-orm/pg-core';

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
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
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
	imageId: uuid('image_id').references(() => images.id, { onDelete: 'set null' }),
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
