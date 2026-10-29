import { eq } from "drizzle-orm";
import { getIsValidRequestDevice } from "@/lib/utils/getIsValidRequest";
import { checkBillingGate } from "@/lib/billing";
import { getDb } from "@/lib/neon/client";
import { cloudMessages, cloudTabs, sessionLocations, sessionsMeta } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

interface MessageRow {
    sessionID?: unknown;
    messageId?: unknown;
    id?: unknown;
    seq?: unknown;
    role?: unknown;
    kind?: unknown;
    body?: unknown;
    createdAt?: unknown;
}

interface MessagesBody {
    messages?: unknown;
}

// 데몬 대화 행 수신. INSERT-only. 탭 거울 행 없으면 함께 만든다.
// 채널: daemon (기기 토큰). 웹 조회는 /api/web/messages 소관이다.
export async function POST(request: Request): Promise<Response> {
    const authed = await getIsValidRequestDevice(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    const gate = await checkBillingGate(authed.userId);
    if (!gate.allowed) {
        return getNextBaseResponse(403).json({ success: false, status: 403, error: "trial_ended" });
    }
    let body: MessagesBody;
    try {
        body = (await request.json()) as MessagesBody;
    } catch {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "invalid JSON body" });
    }
    const rows = Array.isArray(body.messages) ? (body.messages as MessageRow[]) : [];
    const db = getDb();
    const tabs = new Set<string>();
    let inserted = 0;
    for (const m of rows) {
        const messageId =
            typeof m.messageId === "string" && m.messageId.length > 0
                ? m.messageId
                : typeof m.id === "string" && m.id.length > 0
                  ? m.id
                  : null;
        if (typeof m.sessionID !== "string" || typeof m.seq !== "number" || !messageId) {
            continue;
        }
        if (!tabs.has(m.sessionID)) {
            tabs.add(m.sessionID);
            await db
                .insert(cloudTabs)
                .values({
                    id: m.sessionID,
                    userId: authed.userId,
                    deviceId: authed.deviceId,
                    provider: "opencode",
                    title: m.sessionID,
                    status: "active",
                })
                .onConflictDoNothing();
            await db
                .update(sessionsMeta)
                .set({ lastSyncAt: new Date() })
                .where(eq(sessionsMeta.id, m.sessionID));
            // 메시지는 빠른 층에서 자주 오므로 위치 추적도 여기서 갱신한다.
            // sync(느린 층)만 기다리면 최대 플랜 주기만큼 "세션을 가진 기기"를 모른다.
            await db
                .insert(sessionLocations)
                .values({ tabId: m.sessionID, deviceId: authed.deviceId, lastSeenAt: new Date() })
                .onConflictDoUpdate({
                    target: [sessionLocations.tabId, sessionLocations.deviceId],
                    set: { lastSeenAt: new Date() },
                });
        }
        const createdAt =
            typeof m.createdAt === "number" ? new Date(m.createdAt) : typeof m.createdAt === "string" ? new Date(m.createdAt) : null;
        await db
            .insert(cloudMessages)
            .values({
                tabId: m.sessionID,
                messageId,
                seq: m.seq,
                role: typeof m.role === "string" ? m.role : "?",
                kind: typeof m.kind === "string" ? m.kind : "text",
                body: typeof m.body === "string" ? m.body : "",
                ...(createdAt && !isNaN(createdAt.getTime()) ? { createdAt } : {}),
            })
            .onConflictDoNothing();
        inserted++;
    }
    return getNextBaseResponse(200).json({ success: true, status: 200, data: { rows: inserted } });
}
