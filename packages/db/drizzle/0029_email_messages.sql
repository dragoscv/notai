CREATE TABLE IF NOT EXISTS "email_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "message_id" text NOT NULL,
  "note_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "email_messages_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_messages_message_id_unq" ON "email_messages" USING btree ("message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_messages_note_idx" ON "email_messages" USING btree ("note_id");
