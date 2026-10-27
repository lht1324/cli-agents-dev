import { eq } from "drizzle-orm";
import { getDb, subscriptions } from "@/lib/neon";

// 과금 게이트. 단일 플랜 + 30일 no-card 트라이얼 (PLAN-BILLING.md).
// - 구독 active: 통과.
// - trial_ends_at 없으면(첫 활동): 지금 + 30일로 초기화하고 통과.
// - 트라이얼 만료 후 유료 없음: 403.

export const TRIAL_DAYS = 30;

export type GateResult = { allowed: true } | { allowed: false; reason: "trial_ended" };

export async function checkBillingGate(userId: string): Promise<GateResult> {
    const db = getDb();
    const [row] = await db
        .select({ status: subscriptions.status, trialEndsAt: subscriptions.trialEndsAt })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId));

    if (row?.status === "active") {
        return { allowed: true };
    }
    if (!row || !row.trialEndsAt) {
        // 첫 API 활동. 트라이얼 시계를 시작한다. heartbeat 제외 모든 엔드포인트가 여기로 온다.
        const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        await db
            .insert(subscriptions)
            .values({ userId, trialEndsAt, updatedAt: new Date() })
            .onConflictDoUpdate({
                target: subscriptions.userId,
                set: { trialEndsAt, updatedAt: new Date() },
            });
        return { allowed: true };
    }
    if (row.trialEndsAt.getTime() > Date.now()) {
        return { allowed: true };
    }
    return { allowed: false, reason: "trial_ended" };
}

// 헤더에 실어 보낼 남은 일수 (웹 배너·데몬 상태 표시용). 양수 = 트라이얼 중.
export async function trialDaysLeft(userId: string): Promise<number | null> {
    const db = getDb();
    const [row] = await db
        .select({ status: subscriptions.status, trialEndsAt: subscriptions.trialEndsAt })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId));
    if (row?.status === "active") {
        return null; // 유료. 카운트다운 불필요.
    }
    if (!row?.trialEndsAt) {
        return TRIAL_DAYS;
    }
    return Math.max(0, Math.ceil((row.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}
