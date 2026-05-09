-- 0005 — Support tickets (in-app + public contact form unified)
-- Idempotent so it can be re-applied safely. Each statement is followed by
-- drizzle's required breakpoint marker so the migrator runs them individually.

DO $$ BEGIN
  CREATE TYPE "support_ticket_status" AS ENUM ('open','pending','resolved','closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "support_ticket_priority" AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "support_ticket_category" AS ENUM ('general','billing','bug','feature_request','account','gdpr','other');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" text PRIMARY KEY,
  "reference" text NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "subject" text NOT NULL,
  "category" "support_ticket_category" NOT NULL DEFAULT 'general',
  "priority" "support_ticket_priority" NOT NULL DEFAULT 'normal',
  "status" "support_ticket_status" NOT NULL DEFAULT 'open',
  "assignee_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "closed_at" timestamptz
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "support_tickets_user_idx"
  ON "support_tickets" ("user_id", "created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "support_tickets_status_idx"
  ON "support_tickets" ("status", "updated_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "support_tickets_reference_idx"
  ON "support_tickets" ("reference");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
  "id" text PRIMARY KEY,
  "ticket_id" text NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "author_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "from_staff" boolean NOT NULL DEFAULT false,
  "internal" boolean NOT NULL DEFAULT false,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "support_ticket_messages_ticket_idx"
  ON "support_ticket_messages" ("ticket_id", "created_at");
