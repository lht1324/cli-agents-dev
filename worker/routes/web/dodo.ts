import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { createDodoCheckout, dodoConfigured, setDodoSubscriptionCancel, type BillingInterval } from "../../../lib/dodo";
import { getDb } from "../../../lib/neon/client";
import { subscriptions } from "../../../lib/neon/schema";
import type { AppEnv } from "../../../lib/env";
import type { AuthVariables } from "../../middleware/auth";
import { getBaseResponse } from "../../utils/getBaseResponse";

const webDodo = new Hono<{ Bindings: AppEnv; Variables: AuthVariables }>();

// 체크아웃 세션 생성. metadata의 user_id가 웹훅에서 구독을 유저에 매핑하는 근거다.
webDodo.post("/checkout", async (c) => {
    const userId = c.get("userId");
    if (!dodoConfigured()) {
        return getBaseResponse({ success: false, status: 503, error: "billing is not configured" });
    }
    let body: { interval?: unknown; origin?: unknown };
    try {
        body = (await c.req.json()) as { interval?: unknown; origin?: unknown };
    } catch {
        return getBaseResponse({ success: false, status: 400, error: "invalid JSON body" });
    }
    if (body.interval !== "monthly" && body.interval !== "annual") {
        return getBaseResponse({ success: false, status: 400, error: "interval must be monthly or annual" });
    }
    // 이미 구독 중이면 새 체크아웃을 만들지 않는다 (중복 결제 방지).
    // 해지 예약 상태여도 기간이 남아 있으면 active이므로 함께 막힌다.
    const [existing] = await getDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);
    if (existing?.status === "active") {
        return getBaseResponse({ success: false, status: 409, error: "already_subscribed" });
    }
    // 되돌아올 페이지 origin. return_url에는 토큰이 실리지 않으므로 변조 위험이 낮다.
    const origin =
        typeof body.origin === "string" && body.origin.startsWith("http") ? body.origin : new URL(c.req.url).origin;
    try {
        // 체크아웃 연락처 프리필. 계정 이메일은 잠그고 이름은 열어 둔다.
        // 조회 실패는 치명적이지 않다 — 프리필 없이 체크아웃은 그대로 진행된다.
        let customer: { email: string; name: string | null } | undefined;
        try {
            const rows = await getDb().execute<{ email: string | null; name: string | null }>(
                sql`SELECT email, name FROM neon_auth."user" WHERE id = ${userId} LIMIT 1`,
            );
            const row = rows.rows[0];
            if (row?.email) {
                customer = { email: row.email, name: row.name ?? null };
            }
        } catch (error) {
            console.error("[checkout] customer prefill skipped:", error);
        }
        const checkout = await createDodoCheckout(
            body.interval as BillingInterval,
            userId,
            `${origin}/sessions`,
            customer,
        );
        if (!checkout.checkoutUrl) {
            return getBaseResponse({ success: false, status: 502, error: "checkout url missing" });
        }
        return getBaseResponse({ success: true, status: 201, data: { checkoutUrl: checkout.checkoutUrl, sessionId: checkout.sessionId } });
    } catch (error) {
        console.error("[checkout] dodo:", error);
        return getBaseResponse({ success: false, status: 502, error: "checkout creation failed" });
    }
});

// 구독 취소 예약. 기간 끝까지는 유효 (cancel_at_next_billing_date: true).
// 실제 상태 변경은 Dodo 웹훅이 반영한다. 즉시 반영은 웹훅이 늦게 와도 같은 값이라 멱등.
webDodo.post("/cancel", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const [row] = await db
        .select({ dodoSubscriptionId: subscriptions.dodoSubscriptionId, status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);
    if (!row?.dodoSubscriptionId || row.status !== "active") {
        return getBaseResponse({ success: false, status: 409, error: "no active subscription" });
    }
    const ok = await setDodoSubscriptionCancel(row.dodoSubscriptionId, true);
    if (!ok) {
        return getBaseResponse({ success: false, status: 502, error: "dodo request failed" });
    }
    await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
        .where(eq(subscriptions.userId, userId));
    return getBaseResponse({ success: true, status: 200 });
});

// 취소 예약 해제 (자동 갱신 재개).
webDodo.post("/resume", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const [row] = await db
        .select({ dodoSubscriptionId: subscriptions.dodoSubscriptionId, status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);
    if (!row?.dodoSubscriptionId || row.status !== "active") {
        return getBaseResponse({ success: false, status: 409, error: "no subscription" });
    }
    const ok = await setDodoSubscriptionCancel(row.dodoSubscriptionId, false);
    if (!ok) {
        return getBaseResponse({ success: false, status: 502, error: "dodo request failed" });
    }
    await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
        .where(eq(subscriptions.userId, userId));
    return getBaseResponse({ success: true, status: 200 });
});

export default webDodo;
