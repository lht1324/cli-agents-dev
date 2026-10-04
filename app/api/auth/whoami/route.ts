import { verifyDeviceToken } from "@/lib/auth/device";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

// 데몬 whoami. 토큰 주인 반환.
export async function GET(request: Request): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    return getNextBaseResponse(200).json({ success: true, status: 200, data: { userId: authed.userId } });
}
