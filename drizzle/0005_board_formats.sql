ALTER TABLE "cards" ALTER COLUMN "column_type" TYPE text USING "column_type"::text;
--> statement-breakpoint
DROP TYPE IF EXISTS "column_type";
--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "format" text NOT NULL DEFAULT 'classic';
--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "last_format" text;
