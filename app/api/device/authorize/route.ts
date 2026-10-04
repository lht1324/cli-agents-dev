import { createHash, randomUUID } from "node:crypto";
import { auth } from "@/lib/auth/server";
import { getDb } from "@/lib/neon/client";
import { devices, deviceTokens } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

interface AuthorizeBody {
    deviceId?: unknown;
    label?: unknown;
    platform?: unknown;
    hostname?: unknown;
}

// loopback 로그인 확정. 웹 세션 주인으로 기기 행 + 토큰 발급.
export async function POST(request: Request): Promise<Response> {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "login required" });
    }
    let body: AuthorizeBody;
    try {
        body = (await request.json()) as AuthorizeBody;
    } catch {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "invalid JSON body" });
    }
    if (typeof body.deviceId !== "string" || body.deviceId.length === 0) {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "deviceId is required" });
    }
    const label = typeof body.label === "string" && body.label.length > 0 ? body.label : "My PC";
    const platform = typeof body.platform === "string" ? body.platform : null;
    const hostname = typeof body.hostname === "string" ? body.hostname : null;
    const db = getDb();
    await db
        .insert(devices)
        .values({ id: body.deviceId, userId: session.user.id, label, platform, hostname })
        .onConflictDoUpdate({
            target: devices.id,
            set: { userId: session.user.id, label, platform, hostname },
        });
    const token = `cliag_${randomUUID().replace(/-/g, "")}`;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db.insert(deviceTokens).values({
        id: randomUUID(),
        deviceId: body.deviceId,
        tokenHash,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
    return getNextBaseResponse(201).json({ success: true, status: 201, data: { token } });
}
