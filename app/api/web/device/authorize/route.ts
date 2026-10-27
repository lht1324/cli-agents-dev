import { getIsValidRequestS2S } from "@/lib/utils/getIsValidRequest";
import { checkBillingGate } from "@/lib/billing";
import { linkDevice } from "@/lib/device/link";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

interface AuthorizeBody {
    deviceId?: unknown;
    label?: unknown;
    platform?: unknown;
    hostname?: unknown;
}

// loopback 로그인 확정. 게이트웨이가 세션을 검증하고 userId를 주입한다 (S2S 전용).
// 브라우저가 직접 부르면 내부 secret이 없어 401이다.
export async function POST(request: Request): Promise<Response> {
    const userId = getIsValidRequestS2S(request);
    if (!userId) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    const gate = await checkBillingGate(userId);
    if (!gate.allowed) {
        return getNextBaseResponse(403).json({ success: false, status: 403, error: "trial_ended" });
    }
    let body: AuthorizeBody;
    try {
        body = (await request.json()) as AuthorizeBody;
    } catch {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "invalid JSON body" });
    }
    if (typeof body.deviceId !== "string" || body.deviceId.length === 0) {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "deviceId is required" });
    }
    const token = await linkDevice({
        userId,
        deviceId: body.deviceId,
        label: typeof body.label === "string" && body.label.length > 0 ? body.label : "My PC",
        platform: typeof body.platform === "string" ? body.platform : null,
        hostname: typeof body.hostname === "string" ? body.hostname : null,
    });
    return getNextBaseResponse(201).json({ success: true, status: 201, data: { token } });
}
