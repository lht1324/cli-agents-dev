import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { devices, cloudMessages, cloudTabs, getDb, modelCatalog, pendingApprovals, sessionsMeta } from "@/lib/neon";
import SessionDetailClient, { type ApprovalRow, type SessionInfo, type ThreadRow } from "./SessionDetailClient";

export default async function SessionDetailServer({ id }: { id: string }) {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
        redirect("/auth/sign-in");
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
        })
        .from(sessionsMeta)
        .innerJoin(devices, eq(sessionsMeta.deviceId, devices.id))
        .where(and(eq(sessionsMeta.id, id), eq(devices.userId, session.user.id)));
    const deviceId = rows.length > 0 ? rows[0].deviceId : (meta[0]?.deviceId ?? null);
    if (!deviceId) {
        redirect("/sessions");
    }
    const info: SessionInfo = {
        id,
        title: meta[0]?.title ?? id,
        status: meta[0]?.status ?? "unknown",
        deviceId,
        agent: meta[0]?.agent ?? null,
        model: meta[0]?.model ?? null,
        lastSyncAt: meta[0]?.lastSyncAt?.toISOString() ?? null,
        deviceLastSeenAt: meta[0]?.deviceLastSeenAt?.toISOString() ?? null,
    };
    const approvals: ApprovalRow[] = rows.map((r) => ({
        id: r.id,
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
        .where(eq(modelCatalog.deviceId, deviceId));
    return (
        <SessionDetailClient
            info={info}
            approvals={approvals}
            messages={messages}
            userId={session.user.id}
            catalogJson={catalog[0]?.payload ?? null}
            stats={stats}
        />
    );
}
