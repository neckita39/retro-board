CREATE UNIQUE INDEX IF NOT EXISTS "space_analyses_one_pending" ON "space_analyses" ("space_id") WHERE "state" = 'pending';
