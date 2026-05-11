CREATE TABLE IF NOT EXISTS "user_keys" (
  "user_id" text PRIMARY KEY NOT NULL,
  "salt" text NOT NULL,
  "encrypted_master_key" text NOT NULL,
  "encrypted_master_key_by_recovery" text NOT NULL,
  "kdf_iters" integer DEFAULT 600000 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "rotated_at" timestamp with time zone
);

DO $$ BEGIN
 ALTER TABLE "user_keys" ADD CONSTRAINT "user_keys_user_id_user_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
