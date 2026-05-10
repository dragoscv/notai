-- 0011 — Per-folder default tags. When a note is created inside a
-- folder with default_tag_ids set, those tags are auto-attached.

ALTER TABLE "folders"
  ADD COLUMN IF NOT EXISTS "default_tag_ids" jsonb NOT NULL DEFAULT '[]'::jsonb;
