CREATE TABLE "session_locations" (
	"tab_id" text NOT NULL,
	"device_id" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_locations_tab_id_device_id_pk" PRIMARY KEY("tab_id","device_id")
);
--> statement-breakpoint
ALTER TABLE "commands" ADD COLUMN "tab_id" text;--> statement-breakpoint
ALTER TABLE "sessions_meta" ADD COLUMN "user_id" text;--> statement-breakpoint
UPDATE "sessions_meta" SET "user_id" = "devices"."user_id" FROM "devices" WHERE "sessions_meta"."device_id" = "devices"."id" AND "sessions_meta"."user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "sessions_meta" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "session_locations" ADD CONSTRAINT "session_locations_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;
