import { and, eq } from "drizzle-orm";
import { verifyDeviceToken } from "@/lib/auth/device";
import { getDb } from "@/lib/neon/client";
import { cloudMessages, cloudTabs } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

interface MessageRow {
    sessionID?: unknown;
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
export async function POST(request: Request): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
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
        if (typeof m.sessionID !== "string" || typeof m.seq !== "number") {
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
        }
        const createdAt =
            typeof m.createdAt === "number" ? new Date(m.createdAt) : typeof m.createdAt === "string" ? new Date(m.createdAt) : null;
        await db
            .insert(cloudMessages)
            .values({
                tabId: m.sessionID,
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
