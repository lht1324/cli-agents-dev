import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, subscriptions } from "@/lib/neon";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

// Dodo 웹훅 수신. Dodo 서버가 외부에서 직접 부르는 공개 엔드포인트라
// 게이트웨이 내부 헤더 인증을 타지 않는다 — 서명 검증이 곧 인증이다.
// 규격: Standard Webhooks (webhook-id / webhook-signature / webhook-timestamp 헤더).

interface WebhookBody {
    type?: string;
    data?: {
        id?: string;
        subscription_id?: string;
        status?: string;
        metadata?: { user_id?: string; interval?: string } | null;
        // subscription 이벤트의 payload에 들어오는 필드들 (버전에 따라 위치가 갈리므로 넓게 읽는다)
        current_period_end?: string | number | null;
        next_billing_date?: string | number | null;
        cancel_at_next_billing_date?: boolean;
        [key: string]: unknown;
    } | null;
}

// whsec_ 프리픽스 제거 + base64 디코드해 HMAC 키로 쓴다 (Standard Webhooks 규격).
function webhookKey(): Buffer | null {
    const raw = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
    if (!raw) {
        return null;
    }
    return Buffer.from(raw.replace(/^whsec_/, ""), "base64");
}

function verifySignature(headers: Headers, payload: string, key: Buffer): boolean {
    const id = headers.get("webhook-id") ?? "";
    const timestamp = headers.get("webhook-timestamp") ?? "";
    const signatures = (headers.get("webhook-signature") ?? "")
        .split(" ")
        .filter((s) => s.startsWith("v1,"))
        .map((s) => s.slice(3));
    if (!id || !timestamp || signatures.length === 0) {
        return false;
    }
    // 리플레이 방지: 5분 허용.
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > 300) {
        return false;
    }
    const signed = `${id}.${timestamp}.${payload}`;
    const expected = createHmac("sha256", key).update(signed).digest("base64");
    const expectedBuf = Buffer.from(expected);
    return signatures.some((sig) => {
        const sigBuf = Buffer.from(sig);
        return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
    });
}

function parsePeriodEnd(data: WebhookBody["data"]): Date | null {
    const raw = data?.current_period_end ?? data?.next_billing_date ?? null;
    if (raw === null || raw === undefined) {
        return null;
    }
    const date = typeof raw === "number" ? new Date(raw * 1000) : new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

// 구독 상태 upsert. 유저 매핑은 체크아웃 metadata의 user_id가 진실원천.
async function upsertSubscription(
    userId: string,
    values: {
        dodoSubscriptionId: string | null;
        status: string;
        interval: string | null;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd?: boolean;
    },
): Promise<void> {
    const db = getDb();
    const { cancelAtPeriodEnd, ...rest } = values;
    await db
        .insert(subscriptions)
        .values({
            userId,
            planId: "pro",
            syncIntervalSec: 600,
            ...rest,
            ...(cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd } : {}),
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: subscriptions.userId,
            set: {
                ...rest,
                ...(cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd } : {}),
                updatedAt: new Date(),
            },
        });
}

export async function POST(request: Request): Promise<Response> {
    const key = webhookKey();
    if (!key) {
        return getNextBaseResponse(503).json({ success: false, status: 503, error: "webhook key not configured" });
    }
    const payload = await request.text();
    if (!verifySignature(request.headers, payload, key)) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "invalid signature" });
    }
    let body: WebhookBody;
    try {
        body = JSON.parse(payload) as WebhookBody;
    } catch {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "invalid JSON" });
    }
    const userId = body.data?.metadata?.user_id;
    if (!userId || typeof userId !== "string") {
        // 유저 매핑 없는 이벤트는 처리 대상이 아니다. 재시도 시키지 않는다.
        return getNextBaseResponse(200).json({ success: true, status: 200, message: "ignored (no user metadata)" });
    }
    // 구독 ID는 이벤트 버전별로 필드 위치가 갈린다. subscription_id 우선, id 예비.
    const data = (body.data ?? null) as Record<string, unknown> | null;
    const subscriptionId =
        typeof data?.subscription_id === "string"
            ? data.subscription_id
            : typeof data?.id === "string"
              ? (data.id as string)
              : null;
    const periodEnd = parsePeriodEnd(body.data);
    const cancelAtPeriodEnd = data?.cancel_at_next_billing_date === true;

    try {
        switch (body.type) {
            case "subscription.active":
            case "subscription.renewed":
            case "subscription.updated": {
                const status = body.data?.status === "cancelled" ? "canceled" : (body.data?.status ?? "active");
                await upsertSubscription(userId, {
                    dodoSubscriptionId: subscriptionId,
                    status: status === "cancelled" ? "canceled" : status,
                    interval: body.data?.metadata?.interval ?? null,
                    currentPeriodEnd: periodEnd,
                    cancelAtPeriodEnd,
                });
                break;
            }
            case "subscription.cancelled":
            case "subscription.expired": {
                await upsertSubscription(userId, {
                    dodoSubscriptionId: subscriptionId,
                    status: "canceled",
                    interval: body.data?.metadata?.interval ?? null,
                    currentPeriodEnd: periodEnd,
                    cancelAtPeriodEnd: true,
                });
                break;
            }
            default:
                // payment.*·refund.* 등은 상태 갱신 대상이 아니다. 받았음만 알린다.
                break;
        }
    } catch (error) {
        console.error("[webhook] dodo:", error);
        // DB 장애는 5xx로 반환해 Dodo가 재시도하게 둔다.
        return getNextBaseResponse(500).json({ success: false, status: 500, error: "webhook processing failed" });
    }
    return getNextBaseResponse(200).json({ success: true, status: 200 });
}
