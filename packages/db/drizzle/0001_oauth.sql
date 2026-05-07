CREATE TYPE "public"."oauth_client_type" AS ENUM('confidential', 'public');--> statement-breakpoint
CREATE TYPE "public"."oauth_token_kind" AS ENUM('authorization_code', 'access_token', 'refresh_token');--> statement-breakpoint
CREATE TABLE "oauth_client" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_hash" text,
	"type" "oauth_client_type" DEFAULT 'confidential' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"logo_uri" text,
	"client_uri" text,
	"redirect_uris" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_scopes" text DEFAULT 'openid profile email offline_access notes:read notes:write' NOT NULL,
	"dynamically_registered" boolean DEFAULT false NOT NULL,
	"registration_access_token_hash" text,
	"owner_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "oauth_client_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_consent" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"scopes" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "oauth_token" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text,
	"kind" "oauth_token_kind" NOT NULL,
	"token_hash" text NOT NULL,
	"token_family_id" text NOT NULL,
	"scopes" text DEFAULT '' NOT NULL,
	"code_challenge" text,
	"code_challenge_method" text,
	"redirect_uri" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "oauth_client" ADD CONSTRAINT "oauth_client_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consent" ADD CONSTRAINT "oauth_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consent" ADD CONSTRAINT "oauth_consent_client_id_oauth_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_token" ADD CONSTRAINT "oauth_token_client_id_oauth_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_token" ADD CONSTRAINT "oauth_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_client_owner_idx" ON "oauth_client" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_consent_user_client_unq" ON "oauth_consent" USING btree ("user_id","client_id");--> statement-breakpoint
CREATE INDEX "oauth_token_client_idx" ON "oauth_token" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_token_user_idx" ON "oauth_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_token_kind_idx" ON "oauth_token" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "oauth_token_family_idx" ON "oauth_token" USING btree ("token_family_id");