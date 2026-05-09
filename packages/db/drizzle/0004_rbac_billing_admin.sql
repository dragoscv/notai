-- 0004 — RBAC + plans/prices + admin tables + user status
-- Phase 1 of the platform/billing/admin build. Idempotent so it can be
-- re-applied safely. Each statement is followed by drizzle's required
-- breakpoint marker so the migrator runs them individually.

DO $$ BEGIN
  CREATE TYPE "user_status" AS ENUM ('active','suspended','deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "status" "user_status" NOT NULL DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "suspended_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "suspended_reason" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamptz;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "plan_slug" AS ENUM ('free','pro','teams');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "billing_interval" AS ENUM ('month','year');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "billing_currency" AS ENUM ('eur','usd','ron');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plans" (
  "id" text PRIMARY KEY,
  "slug" "plan_slug" NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "description" text,
  "features" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "limits" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "stripe_product_id" text,
  "trial_days" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plan_prices" (
  "id" text PRIMARY KEY,
  "plan_id" text NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
  "currency" "billing_currency" NOT NULL,
  "interval" "billing_interval" NOT NULL,
  "unit_amount" integer NOT NULL,
  "stripe_price_id" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plan_prices_plan_currency_interval_unq"
  ON "plan_prices" ("plan_id", "currency", "interval");
--> statement-breakpoint
ALTER TYPE "plan_tier" ADD VALUE IF NOT EXISTS 'teams';
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "plan_id" text REFERENCES "plans"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "interval" "billing_interval";
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "currency" "billing_currency";
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "comp_reason" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "description" text,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
  "id" text PRIMARY KEY,
  "key" text NOT NULL UNIQUE,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
  "role_id" text NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permission_id" text NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  PRIMARY KEY ("role_id", "permission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role_id" text NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "granted_at" timestamptz NOT NULL DEFAULT now(),
  "granted_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  PRIMARY KEY ("user_id", "role_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_counters" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "period_start" timestamptz NOT NULL,
  "ai_actions" integer NOT NULL DEFAULT 0,
  "exports_run" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usage_counters_pk"
  ON "usage_counters" ("user_id", "period_start");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_counters_period_idx"
  ON "usage_counters" ("period_start");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_devices" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "client_id" text NOT NULL,
  "label" text,
  "platform" text,
  "user_agent" text,
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_devices_user_client_unq"
  ON "user_devices" ("user_id", "client_id");
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "referral_status" AS ENUM ('pending','accepted','credited','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referrals" (
  "id" text PRIMARY KEY,
  "inviter_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "code" text NOT NULL UNIQUE,
  "invitee_email" text,
  "invitee_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "status" "referral_status" NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "accepted_at" timestamptz,
  "credited_at" timestamptz
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referrals_inviter_idx" ON "referrals" ("inviter_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" text PRIMARY KEY,
  "actor_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" text,
  "before" jsonb,
  "after" jsonb,
  "metadata" jsonb,
  "ip" text,
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_actor_idx"
  ON "audit_log" ("actor_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_resource_idx"
  ON "audit_log" ("resource_type", "resource_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_created_idx"
  ON "audit_log" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feature_flags" (
  "key" text PRIMARY KEY,
  "description" text,
  "default_enabled" boolean NOT NULL DEFAULT false,
  "rollout_percent" jsonb DEFAULT 'null'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_feature_flags" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "key" text NOT NULL REFERENCES "feature_flags"("key") ON DELETE CASCADE,
  "enabled" boolean NOT NULL,
  "set_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_feature_flags_pk"
  ON "user_feature_flags" ("user_id", "key");
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "broadcast_status" AS ENUM ('draft','queued','sending','sent','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "broadcasts" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "segment" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" "broadcast_status" NOT NULL DEFAULT 'draft',
  "scheduled_for" timestamptz,
  "sent_at" timestamptz,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "broadcasts_status_idx"
  ON "broadcasts" ("status", "scheduled_for");
