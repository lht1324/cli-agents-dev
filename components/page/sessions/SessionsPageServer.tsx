import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { devices, getDb, sessionsMeta } from "@/lib/neon";
import { checkBillingGate } from "@/lib/billing";
import SessionsPageClient, { type SessionRow } from "./SessionsPageClient";

export default async function SessionsPageServer({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | undefined>>;
}) {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
        redirect("/auth/sign-in");
    }

    const gate = await checkBillingGate(session.user.id);
    if (!gate.allowed) {
        redirect("/billing/locked");
    }
    // 임시: ?isTest가 있으면 목록을 빈 것처럼 취급 (온보딩 빈 화면 개발·시연용). 나중에 제거.
    const sp = await searchParams;
    const isTest = sp.isTest === "1" || sp.isTest === "true";
    const db = getDb();
    const rows = isTest
        ? []
        : await db
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
