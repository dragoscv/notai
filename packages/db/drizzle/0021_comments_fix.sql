-- 0021_comments_fix: ensure the canonical comments tables exist.
--
-- IDEMPOTENT and DATA-SAFE. This migration runs on:
--   - production: where 0008_comments already created the canonical
--     tables with real user data (no-op via IF NOT EXISTS).
--   - local: where the original (now superseded) 0020 may have left
--     an inconsistent shape; the IF NOT EXISTS guards still allow
--     this migration to record cleanly.
--
-- DOES NOT drop or alter any existing rows. Production data is safe.

CREATE TABLE IF NOT EXISTS "note_comments" (
  "id" text PRIMARY KEY NOT NULL,
  "note_id" text NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "parent_id" text REFERENCES "note_comments"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "anchor" jsonb NOT NULL,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "note_comments_note_idx" ON "note_comments"("note_id", "created_at");
CREATE INDEX IF NOT EXISTS "note_comments_parent_idx" ON "note_comments"("parent_id");

CREATE TABLE IF NOT EXISTS "note_comment_mentions" (
  "comment_id" text NOT NULL REFERENCES "note_comments"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "note_comment_mentions_unq" ON "note_comment_mentions"("comment_id", "user_id");
