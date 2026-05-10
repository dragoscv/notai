-- 0022_api_request_log: per-call audit trail for the public REST API.
-- Lets users see how their API keys are being used (counts, latency,
-- last-failure path). Aggressively pruned by the webhook-hygiene
-- cron — only the last 30 days are kept.

CREATE TABLE IF NOT EXISTS "api_request_log" (
  "id" text PRIMARY KEY,
  "api_key_id" text NOT NULL REFERENCES "api_keys"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "path" text NOT NULL,
  "method" text NOT NULL,
  "status" integer NOT NULL,
  "duration_ms" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "api_request_log_key_idx" ON "api_request_log"("api_key_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "api_request_log_user_idx" ON "api_request_log"("user_id", "created_at" DESC);
