import { Hono } from "hono";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "../../../lib/neon/client";
import {
    commands,
    deviceTokens,
    devices,
    pendingApprovals,
    sessionLocations,
    sessionsMeta,
} from "../../../lib/neon/schema";
import type { AppEnv } from "../../../lib/env";
import type { AuthVariables } from "../../middleware/auth";
import { getBaseResponse } from "../../utils/getBaseResponse";

const webDevices = new Hono<{ Bindings: AppEnv; Variables: AuthVariables }>();

// 웹에서 기기 해제. 세션 주인의 기기만 대상 (남의 기기 불가).
// 행을 지우지 않는다: 7개 테이블이 devices.id를 참조하고, 과거 세션의 출처와 명령 라우팅 정보를
// 보존해야 한다. 해제 = 토큰 revoke + unlinked_at 기록 + 목록에서 숨김.
// 그 기기에 남은 대기 명령·승인은 실행될 수 없으므로 만료시킨다.
webDevices.delete("/", async (c) => {
    const userId = c.get("userId");
    const deviceId = c.req.query("deviceId");
    if (!deviceId) {
        return getBaseResponse({ success: false, status: 400, error: "deviceId required" });
    }
    const db = getDb();
    const [row] = await db
        .select({ id: devices.id })
        .from(devices)
        .where(and(eq(devices.id, deviceId), eq(devices.userId, userId), isNull(devices.unlinkedAt)))
        .limit(1);
    if (!row) {
        return getBaseResponse({ success: false, status: 404, error: "device not found" });
    }
    const now = new Date();
    await db
        .update(deviceTokens)
        .set({ revokedAt: now })
        .where(and(eq(deviceTokens.deviceId, deviceId), isNull(deviceTokens.revokedAt)));
    await db
        .update(commands)
        .set({ status: "expired", doneAt: now, result: "device unlinked" })
        .where(and(eq(commands.deviceId, deviceId), or(eq(commands.status, "pending"), eq(commands.status, "delivered"))));
    await db
        .delete(pendingApprovals)
        .where(and(eq(pendingApprovals.deviceId, deviceId), eq(pendingApprovals.userId, userId)));
    await db
        .delete(sessionLocations)
        .where(
            and(
                eq(sessionLocations.deviceId, deviceId),
                inArray(
                    sessionLocations.tabId,
                    db.select({ id: sessionsMeta.id }).from(sessionsMeta).where(eq(sessionsMeta.userId, userId)),
                ),
            ),
        );
    await db
        .update(devices)
        .set({ unlinkedAt: now })
        .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)));
    return getBaseResponse({ success: true, status: 200, data: { deviceId } });
});

export default webDevices;
