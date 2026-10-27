import { eq } from "drizzle-orm";
import { getIsValidRequestS2S } from "@/lib/utils/getIsValidRequest";
import { getDb, subscriptions } from "@/lib/neon";
import { setDodoSubscriptionCancel } from "@/lib/dodo";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

// 구독 취소 예약. 기간 끝까지는 유효 (cancel_at_next_billing_date: true).
// 실제 상태 변경은 Dodo 웹훅(subscription.updated/cancelled)이 반영한다.
export async function POST(request: Request): Promise<Response> {
    const userId = getIsValidRequestS2S(request);
    if (!userId) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    const db = getDb();
    const [row] = await db
        .select({ dodoSubscriptionId: subscriptions.dodoSubscriptionId, status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);
    if (!row?.dodoSubscriptionId || row.status !== "active") {
        return getNextBaseResponse(409).json({ success: false, status: 409, error: "no active subscription" });
    }
    const ok = await setDodoSubscriptionCancel(row.dodoSubscriptionId, true);
    if (!ok) {
        return getNextBaseResponse(502).json({ success: false, status: 502, error: "dodo request failed" });
    }
    // 웹훅 도착 전 UI 일관성을 위해 즉시 반영 (웹훅이 와도 같은 값이라 멱등).
    await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
        .where(eq(subscriptions.userId, userId));
    return getNextBaseResponse(200).json({ success: true, status: 200 });
}
