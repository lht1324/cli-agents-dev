import { eq } from "drizzle-orm";
import { verifyDeviceToken } from "@/lib/auth/device";
import { getDb } from "@/lib/neon/client";
import { devices } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

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
    await getDb()
        .update(devices)
        .set({ lastSeenAt: new Date(), platform, hostname, ...(label ? { label } : {}) })
        .where(eq(devices.id, authed.deviceId));
    return getNextBaseResponse(200).json({ success: true, status: 200 });
}
