-- 0023_webauthn: passkey / WebAuthn credential storage. One row per
-- enrolled authenticator; counter is updated on every successful login
-- to detect cloned authenticators.

CREATE TABLE IF NOT EXISTS "webauthn_credentials" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "credential_id" text NOT NULL UNIQUE,
  "public_key" bytea NOT NULL,
  "counter" integer NOT NULL DEFAULT 0,
  "transports" text,
  "device_type" text NOT NULL DEFAULT 'singleDevice',
  "backed_up" boolean NOT NULL DEFAULT false,
  "label" text,
  "last_used_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "webauthn_credentials_user_idx" ON "webauthn_credentials" ("user_id");
