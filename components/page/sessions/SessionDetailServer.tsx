import { and, desc, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/server";
import { devices, cloudMessages, cloudTabs, getDb, modelCatalog, pendingApprovals, sessionLocations, sessionsMeta } from "@/lib/neon";
import { checkBillingGate } from "@/lib/billing";
import SessionDetailClient, { type ApprovalRow, type SessionInfo, type ThreadRow } from "./SessionDetailClient";

export default async function SessionDetailServer({ id }: { id: string }) {
    const { data: session } = await getAuth().getSession();
    if (!session?.user) {
        redirect("/auth/sign-in");
    }

    const gate = await checkBillingGate(session.user.id);
    if (!gate.allowed) {
        redirect("/billing/locked");
    }
    const db = getDb();
    const rows = await db
        .select({
            id: pendingApprovals.id,
            action: pendingApprovals.action,
            resources: pendingApprovals.resources,
            message: pendingApprovals.message,
            deviceId: pendingApprovals.deviceId,
        })
        .from(pendingApprovals)
        .innerJoin(devices, eq(pendingApprovals.deviceId, devices.id))
        .where(
            and(
                eq(pendingApprovals.sessionId, id),
                eq(devices.userId, session.user.id),
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
            deviceLastSeenAt: devices.lastSeenAt,
            deviceLabel: devices.label,
        })
        .from(sessionsMeta)
        .innerJoin(devices, eq(sessionsMeta.deviceId, devices.id))
        .where(and(eq(sessionsMeta.id, id), eq(sessionsMeta.userId, session.user.id)));
    if (meta.length === 0) {
        redirect("/sessions");
    }

    // 이 세션을 실제로 갖고 있는 내 기기들. 명령 대상 후보는 여기서만 나온다.
    // 활성 판정: heartbeat가 2분 안에 온 기기.
    const locationRows = await db
        .select({
            deviceId: sessionLocations.deviceId,
            label: devices.label,
            lastSeenAt: devices.lastSeenAt,
        })
        .from(sessionLocations)
        .innerJoin(devices, eq(sessionLocations.deviceId, devices.id))
        .where(and(eq(sessionLocations.tabId, id), eq(devices.userId, session.user.id), isNull(devices.unlinkedAt)));
    const ACTIVE_MS = 120_000;
    const now = Date.now();
    const targets = locationRows
        .map((r) => ({
            deviceId: r.deviceId,
            label: r.label,
            lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
            active: r.lastSeenAt ? now - r.lastSeenAt.getTime() < ACTIVE_MS : false,
        }))
        // 활성 먼저, 그다음 최근 접속 순.
        .sort((a, b) => {
            if (a.active !== b.active) {
                return a.active ? -1 : 1;
            }
            return (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "");
        });
    // 위치 행이 아직 없는 세션(위치 추적 도입 이전·sync 전)도 현재 호스트가 살아 있으면 후보에 넣는다.
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
    // 기본 대상: 현재 호스트(device_id)가 활성이면 그것, 아니면 가장 최근 활성 기기.
    const activeTargets = targets.filter((t) => t.active);
    const defaultTarget =
        activeTargets.find((t) => t.deviceId === meta[0].deviceId)?.deviceId ?? activeTargets[0]?.deviceId ?? null;
    const deviceId = defaultTarget;
    const info: SessionInfo = {
        id,
        title: meta[0]?.title ?? id,
        status: meta[0]?.status ?? "unknown",
        deviceId: deviceId ?? meta[0].deviceId,
        agent: meta[0]?.agent ?? null,
        model: meta[0]?.model ?? null,
        lastSyncAt: meta[0]?.lastSyncAt?.toISOString() ?? null,
        deviceLastSeenAt: meta[0]?.deviceLastSeenAt?.toISOString() ?? null,
    };
    const approvals: ApprovalRow[] = rows.map((r) => ({
        id: r.id,
        deviceId: r.deviceId,
        action: r.action,
        resources: r.resources,
        message: r.message ?? null,
    }));
    const thread = await db
        .select({ id: cloudMessages.messageId, seq: cloudMessages.seq, role: cloudMessages.role, kind: cloudMessages.kind, body: cloudMessages.body, createdAt: cloudMessages.createdAt })
        .from(cloudMessages)
        .innerJoin(cloudTabs, eq(cloudMessages.tabId, cloudTabs.id))
        .where(and(eq(cloudMessages.tabId, id), eq(cloudTabs.userId, session.user.id)))
        .orderBy(cloudMessages.createdAt, cloudMessages.seq);
    const messages: ThreadRow[] = thread.map((m) => ({ ...m, createdAt: m.createdAt?.toISOString() ?? null }));
    const m0 = meta[0];
    const stats = {
        cost: m0?.cost ?? null,
        input: m0?.lastInput ?? null,
        output: m0?.lastOutput ?? null,
        reasoning: m0?.lastReasoning ?? null,
        cacheRead: m0?.lastCacheRead ?? null,
        cacheWrite: m0?.lastCacheWrite ?? null,
        msgUser: m0?.msgUser ?? null,
        msgAssistant: m0?.msgAssistant ?? null,
        createdAt: m0?.sessionCreatedAt?.toISOString() ?? null,
    };
    const catalog = await db
        .select({ payload: modelCatalog.payload })
        .from(modelCatalog)
        .where(eq(modelCatalog.deviceId, deviceId ?? meta[0].deviceId));
    return (
        <SessionDetailClient
            info={info}
            approvals={approvals}
            messages={messages}
            catalogJson={catalog[0]?.payload ?? null}
            stats={stats}
            targets={targets.filter((t) => t.active)}
            defaultTarget={defaultTarget}
        />
    );
}
