import { postFetch } from "./baseFetch";
import { readBaseResponse, readBaseResponseOk } from "./readBaseResponse";

export type BillingInterval = "monthly" | "annual";

export const dodoClientAPI = {
    async createCheckout(
        interval: BillingInterval,
        origin: string,
    ): Promise<{ checkoutUrl: string; sessionId: string } | null> {
        const res = await postFetch("/api/web/dodo/checkout", { interval, origin });
        // 이미 구독 중이면 결제창을 열지 않고 구독 관리로 보낸다.
        if (res.status === 409) {
            window.location.href = "/profile";
            return null;
        }
        return readBaseResponse<{ checkoutUrl: string; sessionId: string }>(res);
    },

    async cancelSubscription(): Promise<boolean> {
        return readBaseResponseOk(await postFetch("/api/web/dodo/cancel"));
    },

    async resumeSubscription(): Promise<boolean> {
        return readBaseResponseOk(await postFetch("/api/web/dodo/resume"));
    },
};
