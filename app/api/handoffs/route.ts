import { and, desc, eq } from "drizzle-orm";
import { verifyDeviceToken } from "@/lib/auth/device";
import { getDb } from "@/lib/neon/client";
import { handoffs } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";
import { randomUUID } from "node:crypto";

// 인계 포인터 목록. 기기 토큰 전용. 탭별 최신 버전.
export async function GET(request: Request): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    const db = getDb();
    const rows = await db
        .select({
            id: handoffs.id,
            tabId: handoffs.tabId,
            title: handoffs.title,
            remote: handoffs.remote,
            branch: handoffs.branch,
            epoch: handoffs.epoch,
            version: handoffs.version,
            storageKey: handoffs.storageKey,
            baseHash: handoffs.baseHash,
            rowCount: handoffs.rowCount,
            userMsgs: handoffs.userMsgs,
            aiMsgs: handoffs.aiMsgs,
            sha256: handoffs.sha256,
            receivedBy: handoffs.receivedBy,
            receivedAt: handoffs.receivedAt,
            expiresAt: handoffs.expiresAt,
            createdAt: handoffs.createdAt,
        })
        .from(handoffs)
        .where(and(eq(handoffs.userId, authed.userId)))
        .orderBy(desc(handoffs.createdAt))
        .limit(50);
    return getNextBaseResponse(200).json({ success: true, status: 200, data: { versions: rows } });
}

interface HandoffBody {
    tabId?: unknown;
    title?: unknown;
    remote?: unknown;
    branch?: unknown;
    userMsgs?: unknown;
    aiMsgs?: unknown;
    epoch?: unknown;
    version?: unknown;
    storageKey?: unknown;
    baseHash?: unknown;
    rowCount?: unknown;
    sha256?: unknown;
    receivedVersion?: unknown;
}

// 포인터 등록 + 수신 기록. 버전 파일은 불변, 덮어쓰기 없음.
export async function POST(request: Request): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    let body: HandoffBody;
    try {
        body = (await request.json()) as HandoffBody;
    } catch {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "invalid JSON body" });
    }
    const db = getDb();
    if (typeof body.receivedVersion === "string" && body.receivedVersion.length > 0) {
        await db
            .update(handoffs)
            .set({ receivedBy: authed.deviceId, receivedAt: new Date() })
            .where(and(eq(handoffs.version, body.receivedVersion), eq(handoffs.userId, authed.userId)));
        return getNextBaseResponse(200).json({ success: true, status: 200, data: { received: body.receivedVersion } });
    }
    if (typeof body.tabId !== "string" || typeof body.version !== "string" || typeof body.storageKey !== "string") {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "tabId, version, storageKey are required" });
    }
    if (typeof body.sha256 !== "string" || typeof body.baseHash !== "string") {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "baseHash, sha256 are required" });
    }
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(handoffs).values({
        id: randomUUID(),
        userId: authed.userId,
        deviceId: authed.deviceId,
        tabId: body.tabId,
        title: typeof body.title === "string" ? body.title : null,
        remote: typeof body.remote === "string" ? body.remote : null,
        branch: typeof body.branch === "string" ? body.branch : null,
        epoch: typeof body.epoch === "number" ? body.epoch : 0,
        version: body.version,
        storageKey: body.storageKey,
        baseHash: body.baseHash,
        rowCount: typeof body.rowCount === "number" ? body.rowCount : 0,
        userMsgs: typeof body.userMsgs === "number" ? body.userMsgs : 0,
        aiMsgs: typeof body.aiMsgs === "number" ? body.aiMsgs : 0,
        sha256: body.sha256,
        expiresAt,
    });
    return getNextBaseResponse(201).json({ success: true, status: 201, data: { version: body.version } });
}
