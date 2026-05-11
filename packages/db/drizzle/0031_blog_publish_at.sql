ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "blog_publish_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_blog_publish_at_idx"
  ON "notes" USING btree ("blog_publish_at")
  WHERE "blog_publish_at" IS NOT NULL;
