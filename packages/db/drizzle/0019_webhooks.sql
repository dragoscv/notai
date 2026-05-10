-- 0019_webhooks: outgoing webhook subscriptions and a delivery log.
-- Each user can register up to N URLs that receive POSTed JSON
-- envelopes when one of their notes is created/updated/archived.

CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "secret" text NOT NULL,
  "events" text NOT NULL DEFAULT 'note.created note.updated note.archived',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_success_at" timestamp with time zone,
  "last_failure_at" timestamp with time zone,
  "failure_count" integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "webhook_endpoints_user_idx" ON "webhook_endpoints"("user_id");

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" text PRIMARY KEY,
  "endpoint_id" text NOT NULL REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE,
  "event" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status_code" integer,
  "response_body" text,
  "delivered_at" timestamp with time zone NOT NULL DEFAULT now(),
  "duration_ms" integer
);
CREATE INDEX IF NOT EXISTS "webhook_deliveries_endpoint_idx" ON "webhook_deliveries"("endpoint_id", "delivered_at" DESC);
