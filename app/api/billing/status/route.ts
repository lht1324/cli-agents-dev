import { verifyDeviceToken } from "@/lib/auth/device";
import { trialDaysLeft } from "@/lib/billing";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

// 데몬용 과금 상태 조회. localagents status가 표시에 쓴다. 게이트 대상 아님 (읽기 전용).
export async function GET(request: Request): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    const daysLeft = await trialDaysLeft(authed.userId);
    return getNextBaseResponse(200).json({
        success: true,
        status: 200,
        data: { active: daysLeft === null, daysLeft },
    });
}
