ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "blog_handle" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_blog_handle_unq" ON "user" USING btree ("blog_handle") WHERE "blog_handle" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "blog_visible" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_blog_visible_idx" ON "notes" USING btree ("owner_id", "blog_visible") WHERE "blog_visible" = true;
