import { and, eq, notInArray } from "drizzle-orm";
import { verifyDeviceToken } from "@/lib/auth/device";
import { getDb } from "@/lib/neon/client";
import { cloudTabs, modelCatalog, pendingApprovals, sessionsMeta } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

interface SyncSession {
    id?: unknown;
    title?: unknown;
    status?: unknown;
    agent?: unknown;
    model?: unknown;
    provider?: unknown;
    cost?: unknown;
    lastInput?: unknown;
    lastOutput?: unknown;
    lastReasoning?: unknown;
    lastCacheRead?: unknown;
    lastCacheWrite?: unknown;
    msgUser?: unknown;
    msgAssistant?: unknown;
    sessionCreatedAt?: unknown;
}

interface SyncApproval {
    id?: unknown;
    sessionID?: unknown;
    action?: unknown;
    resources?: unknown;
    message?: unknown;
}

interface SyncCatalog {
    models?: unknown;
    agents?: unknown;
}

interface SyncBody {
    sessions?: unknown;
    approvals?: unknown;
    catalog?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function num(value: unknown): number | null {
    return typeof value === "number" ? value : null;
}

function stamp(value: unknown): Date | null {
    if (typeof value === "number") {
        return new Date(value);
    }
    if (typeof value === "string") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

// 데몬 조건부 backfill용. 이 기기가 올린 탭 id 목록. 기기 토큰 전용.
export async function GET(request: Request): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    const db = getDb();
    const tabs = await db
        .select({ id: cloudTabs.id })
        .from(cloudTabs)
        .where(eq(cloudTabs.deviceId, authed.deviceId));
    return getNextBaseResponse(200).json({ success: true, status: 200, data: { tabIds: tabs.map((t) => t.id) } });
}

// 데몬 동기화 푸시 수신. 세션 헤더·승인 거울·카탈로그 upsert.
export async function POST(request: Request): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    let body: SyncBody;
    try {
        body = (await request.json()) as SyncBody;
    } catch {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "invalid JSON body" });
    }
    const db = getDb();
    const sessions = Array.isArray(body.sessions) ? (body.sessions as SyncSession[]) : [];
    for (const s of sessions) {
        if (typeof s.id !== "string") {
            continue;
        }
        const detail = asRecord(s);
        const createdAt = stamp(s.sessionCreatedAt);
        await db
            .insert(sessionsMeta)
            .values({
                id: s.id,
                deviceId: authed.deviceId,
                provider: str(detail.provider) ?? "opencode",
                title: str(detail.title) ?? s.id,
                status: str(detail.status) ?? "active",
                agent: str(detail.agent),
                model: detail.model ? JSON.stringify(detail.model) : null,
                cost: num(s.cost),
                lastInput: num(s.lastInput),
                lastOutput: num(s.lastOutput),
                lastReasoning: num(s.lastReasoning),
                lastCacheRead: num(s.lastCacheRead),
                lastCacheWrite: num(s.lastCacheWrite),
                msgUser: num(s.msgUser),
                msgAssistant: num(s.msgAssistant),
                ...(createdAt ? { sessionCreatedAt: createdAt } : {}),
                lastSyncAt: new Date(),
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: sessionsMeta.id,
                set: {
                    agent: str(detail.agent),
                    model: detail.model ? JSON.stringify(detail.model) : null,
                    status: str(detail.status) ?? "active",
                    cost: num(s.cost),
                    lastInput: num(s.lastInput),
                    lastOutput: num(s.lastOutput),
                    lastReasoning: num(s.lastReasoning),
                    lastCacheRead: num(s.lastCacheRead),
                    lastCacheWrite: num(s.lastCacheWrite),
                    msgUser: num(s.msgUser),
                    msgAssistant: num(s.msgAssistant),
                    ...(createdAt ? { sessionCreatedAt: createdAt } : {}),
                    lastSyncAt: new Date(),
                    updatedAt: new Date(),
                },
            });
    }
    const approvals = Array.isArray(body.approvals) ? (body.approvals as SyncApproval[]) : [];
    const seen: string[] = [];
    for (const a of approvals) {
        if (typeof a.id !== "string" || typeof a.sessionID !== "string") {
            continue;
        }
        seen.push(a.id);
        await db
            .insert(pendingApprovals)
            .values({
                id: a.id,
                userId: authed.userId,
                deviceId: authed.deviceId,
                sessionId: a.sessionID,
                action: str(a.action) ?? "?",
                resources: Array.isArray(a.resources) ? a.resources.join(",") : str(a.resources) ?? "",
                message: str(a.message),
                status: "open",
            })
            .onConflictDoNothing();
    }
    if (body.approvals !== undefined) {
        if (seen.length > 0) {
            await db
                .update(pendingApprovals)
                .set({ status: "resolved", resolvedAt: new Date() })
                .where(
                    and(
                        eq(pendingApprovals.deviceId, authed.deviceId),
                        eq(pendingApprovals.status, "open"),
                        notInArray(pendingApprovals.id, seen),
                    ),
                );
        } else {
            await db
                .update(pendingApprovals)
                .set({ status: "resolved", resolvedAt: new Date() })
                .where(and(eq(pendingApprovals.deviceId, authed.deviceId), eq(pendingApprovals.status, "open")));
        }
    }
    const catalog = asRecord(body.catalog);
    if (Object.keys(catalog).length > 0) {
        await db
            .insert(modelCatalog)
            .values({ deviceId: authed.deviceId, payload: JSON.stringify(catalog), updatedAt: new Date() })
            .onConflictDoUpdate({
                target: modelCatalog.deviceId,
                set: { payload: JSON.stringify(catalog), updatedAt: new Date() },
            });
    }
    return getNextBaseResponse(200).json({
        success: true,
        status: 200,
        data: { sessions: sessions.length, approvals: approvals.length },
    });
}
