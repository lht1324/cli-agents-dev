import { Hono } from "hono";
import { optionalEnv, type AppEnv } from "../../../lib/env";
import { getDb } from "../../../lib/neon/client";
import { subscriptions } from "../../../lib/neon/schema";
import { planOf } from "../../../lib/plans";
import { getBaseResponse } from "../../utils/getBaseResponse";

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

function base64ToBytes(text: string): Uint8Array | null {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.length > 0 ? bytes : null;
}

// whsec_ 프리픽스 제거 + base64 디코드해 HMAC 키로 쓴다 (Standard Webhooks 규격).
async function webhookKey(): Promise<CryptoKey | null> {
    const raw = optionalEnv("DODO_PAYMENTS_WEBHOOK_KEY");
    if (!raw) {
        return null;
    }
    const keyBytes = base64ToBytes(raw.replace(/^whsec_/, ""));
    if (!keyBytes) {
        return null;
    }
    return crypto.subtle.importKey("raw", keyBytes as unknown as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, [
        "sign",
    ]);
}

// 워커에는 node:crypto의 HMAC이 없다. Web Crypto로 서명하고 상수 시간 비교한다.
async function verifySignature(headers: Headers, payload: string, key: CryptoKey): Promise<boolean> {
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
    const signed = new TextEncoder().encode(`${id}.${timestamp}.${payload}`);
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
    for (const sig of signatures) {
        const actual = base64ToBytes(sig);
        if (!actual || actual.length !== expected.length) {
            continue;
        }
        let diff = 0;
        for (let i = 0; i < expected.length; i++) {
            diff |= actual[i] ^ expected[i];
        }
        if (diff === 0) {
            return true;
        }
    }
    return false;
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
            syncIntervalSec: planOf("pro").syncIntervalSec,
            ...rest,
            ...(cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd } : {}),
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: subscriptions.userId,
            set: {
                ...rest,
                // 해지 예약은 갱신 이벤트가 명시적으로 풀 때만 되돌린다.
                // 그 외 이벤트에서 undefined면 기존 값을 유지해야 예약이 지워지지 않는다.
                ...(cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd } : {}),
                updatedAt: new Date(),
            },
        });
}

const webhookDodo = new Hono<{ Bindings: AppEnv }>();

webhookDodo.post("/", async (c) => {
    const key = await webhookKey();
    if (!key) {
        return getBaseResponse({ success: false, status: 503, error: "webhook key not configured" });
    }
    // 서명은 원문 바이트 기준이라 text로 읽는다 (json()을 먼저 쓰면 재직렬화로 서명이 깨진다).
    const payload = await c.req.text();
    if (!(await verifySignature(c.req.raw.headers, payload, key))) {
        return getBaseResponse({ success: false, status: 401, error: "invalid signature" });
    }
    let body: WebhookBody;
    try {
        body = JSON.parse(payload) as WebhookBody;
    } catch {
        return getBaseResponse({ success: false, status: 400, error: "invalid JSON" });
    }
    const userId = body.data?.metadata?.user_id;
    if (!userId || typeof userId !== "string") {
        // 유저 매핑 없는 이벤트는 처리 대상이 아니다. 재시도 시키지 않는다.
        return getBaseResponse({ success: true, status: 200, message: "ignored (no user metadata)" });
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
                    status,
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
        return getBaseResponse({ success: false, status: 500, error: "webhook processing failed" });
    }
    return getBaseResponse({ success: true, status: 200 });
});

export default webhookDodo;
