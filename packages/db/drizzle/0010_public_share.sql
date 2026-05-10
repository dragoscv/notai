-- 0010 — Public read-only share link per note.
-- Adds a token column + expiry; nullable token means "not shared".

ALTER TABLE "notes"
  ADD COLUMN IF NOT EXISTS "public_share_token" text;
--> statement-breakpoint

ALTER TABLE "notes"
  ADD COLUMN IF NOT EXISTS "public_share_expires_at" timestamp with time zone;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "notes_public_share_token_unq"
  ON "notes" ("public_share_token");
