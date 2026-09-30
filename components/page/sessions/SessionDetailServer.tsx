import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { devices, getDb, pendingApprovals, sessionsMeta } from "@/lib/neon";
import SessionDetailClient, { type ApprovalRow, type SessionInfo } from "./SessionDetailClient";

export default async function SessionDetailServer({ id }: { id: string }) {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
        redirect("/auth/sign-in");
    }
    const db = getDb();
    const meta = await db
        .select({
            id: sessionsMeta.id,
            title: sessionsMeta.title,
            status: sessionsMeta.status,
            deviceId: sessionsMeta.deviceId,
            lastSyncAt: sessionsMeta.lastSyncAt,
        })
        .from(sessionsMeta)
        .innerJoin(devices, eq(sessionsMeta.deviceId, devices.id))
        .where(and(eq(sessionsMeta.id, id), eq(devices.userId, session.user.id)));
    if (meta.length === 0) {
        redirect("/sessions");
    }
    const info: SessionInfo = {
        id: meta[0].id,
        title: meta[0].title,
        status: meta[0].status,
        deviceId: meta[0].deviceId,
        lastSyncAt: meta[0].lastSyncAt?.toISOString() ?? null,
    };
    const rows = await db
        .select({
            id: pendingApprovals.id,
            action: pendingApprovals.action,
            resources: pendingApprovals.resources,
            message: pendingApprovals.message,
        })
        .from(pendingApprovals)
        .where(
            and(
                eq(pendingApprovals.sessionId, id),
                eq(pendingApprovals.deviceId, meta[0].deviceId),
                eq(pendingApprovals.status, "open"),
            ),
        )
        .orderBy(desc(pendingApprovals.createdAt));
    const approvals: ApprovalRow[] = rows.map((r) => ({ ...r, message: r.message ?? null }));
    return <SessionDetailClient info={info} approvals={approvals} userId={session.user.id} />;
}
