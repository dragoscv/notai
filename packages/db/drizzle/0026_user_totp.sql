-- 0026_user_totp: optional TOTP (Google Authenticator-style) per user.
-- One row per user; only created when enrollment starts. We persist the
-- raw base32 secret because TOTP requires it for verification — the DB
-- itself is treated as trust boundary (encrypted at rest by the cloud
-- provider). Recovery codes are stored hashed (sha256, single-use).

CREATE TABLE IF NOT EXISTS "user_totp" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "secret" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "enabled_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  "last_step_up_at" timestamp with time zone,
  "recovery_codes_hashed" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
