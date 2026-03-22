CREATE TABLE "images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "data" bytea NOT NULL,
  "mime_type" text NOT NULL,
  "width" integer NOT NULL DEFAULT 0,
  "height" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "image_id" uuid REFERENCES "images"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "image_id" uuid REFERENCES "images"("id") ON DELETE SET NULL;
