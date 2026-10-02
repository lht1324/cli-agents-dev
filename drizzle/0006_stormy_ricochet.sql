CREATE TABLE "subscriptions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"plan_id" text DEFAULT 'plan-1' NOT NULL,
	"sync_interval_sec" integer DEFAULT 1800 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
