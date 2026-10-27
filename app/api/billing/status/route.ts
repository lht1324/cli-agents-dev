import { eq } from "drizzle-orm";
import { verifyDeviceToken } from "@/lib/auth/device";
import { trialDaysLeft } from "@/lib/billing";
import { getDb, subscriptions } from "@/lib/neon";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

// 데몬용 과금 상태 조회. localagents status가 표시에 쓴다. 게이트 대상 아님 (읽기 전용).
export async function GET(request: Request): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    const daysLeft = await trialDaysLeft(authed.userId);
    const [row] = await getDb()
        .select({
            cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
        })
        .from(subscriptions)
        .where(eq(subscriptions.userId, authed.userId))
        .limit(1);
    return getNextBaseResponse(200).json({
        success: true,
        status: 200,
        data: {
            active: daysLeft === null,
            daysLeft,
            cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
            currentPeriodEnd: row?.currentPeriodEnd?.toISOString() ?? null,
        },
    });
}
