import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../lib/neon/client";
import { cloudMessages, cloudTabs, commands, devices, sessionsMeta } from "../../../lib/neon/schema";
import type { AppEnv } from "../../../lib/env";
import type { AuthVariables } from "../../middleware/auth";
import { getBaseResponse } from "../../utils/getBaseResponse";

// 상세 화면 5초 폴링: 스레드 + presence + 마지막 명령 결과
const messages = new Hono<{ Bindings: AppEnv; Variables: AuthVariables }>();

messages.get("/", async (c) => {
    const userId = c.get("userId");
    const tabId = c.req.query("tabId");
    if (!tabId) {
        return getBaseResponse({ success: false, status: 400, error: "tabId is required" });
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
        .where(and(eq(cloudMessages.tabId, tabId), eq(cloudTabs.userId, userId)))
        .orderBy(cloudMessages.createdAt, cloudMessages.seq);

    const seen = await db
        .select({ lastSeenAt: devices.lastSeenAt, lastSyncAt: sessionsMeta.lastSyncAt })
        .from(devices)
        .innerJoin(cloudTabs, eq(cloudTabs.deviceId, devices.id))
        .innerJoin(sessionsMeta, eq(sessionsMeta.id, cloudTabs.id))
        .where(and(eq(cloudTabs.id, tabId), eq(cloudTabs.userId, userId)))
        .limit(1);

    const lastCmd = await db
        .select({ type: commands.type, status: commands.status, result: commands.result, createdAt: commands.createdAt })
        .from(commands)
        .where(and(eq(commands.tabId, tabId), eq(commands.userId, userId)))
        .orderBy(desc(commands.createdAt))
        .limit(1);

    return getBaseResponse({
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
});

export default messages;
