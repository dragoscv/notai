-- 0007 — Per-note AI chat messages (P0-4)
-- One row per chat turn (user prompt or assistant reply). Per-user thread per
-- note: noteId + userId + createdAt orders the conversation.

DO $$ BEGIN
  CREATE TYPE "chat_role" AS ENUM ('user', 'assistant', 'system');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "note_chat_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "note_id" text NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" "chat_role" NOT NULL,
  "content" text NOT NULL,
  "citations" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "note_chat_msgs_idx"
  ON "note_chat_messages" ("note_id", "user_id", "created_at");
