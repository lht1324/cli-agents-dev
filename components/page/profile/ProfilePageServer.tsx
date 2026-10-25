import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth/server";
import { checkBillingGate, trialDaysLeft } from "@/lib/billing";
import { devices, getDb, sessionsMeta, subscriptions } from "@/lib/neon";
import ProfilePageClient, { type ProfileData } from "./ProfilePageClient";

export default async function ProfilePageServer() {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
        redirect("/auth/sign-in");
    }
    const gate = await checkBillingGate(session.user.id);
    if (!gate.allowed) {
        redirect("/billing/locked");
    }
    const userId = session.user.id;
    const db = getDb();

    // 유저 기본 정보 (Neon Auth 거울 테이블 직독)
    const users = await db.execute<{ email: string | null; name: string | null; image: string | null; createdAt: string | null }>(
        sql`SELECT email, name, image, "createdAt" FROM neon_auth."user" WHERE id = ${userId} LIMIT 1`,
    );
    const userRow = users.rows[0];

    // 구독 상태
    const [sub] = await db
        .select({
            planId: subscriptions.planId,
            status: subscriptions.status,
            interval: subscriptions.interval,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            trialEndsAt: subscriptions.trialEndsAt,
            cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);

    // 기기·세션 수
    const deviceRows = await db.select({ id: devices.id }).from(devices).where(eq(devices.userId, userId));
    const deviceCount = deviceRows.length;
    const sessionRows = deviceRows.length > 0
        ? await db
              .select({ id: sessionsMeta.id })
              .from(sessionsMeta)
              .innerJoin(devices, eq(sessionsMeta.deviceId, devices.id))
              .where(eq(devices.userId, userId))
              .orderBy(desc(sessionsMeta.updatedAt))
        : [];
    const sessionCount = sessionRows.length;

    const daysLeft = await trialDaysLeft(userId);

    const data: ProfileData = {
        email: userRow?.email ?? session.user.email ?? null,
        name: userRow?.name ?? null,
        image: userRow?.image ?? null,
        memberSince: userRow?.createdAt ?? null,
        planId: sub?.planId ?? "plan-1",
        status: sub?.status ?? null,
        interval: sub?.interval ?? null,
        currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
        trialEndsAt: sub?.trialEndsAt?.toISOString() ?? null,
        cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
        deviceCount,
        sessionCount,
        daysLeft,
    };
    return <ProfilePageClient data={data} />;
}
