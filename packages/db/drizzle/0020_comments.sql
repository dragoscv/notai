-- 0020_comments: SUPERSEDED.
--
-- Earlier in development this migration tried to (re)create a
-- `note_comments` table with an `author_id` column, unaware that
-- migration 0008 had already established the canonical schema with
-- `user_id`, `anchor` jsonb, and `resolved_at`. Applying the
-- original 0020 against a database that has 0008's data would
-- destroy comments. This file is now intentionally a no-op so it
-- replays safely on any environment. The corrective work lives in
-- 0021_comments_fix.sql, which is itself idempotent.

SELECT 1;
