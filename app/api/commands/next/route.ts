import { and, asc, eq, gt } from "drizzle-orm";
import { verifyDeviceToken } from "@/lib/auth/device";
import { getDb } from "@/lib/neon/client";
import { commands } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

// 데몬 poll용. 가장 오래된 1건을 원자적으로 claim해서 넘긴다.
export async function GET(request: Request): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    const db = getDb();
    const oldest = await db
        .select({ id: commands.id })
        .from(commands)
        .where(and(eq(commands.deviceId, authed.deviceId), eq(commands.status, "pending"), gt(commands.expiresAt, new Date())))
        .orderBy(asc(commands.createdAt))
        .limit(1);
    if (oldest.length === 0) {
        return getNextBaseResponse(204).json({ success: true, status: 204 });
    }
    const claimed = await db
        .update(commands)
        .set({ status: "delivered", deliveredAt: new Date() })
        .where(and(eq(commands.id, oldest[0].id), eq(commands.status, "pending")))
        .returning({ id: commands.id, type: commands.type, payload: commands.payload });
    if (claimed.length === 0) {
        return getNextBaseResponse(204).json({ success: true, status: 204 });
    }
    return getNextBaseResponse(200).json({ success: true, status: 200, data: claimed[0] });
}
