-- 0003 — Per-user AI provider secrets + model preferences
-- Adds: user_secrets (encrypted BYOK credentials) and user_ai_prefs
-- (per-feature provider/model selection).

BEGIN;

CREATE TABLE IF NOT EXISTS "user_secrets" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "ciphertext" text NOT NULL,
  "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "label" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_used_at" timestamptz,
  CONSTRAINT "user_secrets_user_provider_uniq" UNIQUE ("user_id", "provider")
);

CREATE INDEX IF NOT EXISTS "user_secrets_user_idx"
  ON "user_secrets" ("user_id");

CREATE TABLE IF NOT EXISTS "user_ai_prefs" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "chat_provider" text,
  "chat_model" text,
  "embed_provider" text,
  "embed_model" text,
  "transcribe_provider" text,
  "transcribe_model" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

COMMIT;
