-- 0016_share_slug_password
-- Adds: custom share slug + per-note password gate.

-- Custom slug for /p/<slug> pretty URLs. Unique per user when set so
-- two users can both use slug `daily` for their own notes.
ALTER TABLE notes ADD COLUMN public_share_slug text;
CREATE UNIQUE INDEX notes_owner_share_slug_unq ON notes (owner_id, public_share_slug)
  WHERE public_share_slug IS NOT NULL;

-- Per-note password lock. We store a scrypt-style hash (`$alg$N$r$p$salt$hash`)
-- in `password_hash`; when set, public-share + collaborator reads must
-- supply the password in a server action that validates the hash before
-- returning content. Null means "no password lock".
ALTER TABLE notes ADD COLUMN password_hash text;
ALTER TABLE notes ADD COLUMN password_set_at timestamptz;
