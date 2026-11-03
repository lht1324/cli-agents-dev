import { Hono } from "hono";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { checkBillingGate, trialDaysLeft } from "../../../lib/billing";
import { getDb } from "../../../lib/neon/client";
import { devices, sessionsMeta, subscriptions } from "../../../lib/neon/schema";
import type { AppEnv } from "../../../lib/env";
import type { AuthVariables } from "../../middleware/auth";
import { getBaseResponse } from "../../utils/getBaseResponse";

const webAccount = new Hono<{ Bindings: AppEnv; Variables: AuthVariables }>();

// 웹 화면(Profile)이 쓰는 계정 정보. 구독 상태·기기 수·세션 수를 한 번에 준다.
webAccount.get("/", async (c) => {
    const userId = c.get("userId");
    const gate = await checkBillingGate(userId);
    const db = getDb();

    // 유저 기본 정보 (Neon Auth 거울 테이블 직독)
    const users = await db.execute<{
        email: string | null;
        name: string | null;
        image: string | null;
        createdAt: string | null;
    }>(sql`SELECT email, name, image, "createdAt" FROM neon_auth."user" WHERE id = ${userId} LIMIT 1`);
    const userRow = users.rows[0];

    const [sub] = await db
        .select({
            planId: subscriptions.planId,
            status: subscriptions.status,
            interval: subscriptions.interval,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            trialEndsAt: subscriptions.trialEndsAt,
            cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);

    // 세션은 계정 소유라 기기 유무와 무관하게 센다.
    const deviceRows = await db
        .select({ id: devices.id })
        .from(devices)
        .where(and(eq(devices.userId, userId), isNull(devices.unlinkedAt)));
    const sessionRows = await db
        .select({ id: sessionsMeta.id })
        .from(sessionsMeta)
        .where(and(eq(sessionsMeta.userId, userId), isNull(sessionsMeta.parentId)));
    const daysLeft = await trialDaysLeft(userId);

    return getBaseResponse({
        success: true,
        status: 200,
        data: {
            email: userRow?.email ?? null,
            name: userRow?.name ?? null,
            image: userRow?.image ?? null,
            memberSince: userRow?.createdAt ?? null,
            planId: sub?.planId ?? "plan-1",
            status: sub?.status ?? null,
            interval: sub?.interval ?? null,
            currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
            trialEndsAt: sub?.trialEndsAt?.toISOString() ?? null,
            cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
            deviceCount: deviceRows.length,
            sessionCount: sessionRows.length,
            daysLeft,
            billingBlocked: !gate.allowed,
        },
    });
});

// 기기 목록 (Devices 화면).
webAccount.get("/devices", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const rows = await db
        .select({
            id: devices.id,
            label: devices.label,
            platform: devices.platform,
            hostname: devices.hostname,
            lastSeenAt: devices.lastSeenAt,
        })
        .from(devices)
        .where(and(eq(devices.userId, userId), isNull(devices.unlinkedAt)))
        .orderBy(desc(devices.lastSeenAt));
    return getBaseResponse({
        success: true,
        status: 200,
        data: {
            items: rows.map((r) => ({ ...r, lastSeenAt: r.lastSeenAt?.toISOString() ?? null })),
        },
    });
});

export default webAccount;
