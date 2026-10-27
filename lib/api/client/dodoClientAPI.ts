import { postFetch } from "./baseFetch";
import { toFailure, type ClientResult } from "./result";

export type BillingInterval = "monthly" | "annual";

interface CheckoutBody {
    success?: boolean;
    error?: string;
    data?: { checkoutUrl?: string };
}

interface BasicBody {
    success?: boolean;
    error?: string;
}

// Dodo 관련 쓰기. 체크아웃 세션 생성과 구독 취소/복원 토글.
// 브라우저는 Dodo를 직접 부르지 않는다 — 서버가 상품 매핑과 상태 반영을 맡는다.
export const dodoClientAPI = {
    async createCheckout(interval: BillingInterval, origin: string): Promise<ClientResult<{ checkoutUrl: string }>> {
        try {
            const res = await postFetch("/api/web/dodo/checkout", { interval, origin });
            const body = (await res.json()) as CheckoutBody;
            const checkoutUrl = body.data?.checkoutUrl;
            if (!body.success || !checkoutUrl) {
                return { ok: false, status: res.status, error: body.error };
            }
            return { ok: true, data: { checkoutUrl } };
        } catch (error) {
            return toFailure(error);
        }
    },

    // 취소 예약. 서버가 DB에 즉시 반영하므로 호출부는 성공 시 화면을 다시 그린다.
    async cancelSubscription(): Promise<ClientResult<null>> {
        return postBasic("/api/web/dodo/cancel");
    },

    async resumeSubscription(): Promise<ClientResult<null>> {
        return postBasic("/api/web/dodo/resume");
    },
};

async function postBasic(route: string): Promise<ClientResult<null>> {
    try {
        const res = await postFetch(route, {});
        const body = (await res.json()) as BasicBody;
        if (!body.success) {
            return { ok: false, status: res.status, error: body.error };
        }
        return { ok: true, data: null };
    } catch (error) {
        return toFailure(error);
    }
}
