import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getIsValidRequestS2S } from "@/lib/utils/getIsValidRequest";
import { checkBillingGate } from "@/lib/billing";
import { getDb } from "@/lib/neon/client";
import { commands, devices, sessionsMeta } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

const EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;
// 명령 대상은 "지금 켜져 있는 기기"만 허용한다. 꺼진 기기에 넣으면 언제 실행될지 알 수 없고,
// 그 사이 유저는 보냈다고 착각한다. 화면에서도 활성 기기만 노출한다.
const ACTIVE_MS = 120_000;

interface CommandBody {
    userId?: unknown;
    deviceId?: unknown;
    type?: unknown;
    payload?: unknown;
}

// 웹 입력 → outbox INSERT. 게이트웨이를 거친 호출만 허용하고, userId는 세션에서 온 값을 쓴다.
export async function POST(request: Request): Promise<Response> {
    const userId = getIsValidRequestS2S(request);
    if (!userId) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }

    const gate = await checkBillingGate(userId);
    if (!gate.allowed) {
        return getNextBaseResponse(403).json({ success: false, status: 403, error: "trial_ended" });
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
    const db = getDb();

    // 대상 기기: 내 것이고, 해제되지 않았고, 지금 활성(heartbeat 2분 이내)이어야 한다.
    const target = await db
        .select({ lastSeenAt: devices.lastSeenAt })
        .from(devices)
        .where(and(eq(devices.id, body.deviceId), eq(devices.userId, userId), isNull(devices.unlinkedAt)))
        .limit(1);
    if (target.length === 0) {
        return getNextBaseResponse(404).json({ success: false, status: 404, error: "device not found" });
    }
    const lastSeen = target[0].lastSeenAt;
    if (!lastSeen || Date.now() - lastSeen.getTime() > ACTIVE_MS) {
        return getNextBaseResponse(409).json({ success: false, status: 409, error: "device is not active" });
    }

    // 대상 세션. payload 안의 sessionID를 컬럼으로 승격해 두면 "이 세션의 명령 이력"을 조회할 수 있다.
    const payloadText = typeof body.payload === "string" ? body.payload : "{}";
    let tabId: string | null = null;
    try {
        const parsed = JSON.parse(payloadText) as { sessionID?: unknown };
        tabId = typeof parsed.sessionID === "string" && parsed.sessionID.length > 0 ? parsed.sessionID : null;
    } catch {
        tabId = null;
    }
    if (tabId) {
        const owned = await db
            .select({ id: sessionsMeta.id })
            .from(sessionsMeta)
            .where(and(eq(sessionsMeta.id, tabId), eq(sessionsMeta.userId, userId)))
            .limit(1);
        if (owned.length === 0) {
            return getNextBaseResponse(404).json({ success: false, status: 404, error: "session not found" });
        }
    }

    await db.insert(commands).values({
        id,
        userId,
        deviceId: body.deviceId,
        tabId,
        type: body.type,
        payload: payloadText,
        idempotencyKey: randomUUID(),
        expiresAt: new Date(Date.now() + EXPIRES_IN_MS),
    });
    return getNextBaseResponse(201).json({ success: true, status: 201, data: { id, status: "pending" } });
}
