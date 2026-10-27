import { and, eq, sql } from "drizzle-orm";
import { verifyDeviceToken } from "@/lib/auth/device";
import { getDb } from "@/lib/neon/client";
import { commands } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

// 밀린 명령 수. 읽기 전용, 부작용 없음. status용. next와 달리 delivered로 안 바꾼다.
export async function GET(request: Request): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    const rows = await getDb()
        .select({ count: sql<number>`COUNT(*)` })
        .from(commands)
        .where(and(eq(commands.deviceId, authed.deviceId), eq(commands.status, "pending")));
    return getNextBaseResponse(200).json({ success: true, status: 200, data: { pending: Number(rows[0]?.count ?? 0) } });
}
