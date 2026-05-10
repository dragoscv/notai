-- 0009 — Dashboard saved views + per-note "pinned on Today" flag

ALTER TABLE "notes"
  ADD COLUMN IF NOT EXISTS "is_pinned_on_today" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "notes_owner_today_pinned_idx"
  ON "notes" ("owner_id", "is_pinned_on_today", "position");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_views" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "scope" text NOT NULL,
  "name" text NOT NULL,
  "sort" text NOT NULL DEFAULT 'updated',
  "pinned_first" boolean NOT NULL DEFAULT true,
  "filters" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_default" boolean NOT NULL DEFAULT false,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "user_views_user_scope_name_unq"
  ON "user_views" ("user_id", "scope", "name");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_views_user_scope_pos_idx"
  ON "user_views" ("user_id", "scope", "position");
