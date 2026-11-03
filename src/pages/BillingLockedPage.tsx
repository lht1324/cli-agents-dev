import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useCheckout } from "@/lib/billingClient";
import { accountClientAPI } from "@/lib/api/client/accountClientAPI";

// 트라이얼 종료 화면. 랜딩 pricing 섹션과 같은 체크아웃 API를 쓴다.
export default function BillingLockedPage() {
    const { busy, error, startCheckout } = useCheckout();
    const navigate = useNavigate();

    // 이미 구독 중인데 직접 URL로 들어온 경우 인박스로 돌려보낸다.
    const { data } = useQuery({ queryKey: ["account"], queryFn: accountClientAPI.getAccount });
    useEffect(() => {
        if (data?.status === "active") {
            navigate("/sessions", { replace: true });
        }
    }, [data?.status, navigate]);

    return (
        <main className="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center">
            <h1 className="font-mono text-2xl font-bold">Trial ended.</h1>
            <p className="mt-3 max-w-md text-dim">
                Your 30-day trial is over. Your sessions are safe and waiting. Subscribe to keep syncing them.
            </p>
            <div className="mt-8 flex gap-3">
                <button
                    type="button"
                    onClick={() => void startCheckout("monthly")}
                    disabled={busy !== null}
                    className="rounded bg-go px-5 py-2 font-mono text-sm font-bold text-ink transition-opacity hover:opacity-85 disabled:opacity-50"
                >
                    {busy === "monthly" ? "Loading..." : "Subscribe $9/mo"}
                </button>
                <button
                    type="button"
                    onClick={() => void startCheckout("annual")}
                    disabled={busy !== null}
                    className="rounded border border-line px-5 py-2 font-mono text-sm text-fog transition-colors hover:bg-black disabled:opacity-50"
                >
                    {busy === "annual" ? "Loading..." : "Subscribe $90/yr"}
                </button>
            </div>
            <p className="mt-4 font-mono text-xs text-dim">$7.50/mo with annual billing · 2 months free</p>
            {error ? <p className="mt-4 font-mono text-sm text-warn">{error}</p> : null}
        </main>
    );
}
