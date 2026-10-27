import { and, desc, eq } from "drizzle-orm";
import { getIsValidRequestS2S } from "@/lib/utils/getIsValidRequest";
import { getDb } from "@/lib/neon/client";
import { cloudMessages, cloudTabs, commands, devices, sessionsMeta } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

// 웹 실시간 폴링용 스레드 조회. 본인 탭만. 5초 폴링 1회가 이 쿼리 1방이다.
// 채널: web (게이트웨이가 세션을 검증하고 userId 주입). 데몬 적재는 /api/daemon/messages 소관이다.
export async function GET(request: Request): Promise<Response> {
    const viewerId = getIsValidRequestS2S(request);
    if (!viewerId) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    const tabId = new URL(request.url).searchParams.get("tabId");
    if (!tabId) {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "tabId is required" });
    }
    const db = getDb();
    const thread = await db
        .select({
            id: cloudMessages.messageId,
            seq: cloudMessages.seq,
            role: cloudMessages.role,
            kind: cloudMessages.kind,
            body: cloudMessages.body,
            createdAt: cloudMessages.createdAt,
        })
        .from(cloudMessages)
        .innerJoin(cloudTabs, eq(cloudMessages.tabId, cloudTabs.id))
        .where(and(eq(cloudMessages.tabId, tabId), eq(cloudTabs.userId, viewerId)))
        .orderBy(cloudMessages.createdAt, cloudMessages.seq);
    const seen = await db
        .select({ lastSeenAt: devices.lastSeenAt, lastSyncAt: sessionsMeta.lastSyncAt })
        .from(devices)
        .innerJoin(cloudTabs, eq(cloudTabs.deviceId, devices.id))
        .innerJoin(sessionsMeta, eq(sessionsMeta.id, cloudTabs.id))
        .where(and(eq(cloudTabs.id, tabId), eq(cloudTabs.userId, viewerId)))
        .limit(1);
    // 이 세션에 마지막으로 넣은 명령과 그 실행 결과. "보냈는데 왜 답이 없지"를 없앤다.
    const lastCmd = await db
        .select({ type: commands.type, status: commands.status, result: commands.result, createdAt: commands.createdAt })
        .from(commands)
        .where(and(eq(commands.tabId, tabId), eq(commands.userId, viewerId)))
        .orderBy(desc(commands.createdAt))
        .limit(1);
    return getNextBaseResponse(200).json({
        success: true,
        status: 200,
        data: {
            messages: thread.map((m) => ({ ...m, createdAt: m.createdAt?.toISOString() ?? null })),
            deviceLastSeenAt: seen[0]?.lastSeenAt?.toISOString() ?? null,
            lastSyncAt: seen[0]?.lastSyncAt?.toISOString() ?? null,
            lastCommand: lastCmd[0]
                ? {
                      type: lastCmd[0].type,
                      status: lastCmd[0].status,
                      result: lastCmd[0].result,
                      createdAt: lastCmd[0].createdAt?.toISOString() ?? null,
                  }
                : null,
        },
    });
}
