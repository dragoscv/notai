-- 0025_user_deletion: soft-delete grace period for self-serve account
-- deletion. We mark `deletion_requested_at` and a nightly cron purges
-- users older than 30 days (configurable via ACCOUNT_DELETION_GRACE_DAYS).
-- Until then, the user can sign in and cancel the deletion.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "user_deletion_requested_idx"
  ON "user" ("deletion_requested_at")
  WHERE "deletion_requested_at" IS NOT NULL;
