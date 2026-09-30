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
    if (rows.length === 0) {
        redirect("/sessions");
    }
    const meta = await db
        .select({ title: sessionsMeta.title, status: sessionsMeta.status, lastSyncAt: sessionsMeta.lastSyncAt })
        .from(sessionsMeta)
        .where(eq(sessionsMeta.id, id));
    const info: SessionInfo = {
        id,
        title: meta[0]?.title ?? id,
        status: meta[0]?.status ?? "unknown",
        deviceId: rows[0].deviceId,
        lastSyncAt: meta[0]?.lastSyncAt?.toISOString() ?? null,
    };
    const approvals: ApprovalRow[] = rows.map((r) => ({
        id: r.id,
        action: r.action,
        resources: r.resources,
        message: r.message ?? null,
    }));
    return <SessionDetailClient info={info} approvals={approvals} userId={session.user.id} />;
}
