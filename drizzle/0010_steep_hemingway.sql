CREATE TABLE "handoffs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"tab_id" text NOT NULL,
	"epoch" integer DEFAULT 0 NOT NULL,
	"version" text NOT NULL,
	"storage_key" text NOT NULL,
	"base_hash" text NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"sha256" text NOT NULL,
	"received_by" text,
	"received_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;