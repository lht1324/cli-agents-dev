ALTER TABLE "sessions_meta" ADD COLUMN "cost" real;--> statement-breakpoint
ALTER TABLE "sessions_meta" ADD COLUMN "last_input" integer;--> statement-breakpoint
ALTER TABLE "sessions_meta" ADD COLUMN "last_output" integer;--> statement-breakpoint
ALTER TABLE "sessions_meta" ADD COLUMN "last_reasoning" integer;--> statement-breakpoint
ALTER TABLE "sessions_meta" ADD COLUMN "last_cache_read" integer;--> statement-breakpoint
ALTER TABLE "sessions_meta" ADD COLUMN "last_cache_write" integer;--> statement-breakpoint
ALTER TABLE "sessions_meta" ADD COLUMN "msg_user" integer;--> statement-breakpoint
ALTER TABLE "sessions_meta" ADD COLUMN "msg_assistant" integer;--> statement-breakpoint
ALTER TABLE "sessions_meta" ADD COLUMN "session_created_at" timestamp with time zone;