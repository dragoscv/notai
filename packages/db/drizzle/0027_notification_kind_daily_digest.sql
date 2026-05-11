-- 0027_notification_kind_daily_digest
-- Extend the notification_kind enum so the daily-digest cron can write rows.
-- ALTER TYPE ... ADD VALUE is non-transactional in older PG; in PG 12+ it's
-- safe inside a transaction as long as the enum is not used in the same
-- transaction. The migrator wraps each file in its own transaction.
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'daily_digest';
