-- 0014 — Inbound email aliases. Each user gets a routing token used as the
-- mailbox-hash / +tag part of an inbound address (e.g. "you+abc123@in.notai.app").
-- An inbound webhook posts here with the parsed payload.

CREATE TABLE IF NOT EXISTS "email_aliases" (
  "id"          text PRIMARY KEY,
  "user_id"     text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
  "token"       text NOT NULL UNIQUE,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "rotated_at"  timestamptz
);

CREATE INDEX IF NOT EXISTS "email_aliases_token_idx" ON "email_aliases" ("token");
