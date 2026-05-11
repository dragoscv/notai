CREATE TABLE IF NOT EXISTS "e2e_audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "note_id" text REFERENCES "notes"("id") ON DELETE SET NULL,
  "event" text NOT NULL,
  "user_agent" text,
  "ip" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "e2e_audit_log_user_created_idx"
  ON "e2e_audit_log" ("user_id", "created_at" DESC);
