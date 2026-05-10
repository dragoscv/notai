-- 0018_api_keys: developer API keys for the public REST API and
-- web push subscription store for browser/desktop notifications.

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" varchar(80) NOT NULL,
  "prefix" varchar(12) NOT NULL,
  "hashed_key" text NOT NULL,
  "scopes" text NOT NULL DEFAULT 'notes:read notes:write',
  "last_used_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "revoked_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "api_keys_user_idx" ON "api_keys"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_prefix_unq" ON "api_keys"("prefix");

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_unq" ON "push_subscriptions"("endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "push_subscriptions"("user_id");
