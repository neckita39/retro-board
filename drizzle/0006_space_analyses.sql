CREATE TABLE IF NOT EXISTS "space_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
	"state" text NOT NULL DEFAULT 'pending',
	"error" text,
	"title" text NOT NULL,
	"locale" text NOT NULL DEFAULT 'en',
	"board_slug" text NOT NULL,
	"creator_token" text NOT NULL,
	"board_id" uuid REFERENCES "boards"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_analyses_space_created_idx" ON "space_analyses" ("space_id", "created_at");
