CREATE TABLE IF NOT EXISTS "note_presence" (
  "user_id" text NOT NULL,
  "note_id" text NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "note_presence" ADD CONSTRAINT "note_presence_user_id_user_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "note_presence" ADD CONSTRAINT "note_presence_note_id_notes_id_fk"
   FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "note_presence_user_note_uq"
  ON "note_presence" ("user_id", "note_id");

CREATE INDEX IF NOT EXISTS "note_presence_last_seen_idx"
  ON "note_presence" ("last_seen_at");
