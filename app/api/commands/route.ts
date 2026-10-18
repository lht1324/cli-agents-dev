import { randomUUID } from "node:crypto";
import { readInternalUser } from "@/lib/auth/internal";
import { getDb } from "@/lib/neon/client";
import { commands } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

const EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;

interface CommandBody {
    userId?: unknown;
    deviceId?: unknown;
    type?: unknown;
    payload?: unknown;
}

// 웹 입력 → outbox INSERT. 게이트웨이를 거친 호출만 허용하고, userId는 세션에서 온 값을 쓴다.
export async function POST(request: Request): Promise<Response> {
    const userId = readInternalUser(request);
    if (!userId) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    let body: CommandBody;
    try {
        body = (await request.json()) as CommandBody;
    } catch {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "invalid JSON body" });
    }
    if (typeof body.deviceId !== "string" || body.deviceId.length === 0) {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "deviceId is required" });
    }
    if (typeof body.type !== "string" || body.type.length === 0) {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "type is required" });
    }
    const id = randomUUID();
    await getDb().insert(commands).values({
        id,
        userId,
        deviceId: body.deviceId,
        type: body.type,
        payload: typeof body.payload === "string" ? body.payload : "{}",
        idempotencyKey: randomUUID(),
        expiresAt: new Date(Date.now() + EXPIRES_IN_MS),
    });
    return getNextBaseResponse(201).json({ success: true, status: 201, data: { id, status: "pending" } });
}
