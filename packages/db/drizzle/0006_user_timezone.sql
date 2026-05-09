-- 0006 — Add per-user IANA timezone for daily-note rollover
-- Idempotent. The cron job uses this to compute "current local date" per user.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "timezone" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_timezone_idx" ON "user" ("timezone");
