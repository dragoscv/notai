-- 0008 — Comments + mentions + notifications (P0-6)

DO $$ BEGIN
  CREATE TYPE "notification_kind" AS ENUM ('comment_mention', 'comment_reply', 'invite_received');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "note_comments" (
  "id" text PRIMARY KEY NOT NULL,
  "note_id" text NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "parent_id" text REFERENCES "note_comments"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "anchor" jsonb NOT NULL,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_comments_note_idx"
  ON "note_comments" ("note_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_comments_parent_idx"
  ON "note_comments" ("parent_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "note_comment_mentions" (
  "comment_id" text NOT NULL REFERENCES "note_comments"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "note_comment_mentions_unq"
  ON "note_comment_mentions" ("comment_id", "user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "kind" "notification_kind" NOT NULL,
  "payload" jsonb NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_idx"
  ON "notifications" ("user_id", "read_at", "created_at" DESC);
