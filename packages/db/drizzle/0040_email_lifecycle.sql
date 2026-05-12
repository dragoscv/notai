CREATE TABLE "email_lifecycle_sends" (
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_lifecycle_sends_user_id_kind_pk" PRIMARY KEY("user_id","kind")
);
--> statement-breakpoint
ALTER TABLE "email_lifecycle_sends" ADD CONSTRAINT "email_lifecycle_sends_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_lifecycle_sends_kind_idx" ON "email_lifecycle_sends" USING btree ("kind");
