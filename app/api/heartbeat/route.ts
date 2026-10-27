import { eq } from "drizzle-orm";
import { verifyDeviceToken } from "@/lib/auth/device";
import { getDb } from "@/lib/neon/client";
import { devices, subscriptions } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";
import { DEFAULT_PLAN_ID, planOf } from "@/lib/plans";

interface HeartbeatBody {
    platform?: unknown;
    hostname?: unknown;
    label?: unknown;
}

// 데몬 heartbeat 수신. 토큰에서 기기·주인을 푼다.
export async function POST(request: Request): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    let body: HeartbeatBody;
    try {
        body = (await request.json()) as HeartbeatBody;
    } catch {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "invalid JSON body" });
    }
    const platform = typeof body.platform === "string" ? body.platform : null;
    const hostname = typeof body.hostname === "string" ? body.hostname : null;
    const label = typeof body.label === "string" ? body.label : null;
    const db = getDb();
    await db
        .insert(devices)
        .values({
            id: authed.deviceId,
            userId: authed.userId,
            label: label ?? authed.deviceId.slice(0, 8),
            platform,
            hostname,
            lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
            target: devices.id,
            set: { lastSeenAt: new Date(), platform, hostname, ...(label ? { label } : {}) },
        });
    const sub = await db
        .select({ interval: subscriptions.syncIntervalSec, plan: subscriptions.planId })
        .from(subscriptions)
        .where(eq(subscriptions.userId, authed.userId))
        .limit(1);
    const intervalSec =
        sub[0]?.interval ?? planOf(sub[0]?.plan ?? DEFAULT_PLAN_ID).syncIntervalSec;
    return getNextBaseResponse(200).json({ success: true, status: 200, data: { intervalSec } });
}
