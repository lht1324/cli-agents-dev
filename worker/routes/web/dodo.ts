import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { createDodoCheckout, dodoConfigured, setDodoSubscriptionCancel, type BillingInterval } from "../../../lib/dodo";
import { getDb } from "../../../lib/neon/client";
import { subscriptions } from "../../../lib/neon/schema";
import type { AppEnv } from "../../../lib/env";
import type { AuthVariables } from "../../middleware/auth";

const webDodo = new Hono<{ Bindings: AppEnv; Variables: AuthVariables }>();

// 체크아웃 세션 생성. metadata의 user_id가 웹훅에서 구독을 유저에 매핑하는 근거다.
webDodo.post("/checkout", async (c) => {
    const userId = c.get("userId");
    if (!dodoConfigured()) {
        return c.json({ success: false, status: 503, error: "billing is not configured" }, 503);
    }
    let body: { interval?: unknown; origin?: unknown };
    try {
        body = (await c.req.json()) as { interval?: unknown; origin?: unknown };
    } catch {
        return c.json({ success: false, status: 400, error: "invalid JSON body" }, 400);
    }
    if (body.interval !== "monthly" && body.interval !== "annual") {
        return c.json({ success: false, status: 400, error: "interval must be monthly or annual" }, 400);
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
            return c.json({ success: false, status: 502, error: "checkout url missing" }, 502);
        }
        return c.json(
            { success: true, status: 201, data: { checkoutUrl: checkout.checkoutUrl, sessionId: checkout.sessionId } },
            201,
        );
    } catch (error) {
        console.error("[checkout] dodo:", error);
        return c.json({ success: false, status: 502, error: "checkout creation failed" }, 502);
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
        return c.json({ success: false, status: 409, error: "no active subscription" }, 409);
    }
    const ok = await setDodoSubscriptionCancel(row.dodoSubscriptionId, true);
    if (!ok) {
        return c.json({ success: false, status: 502, error: "dodo request failed" }, 502);
    }
    await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
        .where(eq(subscriptions.userId, userId));
    return c.json({ success: true, status: 200 });
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
        return c.json({ success: false, status: 409, error: "no subscription" }, 409);
    }
    const ok = await setDodoSubscriptionCancel(row.dodoSubscriptionId, false);
    if (!ok) {
        return c.json({ success: false, status: 502, error: "dodo request failed" }, 502);
    }
    await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
        .where(eq(subscriptions.userId, userId));
    return c.json({ success: true, status: 200 });
});

export default webDodo;
