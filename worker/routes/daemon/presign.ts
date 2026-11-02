import { Hono } from "hono";
import { checkBillingGate } from "../../../lib/billing";
import { requireEnv, type AppEnv } from "../../../lib/env";
import type { DeviceVariables } from "../../middleware/device";

const BUCKET = "localagents-handoffs";

// 서명 URL 발급. 데몬은 S3 키 없이 이 URL로 직행한다.
// key는 본인 userId/ 접두사로 강제한다.
const presign = new Hono<{ Bindings: AppEnv; Variables: DeviceVariables }>();

presign.post("/", async (c) => {
    const userId = c.get("userId");
    const gate = await checkBillingGate(userId);
    if (!gate.allowed) {
        return c.json({ success: false, status: 403, error: "trial_ended" }, 403);
    }

    let body: { operation?: unknown; key?: unknown };
    try {
        body = (await c.req.json()) as { operation?: unknown; key?: unknown };
    } catch {
        return c.json({ success: false, status: 400, error: "invalid JSON body" }, 400);
    }
    if (body.operation !== "upload" && body.operation !== "download") {
        return c.json({ success: false, status: 400, error: "operation must be upload or download" }, 400);
    }
    if (typeof body.key !== "string" || !body.key.startsWith(`${userId}/`)) {
        return c.json({ success: false, status: 403, error: "key must start with your user id" }, 403);
    }

    const objectKey = encodeURIComponent(body.key);
    const url =
        `https://console.neon.tech/api/v2/projects/${requireEnv("NEON_PROJECT_ID")}` +
        `/branches/${requireEnv("NEON_BRANCH_ID")}/buckets/${BUCKET}/objects/${objectKey}/presign`;
    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${requireEnv("NEON_API_KEY")}`,
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
        return c.json(
            { success: false, status: 502, error: `presign failed: ${res.status} ${text.slice(0, 150)}` },
            502,
        );
    }
    const signed = (await res.json()) as { url?: string; method?: string; headers?: Record<string, string> };
    if (typeof signed.url !== "string") {
        return c.json({ success: false, status: 502, error: "presign returned no url" }, 502);
    }
    return c.json({
        success: true,
        status: 200,
        data: {
            url: signed.url,
            method: signed.method ?? (body.operation === "upload" ? "PUT" : "GET"),
            headers: signed.headers ?? {},
        },
    });
});

export default presign;
