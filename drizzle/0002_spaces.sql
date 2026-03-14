CREATE TABLE "spaces" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "slug" text NOT NULL,
    "name" text NOT NULL,
    "password_hash" text NOT NULL,
    "creator_token" text NOT NULL DEFAULT '',
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "spaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "space_id" uuid;
--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
