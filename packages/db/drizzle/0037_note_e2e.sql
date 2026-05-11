ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "is_encrypted" boolean DEFAULT false NOT NULL;
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "encrypted_body" text;
