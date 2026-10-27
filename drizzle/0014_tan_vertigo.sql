ALTER TABLE "subscriptions" ADD COLUMN "dodo_subscription_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "interval" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "current_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "trial_ends_at" timestamp with time zone;