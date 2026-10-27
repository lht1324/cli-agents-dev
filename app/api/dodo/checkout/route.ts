import { sql } from "drizzle-orm";
import { readInternalUser } from "@/lib/auth/internal";
import { createDodoCheckout, dodoConfigured, type BillingInterval } from "@/lib/dodo";
import { getDb } from "@/lib/neon";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

interface CheckoutBody {
    interval?: unknown;
    origin?: unknown;
}

// 브라우저 → Dodo 체크아웃 세션 생성. 게이트웨이를 거친 호출만 허용한다.
export async function POST(request: Request): Promise<Response> {
    const userId = readInternalUser(request);
    if (!userId) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    if (!dodoConfigured()) {
        return getNextBaseResponse(503).json({ success: false, status: 503, error: "billing is not configured" });
    }
    let body: CheckoutBody;
    try {
        body = (await request.json()) as CheckoutBody;
    } catch {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "invalid JSON body" });
    }
    if (body.interval !== "monthly" && body.interval !== "annual") {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "interval must be monthly or annual" });
    }
    // 되돌아올 페이지 origin. dev에서 웹(3004)·API(3005)가 갈려 있으므로 클라이언트 origin을 믿고 쓴다.
    // return_url에는 토큰이 실리지 않으므로 변조 위험이 낮다.
    const origin =
        typeof body.origin === "string" && body.origin.startsWith("http")
            ? body.origin
            : new URL(request.url).origin;
    try {
        // 체크아웃 연락처 프리필. 계정 이메일은 잠그고 이름은 열어 둔다 (lib/dodo.ts 참조).
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
            return getNextBaseResponse(502).json({ success: false, status: 502, error: "checkout url missing" });
        }
        return getNextBaseResponse(201).json({
            success: true,
            status: 201,
            data: { checkoutUrl: checkout.checkoutUrl, sessionId: checkout.sessionId },
        });
    } catch (error) {
        console.error("[checkout] dodo:", error);
        return getNextBaseResponse(502).json({ success: false, status: 502, error: "checkout creation failed" });
    }
}
