import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { verifyDeviceToken } from "@/lib/auth/device";
import { getDb } from "@/lib/neon/client";
import { subscriptions } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";
import { DEFAULT_PLAN_ID } from "@/lib/plans";

// 데몬 whoami. 토큰 주인 + 이메일 + 플랜 반환. 이메일·플랜은 status에서 쓰지 않는다.
export async function GET(request: Request): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    const db = getDb();
    const users = await db.execute<{ email: string | null }>(
        sql`SELECT email FROM neon_auth."user" WHERE id = ${authed.userId} LIMIT 1`,
    );
    const plans = await db
        .select({ planId: subscriptions.planId })
        .from(subscriptions)
        .where(eq(subscriptions.userId, authed.userId))
        .limit(1);
    return getNextBaseResponse(200).json({
        success: true,
        status: 200,
        data: {
            userId: authed.userId,
            email: users.rows[0]?.email ?? null,
            planId: plans[0]?.planId ?? DEFAULT_PLAN_ID,
        },
    });
}
