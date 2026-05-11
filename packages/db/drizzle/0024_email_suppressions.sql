-- 0024_email_suppressions: store bounced/complained recipients so we
-- never resend to them. Populated by the Resend webhook
-- (POST /api/webhooks/resend) and by the unsubscribe link.

CREATE TYPE "email_suppression_reason" AS ENUM (
  'bounce',
  'complaint',
  'manual',
  'delivery_delayed'
);

CREATE TABLE IF NOT EXISTS "email_suppressions" (
  "email" text PRIMARY KEY,
  "reason" "email_suppression_reason" NOT NULL,
  "source" text,
  "detail" text,
  "payload" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "email_suppressions_reason_idx" ON "email_suppressions" ("reason", "created_at");
