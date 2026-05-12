-- 0041_public_share_image
-- Cached PNG snapshot of the Excalidraw scene used as the OpenGraph
-- image at /p/<token-or-slug>. Populated by a client-side capture at
-- publish time + manual refresh. Null means: fall back to the CSS card.

ALTER TABLE notes ADD COLUMN public_share_image_url text;
