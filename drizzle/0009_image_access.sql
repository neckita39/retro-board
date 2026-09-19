-- Отдача картинки теперь спрашивает, в каком пространстве лежит её карточка или
-- комментарий: вложения закрытого паролем пространства не должны скачиваться по
-- голому uuid. Поиск идёт по image_id, а индекса на нём не было — без него
-- каждая картинка на доске стоила бы seq scan по cards и comments.
CREATE INDEX IF NOT EXISTS "cards_image_idx" ON "cards" ("image_id") WHERE "image_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_image_idx" ON "comments" ("image_id") WHERE "image_id" IS NOT NULL;
