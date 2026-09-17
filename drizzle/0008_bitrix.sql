CREATE TABLE IF NOT EXISTS "space_bitrix" (
	"space_id" uuid PRIMARY KEY NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
	"webhook_enc" text NOT NULL,
	"portal" text NOT NULL,
	"user_id" integer NOT NULL,
	"user_name" text NOT NULL,
	"time_zone" text,
	"portal_offset" text,
	"group_id" integer,
	"group_name" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "bitrix_task_id" integer;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "bitrix_task_url" text;
--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "access_token" text DEFAULT gen_random_uuid()::text NOT NULL;
