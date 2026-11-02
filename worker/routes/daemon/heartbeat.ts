import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { DEFAULT_PLAN_ID, planOf } from "../../../lib/plans";
import { getDb } from "../../../lib/neon/client";
import { devices, subscriptions } from "../../../lib/neon/schema";
import type { AppEnv } from "../../../lib/env";
import type { DeviceVariables } from "../../middleware/device";

const heartbeat = new Hono<{ Bindings: AppEnv; Variables: DeviceVariables }>();

heartbeat.post("/", async (c) => {
    const userId = c.get("userId");
    const deviceId = c.get("deviceId");
    let body: { platform?: unknown; hostname?: unknown; label?: unknown };
    try {
        body = (await c.req.json()) as { platform?: unknown; hostname?: unknown; label?: unknown };
    } catch {
        return c.json({ success: false, status: 400, error: "invalid JSON body" }, 400);
    }
    const platform = typeof body.platform === "string" ? body.platform : null;
    const hostname = typeof body.hostname === "string" ? body.hostname : null;
    const label = typeof body.label === "string" ? body.label : null;

    const db = getDb();
    await db
        .insert(devices)
        .values({
            id: deviceId,
            userId,
            label: label ?? deviceId.slice(0, 8),
            platform,
            hostname,
            lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
            target: devices.id,
            set: {
                lastSeenAt: new Date(),
                platform,
                hostname,
                unlinkedAt: null,
                ...(label ? { label } : {}),
            },
        });

    const sub = await db
        .select({ interval: subscriptions.syncIntervalSec, plan: subscriptions.planId })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);
    const intervalSec = sub[0]?.interval ?? planOf(sub[0]?.plan ?? DEFAULT_PLAN_ID).syncIntervalSec;
    return c.json({ success: true, status: 200, data: { intervalSec } });
});

export default heartbeat;
