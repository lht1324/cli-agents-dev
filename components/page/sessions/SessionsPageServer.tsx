import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/server";
import { cloudTabs, devices, getDb, handoffs, sessionsMeta } from "@/lib/neon";
import { checkBillingGate } from "@/lib/billing";
import SessionsPageClient, { type SessionRow } from "./SessionsPageClient";

export default async function SessionsPageServer() {
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

    // 수신 대기 중인 handoff (다른 PC가 push하고 내 기기가 아직 받지 않은 것).
    // CLI pull과 같은 판정: 내 기기가 받았고 탭이 살아 있으면 숨김. 웹은 로컬 DB를 못 읽으니
    // "탭 존재" 판정은 cloud_tabs(거울)로 대신한다. 기기 토큰이 아니라 웹 세션이므로 별도 쿼리.
    let waiting: { newTabs: number; updatedTabs: number } | null = null;
    const versions = await db
        .select({
            tabId: handoffs.tabId,
            title: handoffs.title,
            createdAt: handoffs.createdAt,
            receivedBy: handoffs.receivedBy,
        })
        .from(handoffs)
        .where(eq(handoffs.userId, session.user.id))
        .orderBy(desc(handoffs.createdAt))
        .limit(50);
    // 내 기기 목록 (받았는지 판정용)
    const myDevices = await db
        .select({ id: devices.id })
        .from(devices)
        .where(eq(devices.userId, session.user.id));
    const myDeviceIds = new Set(myDevices.map((d) => d.id));
    // 탭별 최신 1건 (CLI와 동일 규칙)
    const latest = new Map<string, { title: string | null; createdAt: Date; receivedBy: string | null }>();
    for (const v of versions) {
        const cur = latest.get(v.tabId);
        if (!cur || v.createdAt > cur.createdAt) {
            latest.set(v.tabId, { title: v.title, createdAt: v.createdAt, receivedBy: v.receivedBy });
        }
    }
    // 내가 받은 적 있는 탭은 제외 (받았는데 거울에 없는 탭은 다시 보여줌 — CLI 규칙과 동일)
    const candidates = [...latest.entries()].filter(([, v]) => !(v.receivedBy && myDeviceIds.has(v.receivedBy)));
    // 새 탭 vs 최신 버전 구분: 거울(cloud_tabs)에 없으면 새 탭
    const mirrorIds = await db.select({ id: cloudTabs.id }).from(cloudTabs).where(eq(cloudTabs.userId, session.user.id));
    const mirrorSet = new Set(mirrorIds.map((t) => t.id));
    let newTabs = 0;
    let updatedTabs = 0;
    for (const [tabId] of candidates) {
        if (mirrorSet.has(tabId)) {
            updatedTabs += 1;
        } else {
            newTabs += 1;
        }
    }
    if (newTabs + updatedTabs > 0) {
        waiting = { newTabs, updatedTabs };
    }
    return <SessionsPageClient items={items} waiting={waiting} />;
}
