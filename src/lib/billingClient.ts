import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export type BillingInterval = "monthly" | "annual";

// 체크아웃 생성 → Dodo 결제 페이지로 이동. 로그인 전이면 로그인 화면으로 보낸다.
export function useCheckout() {
    const [busy, setBusy] = useState<BillingInterval | null>(null);
    const [error, setError] = useState<string | null>(null);

    const startCheckout = useCallback(async (interval: BillingInterval) => {
        setBusy(interval);
        setError(null);
        try {
            const res = await fetch("/api/web/dodo/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ interval, origin: window.location.origin }),
            });
            if (res.status === 401) {
                window.location.href = "/auth/sign-in";
                return;
            }
            const body = (await res.json()) as { success: boolean; data?: { checkoutUrl?: string }; error?: string };
            if (!res.ok || !body.success || !body.data?.checkoutUrl) {
                setError(body.error ?? "Could not open checkout. Try again.");
                return;
            }
            window.location.href = body.data.checkoutUrl;
        } catch {
            setError("Could not open checkout. Try again.");
        } finally {
            setBusy(null);
        }
    }, []);

    return { busy, error, startCheckout };
}

// 구독 해지 예약 / 해지 철회. 서버가 즉시 반영하므로 계정 쿼리를 다시 읽는다.
export function useSubscriptionActions() {
    const queryClient = useQueryClient();
    const [busy, setBusy] = useState<"cancel" | "resume" | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = useCallback(
        async (action: "cancel" | "resume") => {
            setBusy(action);
            setError(null);
            try {
                const res = await fetch(`/api/web/dodo/${action}`, { method: "POST" });
                const body = (await res.json()) as { success: boolean; error?: string };
                if (!res.ok || !body.success) {
                    setError(body.error ?? `Failed to ${action} subscription.`);
                    return false;
                }
                await queryClient.invalidateQueries({ queryKey: ["account"] });
                return true;
            } catch {
                setError(`Failed to ${action} subscription.`);
                return false;
            } finally {
                setBusy(null);
            }
        },
        [queryClient],
    );

    return { busy, error, cancel: () => run("cancel"), resume: () => run("resume") };
}
