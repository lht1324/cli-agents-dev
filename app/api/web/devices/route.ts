import { and, eq, isNull, or } from "drizzle-orm";
import { getIsValidRequestS2S } from "@/lib/utils/getIsValidRequest";
import { getDb } from "@/lib/neon/client";
import { commands, devices, deviceTokens, pendingApprovals, sessionLocations } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

// 웹에서 기기 해제. 세션 주인의 기기만 대상 (남의 기기 불가).
// 행을 지우지 않는다: 7개 테이블이 devices.id를 참조하고, 과거 세션의 출처와 명령 라우팅 정보를
// 보존해야 한다. 해제 = 토큰 revoke + unlinked_at 기록 + 목록에서 숨김.
// 그 기기에 남은 대기 명령·승인은 실행될 수 없으므로 만료시킨다.
export async function DELETE(request: Request): Promise<Response> {
    const userId = getIsValidRequestS2S(request);
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
        .where(and(eq(devices.id, deviceId), eq(devices.userId, userId), isNull(devices.unlinkedAt)))
        .limit(1);
    if (!row) {
        return getNextBaseResponse(404).json({ success: false, status: 404, error: "device not found" });
    }
    const now = new Date();
    await db
        .update(deviceTokens)
        .set({ revokedAt: now })
        .where(and(eq(deviceTokens.deviceId, deviceId), isNull(deviceTokens.revokedAt)));
    // 실행될 수 없는 대기분 정리. 이력은 남긴다 (status만 바꾼다).
    await db
        .update(commands)
        .set({ status: "expired", doneAt: now, result: "device unlinked" })
        .where(and(eq(commands.deviceId, deviceId), or(eq(commands.status, "pending"), eq(commands.status, "delivered"))));
    await db.delete(pendingApprovals).where(eq(pendingApprovals.deviceId, deviceId));
    await db.delete(sessionLocations).where(eq(sessionLocations.deviceId, deviceId));
    await db.update(devices).set({ unlinkedAt: now }).where(eq(devices.id, deviceId));
    return getNextBaseResponse(200).json({ success: true, status: 200, data: { deviceId } });
}
