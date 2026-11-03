import { Hono } from "hono";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { trialDaysLeft } from "../../../lib/billing";
import { DEFAULT_PLAN_ID } from "../../../lib/plans";
import { getDb } from "../../../lib/neon/client";
import { deviceTokens, sessionsMeta, subscriptions } from "../../../lib/neon/schema";
import type { AppEnv } from "../../../lib/env";
import type { DeviceVariables } from "../../middleware/device";
import { getBaseResponse } from "../../utils/getBaseResponse";

// 데몬 기본 조회/해제. 모두 기기 토큰 인증.
const basic = new Hono<{ Bindings: AppEnv; Variables: DeviceVariables }>();

basic.get("/whoami", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const users = await db.execute<{ email: string | null }>(
        sql`SELECT email FROM neon_auth."user" WHERE id = ${userId} LIMIT 1`,
    );
    const plans = await db
        .select({ planId: subscriptions.planId })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);
    return getBaseResponse({
        success: true,
        status: 200,
        data: { userId, email: users.rows[0]?.email ?? null, planId: plans[0]?.planId ?? DEFAULT_PLAN_ID },
    });
});

basic.get("/billing/status", async (c) => {
    const userId = c.get("userId");
    const daysLeft = await trialDaysLeft(userId);
    const [row] = await getDb()
        .select({
            cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
        })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);
    return getBaseResponse({
        success: true,
        status: 200,
        data: {
            active: daysLeft === null,
            daysLeft,
            cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
            currentPeriodEnd: row?.currentPeriodEnd?.toISOString() ?? null,
        },
    });
});

basic.post("/device/revoke", async (c) => {
    const deviceId = c.get("deviceId");
    await getDb()
        .update(deviceTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(deviceTokens.deviceId, deviceId), isNull(deviceTokens.revokedAt)));
    return getBaseResponse({ success: true, status: 200, data: { deviceId } });
});

// 지금 이 기기가 미러링 중인 세션 집합. 목록의 live 표시가 이 값을 쓴다.
basic.post("/sessions/current", async (c) => {
    const userId = c.get("userId");
    let body: { sessionIds?: unknown };
    try {
        body = (await c.req.json()) as { sessionIds?: unknown };
    } catch {
        return getBaseResponse({ success: false, status: 400, error: "invalid JSON body" });
    }
    const ids = Array.isArray(body.sessionIds)
        ? body.sessionIds.filter((v): v is string => typeof v === "string" && v.length > 0)
        : [];
    if (ids.length === 0) {
        return getBaseResponse({ success: true, status: 200, data: { marked: 0 } });
    }
    await getDb()
        .update(sessionsMeta)
        .set({ lastBodySyncAt: new Date() })
        .where(and(eq(sessionsMeta.userId, userId), inArray(sessionsMeta.id, ids)));
    return getBaseResponse({ success: true, status: 200, data: { marked: ids.length } });
});

export default basic;
