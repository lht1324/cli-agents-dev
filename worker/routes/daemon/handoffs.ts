import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../lib/neon/client";
import { handoffs } from "../../../lib/neon/schema";
import type { AppEnv } from "../../../lib/env";
import type { DeviceVariables } from "../../middleware/device";

const daemonHandoffs = new Hono<{ Bindings: AppEnv; Variables: DeviceVariables }>();

// 인계 포인터 목록. 탭별 최신 버전.
daemonHandoffs.get("/", async (c) => {
    const userId = c.get("userId");
    const rows = await getDb()
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
        .where(and(eq(handoffs.userId, userId)))
        .orderBy(desc(handoffs.createdAt))
        .limit(50);
    return c.json({ success: true, status: 200, data: { versions: rows } });
});

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

// 포인터 등록 + 수신 기록. 버전 파일은 불변.
daemonHandoffs.post("/", async (c) => {
    const userId = c.get("userId");
    const deviceId = c.get("deviceId");
    let body: HandoffBody;
    try {
        body = (await c.req.json()) as HandoffBody;
    } catch {
        return c.json({ success: false, status: 400, error: "invalid JSON body" }, 400);
    }
    const db = getDb();

    if (typeof body.receivedVersion === "string" && body.receivedVersion.length > 0) {
        await db
            .update(handoffs)
            .set({ receivedBy: deviceId, receivedAt: new Date() })
            .where(and(eq(handoffs.version, body.receivedVersion), eq(handoffs.userId, userId)));
        return c.json({ success: true, status: 200, data: { received: body.receivedVersion } });
    }

    if (typeof body.tabId !== "string" || typeof body.version !== "string" || typeof body.storageKey !== "string") {
        return c.json({ success: false, status: 400, error: "tabId, version, storageKey are required" }, 400);
    }
    if (typeof body.sha256 !== "string" || typeof body.baseHash !== "string") {
        return c.json({ success: false, status: 400, error: "baseHash, sha256 are required" }, 400);
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(handoffs).values({
        id: randomUUID(),
        userId,
        deviceId,
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
    return c.json({ success: true, status: 201, data: { version: body.version } }, 201);
});

export default daemonHandoffs;
