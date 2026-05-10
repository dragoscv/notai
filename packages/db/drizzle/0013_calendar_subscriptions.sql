-- 0013 — Calendar (iCal) subscriptions. Users paste a public webcal/https
-- URL pointing to a calendar feed (Google/Outlook/Apple all expose one).
-- We fetch on-demand, server-side, with size + IP guards.

CREATE TABLE IF NOT EXISTS "calendar_subscriptions" (
  "id"          text PRIMARY KEY,
  "user_id"     text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name"        text NOT NULL,
  "url"         text NOT NULL,
  "color"       text,
  "enabled"     boolean NOT NULL DEFAULT true,
  "last_fetched_at" timestamptz,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "calendar_subs_user_idx"
  ON "calendar_subscriptions" ("user_id");
