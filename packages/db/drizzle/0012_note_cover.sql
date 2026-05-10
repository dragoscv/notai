-- 0012 — Note cover images. A note can have an optional cover URL (any
-- asset already uploaded to the user's storage) and a vertical focal
-- point in 0..100 used as `object-position-y` so the user can pick
-- which part of a wide image is visible inside the banner.

ALTER TABLE "notes"
  ADD COLUMN IF NOT EXISTS "cover_url" text,
  ADD COLUMN IF NOT EXISTS "cover_position" integer NOT NULL DEFAULT 50;
