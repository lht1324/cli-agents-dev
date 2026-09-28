import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// 상주 데몬 1대 = 1행. 페어링 코드로 웹 계정과 연결한다.
export const devices = pgTable("devices", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    label: text("label").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 세션 메타만 저장한다. transcript 전문은 저장하지 않는다.
export const sessionsMeta = pgTable("sessions_meta", {
    id: text("id").primaryKey(),
    deviceId: text("device_id")
        .notNull()
        .references(() => devices.id),
    provider: text("provider").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull(),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
