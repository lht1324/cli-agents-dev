ALTER TABLE "handoffs" ADD COLUMN "user_msgs" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "handoffs" ADD COLUMN "ai_msgs" integer DEFAULT 0 NOT NULL;