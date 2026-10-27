// 서버 전용 Dodo 클라이언트. SDK 없이 REST를 fetch로 직접 호출한다 (의존성 0).
// 상품 ID 하드코딩 없음 — products.list()를 metadata로 매핑 (tailored-ad dodoProducts.ts 패턴).
// 모드는 DODO_PAYMENTS_ENVIRONMENT로 명시한다 (test_mode | live_mode. SDK 공식 규약).
// 키 프리픽스로 판정하지 않는다 — Dodo 신형 키는 sk_test_ 프리픽스가 없다. 런타임 프로브도 Cloudflare(엣지)에선 못 쓴다.
const API_KEY = process.env.DODO_PAYMENTS_API_KEY ?? "";

const BASE_URL =
    process.env.DODO_PAYMENTS_ENVIRONMENT === "test_mode"
        ? "https://test.dodopayments.com"
        : "https://live.dodopayments.com";

// products.list 한 방.
async function dodoGet(path: string): Promise<unknown> {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
        signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`dodo GET ${path} failed (${res.status}): ${text.slice(0, 300)}`);
    }
    return res.json();
}

export type BillingInterval = "monthly" | "annual";

// products.list() 결과를 interval로 매핑. metadata {plan: "pro", interval}이 진실원천.
// 월·연 각각 정확히 1개여야 통과 (누락·중복은 loudly 실패 — 오결제 방지).
let cached: { at: number; byInterval: Record<BillingInterval, string> } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

async function resolveMapping(): Promise<Record<BillingInterval, string>> {
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return cached.byInterval;
    }
    if (!API_KEY) {
        throw new Error("DODO_PAYMENTS_API_KEY is not set");
    }
    const data = (await dodoGet("/products?limit=100")) as {
        items?: Array<{ product_id?: string; id?: string; metadata?: unknown }>;
    };
    const byInterval = { monthly: "", annual: "" } as Record<BillingInterval, string>;
    for (const p of data.items ?? []) {
        const meta = (p.metadata ?? null) as Record<string, unknown> | null;
        if (!meta || typeof meta !== "object") {
            continue;
        }
        const plan = typeof meta.plan === "string" ? meta.plan.trim() : "";
        const interval = typeof meta.interval === "string" ? meta.interval.trim() : "";
        if (plan !== "pro" || (interval !== "monthly" && interval !== "annual")) {
            continue;
        }
        const id = p.product_id ?? p.id ?? "";
        if (interval === "monthly") {
            byInterval.monthly = id;
        } else {
            byInterval.annual = id;
        }
    }
    if (!byInterval.monthly || !byInterval.annual) {
        throw new Error(
            `dodo product mapping incomplete (monthly=${byInterval.monthly || "missing"}, annual=${byInterval.annual || "missing"}). check product metadata {plan: pro, interval}`,
        );
    }
    cached = { at: Date.now(), byInterval };
    return byInterval;
}

// 체크아웃을 만들려면 API 키 하나면 된다. 상품은 metadata 매핑으로 해석.
export function dodoConfigured(): boolean {
    return Boolean(API_KEY);
}

// 체크아웃 세션 생성. metadata의 user_id는 웹훅으로 구독 상태를 유저에 매핑할 때 쓴다.
// customer로 이름·이메일을 미리 채운다. 이메일은 계정 소유 확인의 기준이라 수정 불가로 고정하고
// (다른 이메일로 결제하면 웹훅 user_id 매핑과 고객 레코드가 어긋난다), 이름은 오타 정정 여지를 남긴다.
export async function createDodoCheckout(
    interval: BillingInterval,
    userId: string,
    returnUrl: string,
    customer?: { email: string; name: string | null },
): Promise<{ sessionId: string; checkoutUrl: string | null }> {
    const mapping = await resolveMapping();
    const productId = mapping[interval];
    const base = BASE_URL;
    const res = await fetch(`${base}/checkouts`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
            product_cart: [{ product_id: productId, quantity: 1 }],
            return_url: returnUrl,
            metadata: { user_id: userId, interval },
            ...(customer
                ? {
                      customer: {
                          email: customer.email,
                          ...(customer.name ? { name: customer.name } : {}),
                      },
                  }
                : {}),
            // 이메일을 미리 넣었을 때만 잠근다. 없으면 잠글 칸이 없어 결제가 막힌다.
            // 이름은 오타 정정 여지를 남긴다.
            feature_flags: {
                allow_customer_editing_name: true,
                allow_customer_editing_email: !customer,
            },
        }),
        signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`dodo checkout failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as CheckoutResponse;
    return { sessionId: data.session_id ?? "", checkoutUrl: data.checkout_url ?? null };
}

interface CheckoutResponse {
    session_id?: string;
    checkout_url?: string;
}

// 구독 취소 예약/복원. PATCH /subscriptions/{id}의 cancel_at_next_billing_date 토글.
// true = 기간 끝까지 유효 후 종료, false = 취소 예약 해제(자동 갱신 재개).
// 상태 반영은 웹훅(subscription.updated)이 한다 — 여기선 Dodo에 요청만 넣는다.
export async function setDodoSubscriptionCancel(
    subscriptionId: string,
    cancelAtNextBillingDate: boolean,
): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ cancel_at_next_billing_date: cancelAtNextBillingDate }),
        signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
        const text = await res.text();
        console.error(`dodo subscription update failed (${res.status}): ${text.slice(0, 300)}`);
        return false;
    }
    return true;
}
