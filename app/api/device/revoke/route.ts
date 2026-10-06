import { and, eq, isNull } from "drizzle-orm";
import { verifyDeviceToken } from "@/lib/auth/device";
import { getDb } from "@/lib/neon/client";
import { deviceTokens } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

// 자기 기기 토큰 전부 revoke. logout용. 이 기기에서만 호출한다.
export async function POST(request: Request): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    await getDb()
        .update(deviceTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(deviceTokens.deviceId, authed.deviceId), isNull(deviceTokens.revokedAt)));
    return getNextBaseResponse(200).json({ success: true, status: 200, data: { deviceId: authed.deviceId } });
}
