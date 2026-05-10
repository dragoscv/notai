-- 0015 — Note properties (Notion/Bear-style structured fields).
-- Each note can carry an ordered list of typed key/value pairs. Values
-- are stored in column-per-type slots; a CHECK keeps exactly one slot
-- populated.

CREATE TABLE IF NOT EXISTS "note_properties" (
  "id"          text PRIMARY KEY,
  "owner_id"    text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "note_id"     text NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
  "key"         text NOT NULL,
  "value_type"  text NOT NULL CHECK ("value_type" IN ('text','number','date','select','checkbox','url')),
  "value_text"   text,
  "value_number" numeric,
  "value_date"   timestamptz,
  "value_bool"   boolean,
  "position"    integer NOT NULL DEFAULT 0,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "note_properties_note_idx" ON "note_properties" ("note_id");
CREATE INDEX IF NOT EXISTS "note_properties_owner_key_idx" ON "note_properties" ("owner_id", "key");
CREATE UNIQUE INDEX IF NOT EXISTS "note_properties_note_key_uq" ON "note_properties" ("note_id", "key");
