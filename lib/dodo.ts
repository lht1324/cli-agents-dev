// 서버 전용 Dodo 클라이언트. SDK 없이 REST를 fetch로 직접 호출한다 (의존성 0).
const BASE_URL = process.env.DODO_API_BASE_URL ?? "https://live.dodopayments.com";

export type BillingInterval = "monthly" | "annual";

interface CheckoutResponse {
    session_id?: string;
    checkout_url?: string;
}

// 체크아웃을 만들려면 키 + 상품 2개가 모두 있어야 한다.
export function dodoConfigured(): boolean {
    return Boolean(
        process.env.DODO_PAYMENTS_API_KEY &&
            process.env.DODO_PRODUCT_MONTHLY &&
            process.env.DODO_PRODUCT_ANNUAL,
    );
}

export function productIdFor(interval: BillingInterval): string | null {
    if (interval === "monthly") {
        return process.env.DODO_PRODUCT_MONTHLY ?? null;
    }
    return process.env.DODO_PRODUCT_ANNUAL ?? null;
}

// 체크아웃 세션 생성. metadata의 user_id는 웹훅으로 구독 상태를 유저에 매핑할 때 쓴다.
export async function createDodoCheckout(
    interval: BillingInterval,
    userId: string,
    returnUrl: string,
): Promise<{ sessionId: string; checkoutUrl: string | null }> {
    const productId = productIdFor(interval);
    if (!productId) {
        throw new Error(`product id for ${interval} is not configured`);
    }
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!apiKey) {
        throw new Error("DODO_PAYMENTS_API_KEY is not set");
    }
    const res = await fetch(`${BASE_URL}/checkouts`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            product_cart: [{ product_id: productId, quantity: 1 }],
            return_url: returnUrl,
            metadata: { user_id: userId, interval },
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
