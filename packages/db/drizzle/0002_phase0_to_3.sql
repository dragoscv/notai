-- 0002 — Phase 0–3 schema updates
-- Adds: soft delete + embeddings on notes, sharing invites, subscriptions,
-- versions, templates. Wraps in a transaction so partial failure rolls back.

BEGIN;

-- pgvector for "Ask my notes" RAG. Postgres 17 ships supported here on
-- Cloud SQL, Neon, and the docker image — we just need to enable it.
CREATE EXTENSION IF NOT EXISTS vector;

-- Soft delete + embedding columns on existing notes table
ALTER TABLE "notes"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536),
  ADD COLUMN IF NOT EXISTS "embedding_model" text,
  ADD COLUMN IF NOT EXISTS "embedding_updated_at" timestamptz;

CREATE INDEX IF NOT EXISTS "notes_owner_deleted_idx"
  ON "notes" ("owner_id", "deleted_at");

-- HNSW vector index — fast cosine search at the cost of a one-time build.
-- Created CONCURRENTLY-safe via IF NOT EXISTS; on a fresh DB this is empty
-- so it builds in milliseconds.
CREATE INDEX IF NOT EXISTS "notes_embedding_hnsw_idx"
  ON "notes" USING hnsw ("embedding" vector_cosine_ops);

-- ─── Sharing: pending invites ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "note_invites" (
  "id" text PRIMARY KEY,
  "note_id" text NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
  "invited_by" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" "collab_role" NOT NULL DEFAULT 'editor',
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "accepted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "note_invites_token_unq" ON "note_invites" ("token_hash");
CREATE INDEX IF NOT EXISTS "note_invites_note_idx" ON "note_invites" ("note_id");
CREATE INDEX IF NOT EXISTS "note_invites_email_idx" ON "note_invites" ("email");

-- ─── Billing ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "plan_tier" AS ENUM ('free','pro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "sub_status" AS ENUM (
    'active','trialing','past_due','canceled',
    'incomplete','incomplete_expired','unpaid','paused'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "stripe_price_id" text,
  "tier" "plan_tier" NOT NULL DEFAULT 'free',
  "status" "sub_status" NOT NULL DEFAULT 'active',
  "current_period_end" timestamptz,
  "cancel_at_period_end" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "subs_customer_unq"
  ON "subscriptions" ("stripe_customer_id");

CREATE TABLE IF NOT EXISTS "billing_events" (
  "id" text PRIMARY KEY,
  "type" text NOT NULL,
  "received_at" timestamptz NOT NULL DEFAULT now()
);

-- ─── Versions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "note_versions" (
  "id" text PRIMARY KEY,
  "note_id" text NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
  "author_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "plaintext" text NOT NULL DEFAULT '',
  "yjs_state" bytea NOT NULL,
  "size_bytes" integer NOT NULL DEFAULT 0,
  "label" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "note_versions_note_idx"
  ON "note_versions" ("note_id", "created_at");

-- ─── Templates ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "templates" (
  "id" text PRIMARY KEY,
  "slug" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "category" text NOT NULL DEFAULT 'general',
  "icon" text,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "body" jsonb NOT NULL,
  "author_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "is_official" boolean NOT NULL DEFAULT false,
  "is_published" boolean NOT NULL DEFAULT true,
  "uses" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "templates_published_category_idx"
  ON "templates" ("is_published", "category");

-- ─── Personal Access Tokens (web clipper, future CLI/SDK) ────────────────
CREATE TABLE IF NOT EXISTS "personal_access_tokens" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "scope" text NOT NULL DEFAULT 'clipper',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_used_at" timestamptz,
  "revoked_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "pat_user_idx"
  ON "personal_access_tokens" ("user_id");

COMMIT;
