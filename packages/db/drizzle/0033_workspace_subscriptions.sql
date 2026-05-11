CREATE TABLE IF NOT EXISTS "workspace_subscriptions" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"plan_id" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"tier" "plan_tier" DEFAULT 'free' NOT NULL,
	"status" "sub_status" DEFAULT 'active' NOT NULL,
	"interval" "billing_interval",
	"currency" "billing_currency",
	"seats" integer DEFAULT 1 NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wsubs_customer_unq" ON "workspace_subscriptions" ("stripe_customer_id");
