import { Hono } from "hono";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { checkBillingGate } from "../../../lib/billing";
import { getDb } from "../../../lib/neon/client";
import { commands } from "../../../lib/neon/schema";
import type { AppEnv } from "../../../lib/env";
import type { DeviceVariables } from "../../middleware/device";
import { getBaseResponse } from "../../utils/getBaseResponse";

const daemonCommands = new Hono<{ Bindings: AppEnv; Variables: DeviceVariables }>();

// 밀린 명령 수. 읽기 전용, 부작용 없음 (status용).
daemonCommands.get("/pending", async (c) => {
    const deviceId = c.get("deviceId");
    const rows = await getDb()
        .select({ count: sql<number>`COUNT(*)` })
        .from(commands)
        .where(and(eq(commands.deviceId, deviceId), eq(commands.status, "pending")));
    return getBaseResponse({ success: true, status: 200, data: { pending: Number(rows[0]?.count ?? 0) } });
});

// 가장 오래된 1건을 원자적으로 claim해서 넘긴다.
daemonCommands.get("/next", async (c) => {
    const userId = c.get("userId");
    const deviceId = c.get("deviceId");
    const gate = await checkBillingGate(userId);
    if (!gate.allowed) {
        return getBaseResponse({ success: false, status: 403, error: "trial_ended" });
    }
    const db = getDb();
    const oldest = await db
        .select({ id: commands.id })
        .from(commands)
        .where(
            and(eq(commands.deviceId, deviceId), eq(commands.status, "pending"), gt(commands.expiresAt, new Date())),
        )
        .orderBy(asc(commands.createdAt))
        .limit(1);
    if (oldest.length === 0) {
        return new Response(null, { status: 204 });
    }
    const claimed = await db
        .update(commands)
        .set({ status: "delivered", deliveredAt: new Date() })
        .where(and(eq(commands.id, oldest[0].id), eq(commands.status, "pending")))
        .returning({ id: commands.id, type: commands.type, payload: commands.payload });
    if (claimed.length === 0) {
        return new Response(null, { status: 204 });
    }
    return getBaseResponse({ success: true, status: 200, data: claimed[0] });
});

// 실행 결과 보고. 본인 기기 명령만 갱신한다.
daemonCommands.post("/:id/result", async (c) => {
    const deviceId = c.get("deviceId");
    const id = c.req.param("id");
    let body: { ok?: unknown; data?: unknown; error?: unknown };
    try {
        body = (await c.req.json()) as { ok?: unknown; data?: unknown; error?: unknown };
    } catch {
        return getBaseResponse({ success: false, status: 400, error: "invalid JSON body" });
    }
    const result = JSON.stringify({
        ok: body.ok === true,
        ...(typeof body.data === "string" ? { data: body.data } : {}),
        ...(typeof body.error === "string" ? { error: body.error } : {}),
    });
    await getDb()
        .update(commands)
        .set({ status: "done", doneAt: new Date(), result })
        .where(and(eq(commands.id, id), eq(commands.deviceId, deviceId)));
    return getBaseResponse({ success: true, status: 200 });
});

export default daemonCommands;
