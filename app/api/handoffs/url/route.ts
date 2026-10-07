import { verifyDeviceToken } from "@/lib/auth/device";
import { env } from "@/lib/env";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

const BUCKET = "localagents-handoffs";

interface PresignBody {
    operation?: unknown;
    key?: unknown;
}

// 서명 URL 발급. 데몬은 S3 키 없이 이 URL로 직행한다.
// key는 본인 userId/ 접두사로 강제한다.
export async function POST(request: Request): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    let body: PresignBody;
    try {
        body = (await request.json()) as PresignBody;
    } catch {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "invalid JSON body" });
    }
    if (body.operation !== "upload" && body.operation !== "download") {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "operation must be upload or download" });
    }
    if (typeof body.key !== "string" || !body.key.startsWith(`${authed.userId}/`)) {
        return getNextBaseResponse(403).json({ success: false, status: 403, error: "key must start with your user id" });
    }
    // object_key는 단일 세그먼트. 중첩 /는 %2F로 인코딩해야 한다.
    const objectKey = encodeURIComponent(body.key);
    const url =
        `https://console.neon.tech/api/v2/projects/${env.neonProjectId()}` +
        `/branches/${env.neonBranchId()}/buckets/${BUCKET}/objects/${objectKey}/presign`;
    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.neonApiKey()}`,
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(
            body.operation === "upload"
                ? { operation: "upload", content_type: "application/gzip", expires_in_seconds: 900 }
                : { operation: "download", expires_in_seconds: 900 },
        ),
    });
    if (!res.ok) {
        const text = await res.text();
        return getNextBaseResponse(502).json({ success: false, status: 502, error: `presign failed: ${res.status} ${text.slice(0, 150)}` });
    }
    const signed = (await res.json()) as { url?: string; method?: string; headers?: Record<string, string> };
    if (typeof signed.url !== "string") {
        return getNextBaseResponse(502).json({ success: false, status: 502, error: "presign returned no url" });
    }
    return getNextBaseResponse(200).json({
        success: true,
        status: 200,
        data: { url: signed.url, method: signed.method ?? (body.operation === "upload" ? "PUT" : "GET"), headers: signed.headers ?? {} },
    });
}
