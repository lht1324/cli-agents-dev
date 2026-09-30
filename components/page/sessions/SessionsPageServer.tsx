import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { devices, getDb, sessionsMeta } from "@/lib/neon";
import SessionsPageClient, { type SessionRow } from "./SessionsPageClient";

export default async function SessionsPageServer() {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
        redirect("/auth/sign-in");
    }
    const db = getDb();
    const rows = await db
        .select({
            id: sessionsMeta.id,
            title: sessionsMeta.title,
            status: sessionsMeta.status,
            lastSyncAt: sessionsMeta.lastSyncAt,
            updatedAt: sessionsMeta.updatedAt,
        })
        .from(sessionsMeta)
        .innerJoin(devices, eq(sessionsMeta.deviceId, devices.id))
        .where(eq(devices.userId, session.user.id))
        .orderBy(desc(sessionsMeta.updatedAt));
    const items: SessionRow[] = rows.map((r) => ({
        ...r,
        lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
    }));
    return <SessionsPageClient items={items} />;
}
