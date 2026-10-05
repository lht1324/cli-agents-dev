import { sealConnect } from "@/lib/auth/packet";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

// 데몬용 사전 포장. 평문을 들고 브라우저를 열지 않도록 봉투만 미리 받아간다.
// 인증 없음(begin과 동등 노출. 진짜 토큰 발급은 브라우저 로그인+Connect 뒤).
export async function POST(request: Request): Promise<Response> {
    let body: Record<string, unknown>;
    try {
        body = (await request.json()) as Record<string, unknown>;
    } catch {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "invalid JSON body" });
    }
    const device = typeof body.device === "string" ? body.device : "";
    const port = typeof body.port === "string" ? body.port : "";
    const state = typeof body.state === "string" ? body.state : "";
    if (!device || !port || !state) {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "device, port, state are required" });
    }
    const label = typeof body.label === "string" ? body.label : "";
    const platform = typeof body.platform === "string" ? body.platform : "";
    const hostname = typeof body.hostname === "string" ? body.hostname : "";
    try {
        const data = sealConnect({ device, port, state, label, platform, hostname });
        return getNextBaseResponse(200).json({ success: true, status: 200, data: { data } });
    } catch {
        return getNextBaseResponse(500).json({ success: false, status: 500, error: "packet key is not set" });
    }
}
