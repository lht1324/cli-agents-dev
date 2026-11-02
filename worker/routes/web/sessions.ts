import { Hono } from "hono";
import { and, desc, eq, isNull } from "drizzle-orm";
import { checkBillingGate } from "../../../lib/billing";
import { getDb } from "../../../lib/neon/client";
import {
    cloudMessages,
    cloudTabs,
    devices,
    modelCatalog,
    pendingApprovals,
    sessionLocations,
    sessionsMeta,
} from "../../../lib/neon/schema";
import type { AppEnv } from "../../../lib/env";
import type { AuthVariables } from "../../middleware/auth";

const sessions = new Hono<{ Bindings: AppEnv; Variables: AuthVariables }>();

const ACTIVE_MS = 120_000;

// 목록: 내 세션 (소유는 user_id)
sessions.get("/", async (c) => {
    const userId = c.get("userId");
    const gate = await checkBillingGate(userId);
    if (!gate.allowed) {
        return c.json({ success: false, status: 403, error: "trial_ended" }, 403);
    }
    const db = getDb();
    const rows = await db
        .select({
            id: sessionsMeta.id,
            title: sessionsMeta.title,
            status: sessionsMeta.status,
            lastSyncAt: sessionsMeta.lastSyncAt,
            lastBodySyncAt: sessionsMeta.lastBodySyncAt,
            updatedAt: sessionsMeta.updatedAt,
        })
        .from(sessionsMeta)
        .where(and(eq(sessionsMeta.userId, userId), isNull(sessionsMeta.parentId)))
        .orderBy(desc(sessionsMeta.updatedAt));

    // 최근에 본문이 동기화된 세션 = 지금 돌고 있는 세션(live). 나머지는 기록만 남은 frozen.
    const LIVE_MS = 40 * 60 * 1000;
    const now = Date.now();
    return c.json({
        success: true,
        status: 200,
        data: {
            items: rows.map((r) => ({
                ...r,
                lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
                lastBodySyncAt: r.lastBodySyncAt?.toISOString() ?? null,
                updatedAt: r.updatedAt.toISOString(),
                live: r.lastBodySyncAt ? now - r.lastBodySyncAt.getTime() < LIVE_MS : false,
            })),
        },
    });
});

// 상세: 메타 + 승인 + 스레드 + 통계 + 명령 대상 후보
sessions.get("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const gate = await checkBillingGate(userId);
    if (!gate.allowed) {
        return c.json({ success: false, status: 403, error: "trial_ended" }, 403);
    }
    const db = getDb();

    const approvals = await db
        .select({
            id: pendingApprovals.id,
            deviceId: pendingApprovals.deviceId,
            action: pendingApprovals.action,
            resources: pendingApprovals.resources,
            message: pendingApprovals.message,
        })
        .from(pendingApprovals)
        .innerJoin(devices, eq(pendingApprovals.deviceId, devices.id))
        .where(
            and(
                eq(pendingApprovals.sessionId, id),
                eq(devices.userId, userId),
                eq(pendingApprovals.status, "open"),
            ),
        )
        .orderBy(desc(pendingApprovals.createdAt));

    const meta = await db
        .select({
            title: sessionsMeta.title,
            status: sessionsMeta.status,
            deviceId: sessionsMeta.deviceId,
            agent: sessionsMeta.agent,
            model: sessionsMeta.model,
            cost: sessionsMeta.cost,
            lastInput: sessionsMeta.lastInput,
            lastOutput: sessionsMeta.lastOutput,
            lastReasoning: sessionsMeta.lastReasoning,
            lastCacheRead: sessionsMeta.lastCacheRead,
            lastCacheWrite: sessionsMeta.lastCacheWrite,
            msgUser: sessionsMeta.msgUser,
            msgAssistant: sessionsMeta.msgAssistant,
            sessionCreatedAt: sessionsMeta.sessionCreatedAt,
            lastSyncAt: sessionsMeta.lastSyncAt,
            parentId: sessionsMeta.parentId,
            deviceLastSeenAt: devices.lastSeenAt,
            deviceLabel: devices.label,
        })
        .from(sessionsMeta)
        .innerJoin(devices, eq(sessionsMeta.deviceId, devices.id))
        .where(and(eq(sessionsMeta.id, id), eq(sessionsMeta.userId, userId)));
    if (meta.length === 0) {
        return c.json({ success: false, status: 404, error: "session not found" }, 404);
    }

    // 명령 대상 후보 = 이 세션을 가진 내 기기 중 활성(heartbeat 2분)
    const locationRows = await db
        .select({ deviceId: sessionLocations.deviceId, label: devices.label, lastSeenAt: devices.lastSeenAt })
        .from(sessionLocations)
        .innerJoin(devices, eq(sessionLocations.deviceId, devices.id))
        .where(and(eq(sessionLocations.tabId, id), eq(devices.userId, userId), isNull(devices.unlinkedAt)));
    const now = Date.now();
    const targets = locationRows
        .map((r) => ({
            deviceId: r.deviceId,
            label: r.label,
            lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
            active: r.lastSeenAt ? now - r.lastSeenAt.getTime() < ACTIVE_MS : false,
        }))
        .sort((a, b) => {
            if (a.active !== b.active) {
                return a.active ? -1 : 1;
            }
            return (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "");
        });

    // 위치 행이 없는 기존 세션도 현재 호스트가 살아 있으면 후보에 포함
    const hostSeen = meta[0].deviceLastSeenAt;
    const hostActive = hostSeen ? now - hostSeen.getTime() < ACTIVE_MS : false;
    if (hostActive && !targets.some((t) => t.deviceId === meta[0].deviceId)) {
        targets.unshift({
            deviceId: meta[0].deviceId,
            label: meta[0].deviceLabel,
            lastSeenAt: hostSeen?.toISOString() ?? null,
            active: true,
        });
    }
    const activeTargets = targets.filter((t) => t.active);
    const defaultTarget =
        activeTargets.find((t) => t.deviceId === meta[0].deviceId)?.deviceId ?? activeTargets[0]?.deviceId ?? null;

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
        .where(and(eq(cloudMessages.tabId, id), eq(cloudTabs.userId, userId)))
        .orderBy(cloudMessages.createdAt, cloudMessages.seq);

    const catalog = await db
        .select({ payload: modelCatalog.payload })
        .from(modelCatalog)
        .where(eq(modelCatalog.deviceId, defaultTarget ?? meta[0].deviceId));

    // 이 세션의 서브에이전트(자식) 목록. 대화 중간이 아니라 옆 목록으로 보여준다.
    const children = await db
        .select({
            id: sessionsMeta.id,
            title: sessionsMeta.title,
            lastBodySyncAt: sessionsMeta.lastBodySyncAt,
        })
        .from(sessionsMeta)
        .where(and(eq(sessionsMeta.userId, userId), eq(sessionsMeta.parentId, id)))
        .orderBy(desc(sessionsMeta.updatedAt));

    const m0 = meta[0];
    return c.json({
        success: true,
        status: 200,
        data: {
            info: {
                id,
                title: m0.title ?? id,
                status: m0.status ?? "unknown",
                parentId: m0.parentId ?? null,
                readOnly: m0.parentId !== null,
                deviceId: defaultTarget ?? m0.deviceId,
                agent: m0.agent ?? null,
                model: m0.model ?? null,
                lastSyncAt: m0.lastSyncAt?.toISOString() ?? null,
                deviceLastSeenAt: m0.deviceLastSeenAt?.toISOString() ?? null,
            },
            approvals: approvals.map((a) => ({ ...a, message: a.message ?? null })),
            messages: thread.map((m) => ({ ...m, createdAt: m.createdAt?.toISOString() ?? null })),
            stats: {
                cost: m0.cost ?? null,
                input: m0.lastInput ?? null,
                output: m0.lastOutput ?? null,
                reasoning: m0.lastReasoning ?? null,
                cacheRead: m0.lastCacheRead ?? null,
                cacheWrite: m0.lastCacheWrite ?? null,
                msgUser: m0.msgUser ?? null,
                msgAssistant: m0.msgAssistant ?? null,
                createdAt: m0.sessionCreatedAt?.toISOString() ?? null,
            },
            subagents: children.map((ch) => ({
                id: ch.id,
                title: ch.title,
                synced: ch.lastBodySyncAt !== null,
            })),
            targets: activeTargets,
            defaultTarget,
            catalogJson: catalog[0]?.payload ?? null,
        },
    });
});

export default sessions;
