import { eq } from "drizzle-orm";
import { readInternalUser } from "@/lib/auth/internal";
import { getDb, subscriptions } from "@/lib/neon";
import { setDodoSubscriptionCancel } from "@/lib/dodo";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

// 취소 예약 해제 (자동 갱신 재개). cancel_at_next_billing_date: false로 복원.
// 상태 반영은 Dodo 웹훅(subscription.updated)이 담당.
export async function POST(request: Request): Promise<Response> {
    const userId = readInternalUser(request);
    if (!userId) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    const db = getDb();
    const [row] = await db
        .select({ dodoSubscriptionId: subscriptions.dodoSubscriptionId, status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);
    if (!row?.dodoSubscriptionId) {
        return getNextBaseResponse(409).json({ success: false, status: 409, error: "no subscription" });
    }
    const ok = await setDodoSubscriptionCancel(row.dodoSubscriptionId, false);
    if (!ok) {
        return getNextBaseResponse(502).json({ success: false, status: 502, error: "dodo request failed" });
    }
    // 웹훅 도착 전 UI 일관성을 위해 즉시 반영 (웹훅이 와도 같은 값이라 멱등).
    await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
        .where(eq(subscriptions.userId, userId));
    return getNextBaseResponse(200).json({ success: true, status: 200 });
}
