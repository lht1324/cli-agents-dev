import { and, eq, isNull } from "drizzle-orm";
import { readInternalUser } from "@/lib/auth/internal";
import { getDb } from "@/lib/neon/client";
import { devices, deviceTokens } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

// 웹에서 기기 해제. 세션 주인의 기기만 대상 (남의 기기 불가).
// 토큰 전부 revoke + 기기 행 삭제. 데몬은 다음 요청부터 401 → not logged in 상태로 전환된다.
export async function DELETE(request: Request): Promise<Response> {
    const userId = readInternalUser(request);
    if (!userId) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    const deviceId = new URL(request.url).searchParams.get("deviceId");
    if (!deviceId) {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "deviceId required" });
    }
    const db = getDb();
    const [row] = await db
        .select({ id: devices.id })
        .from(devices)
        .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
        .limit(1);
    if (!row) {
        return getNextBaseResponse(404).json({ success: false, status: 404, error: "device not found" });
    }
    await db
        .update(deviceTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(deviceTokens.deviceId, deviceId), isNull(deviceTokens.revokedAt)));
    await db.delete(devices).where(eq(devices.id, deviceId));
    return getNextBaseResponse(200).json({ success: true, status: 200, data: { deviceId } });
}
