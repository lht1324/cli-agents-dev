import { useCallback, useState } from "react";
import { dodoClientAPI, type BillingInterval } from "@/lib/api/client/dodoClientAPI";

// 체크아웃 생성 → Dodo 결제 페이지로 이동.
// 이미 구독 중이면 서버가 409로 거절하고, ClientAPI가 Profile로 보낸다.
export function useCheckout() {
    const [busy, setBusy] = useState<BillingInterval | null>(null);
    const [error, setError] = useState<string | null>(null);

    const startCheckout = useCallback(async (interval: BillingInterval) => {
        setBusy(interval);
        setError(null);
        try {
            const checkout = await dodoClientAPI.createCheckout(interval, window.location.origin);
            if (!checkout?.checkoutUrl) {
                setError("Could not open checkout. Try again.");
                return;
            }
            window.location.href = checkout.checkoutUrl;
        } finally {
            setBusy(null);
        }
    }, []);

    return { busy, error, startCheckout };
}
