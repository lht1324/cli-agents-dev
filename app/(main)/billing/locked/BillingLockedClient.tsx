"use client";

import { useMemo, useState } from "react";
import { dodoClientAPI } from "@/lib/api/client/dodoClientAPI";

// 트라이얼 종료 화면. Subscribe는 랜딩 pricing 섹션과 같은 체크아웃 API를 쓴다.
export default function BillingLockedClient() {
    const [loading, setLoading] = useState<"monthly" | "annual" | null>(null);

    const onClickSubscribe = useMemo(
        () => async (interval: "monthly" | "annual") => {
            setLoading(interval);
            try {
                const result = await dodoClientAPI.createCheckout(interval, window.location.origin);
                if (result.ok) {
                    window.location.href = result.data.checkoutUrl;
                }
            } finally {
                setLoading(null);
            }
        },
        [],
    );

    return (
        <main className="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center">
            <h1 className="font-mono text-2xl font-bold">Trial ended.</h1>
            <p className="mt-3 max-w-md text-dim">
                Your 30-day trial is over. Your sessions are safe and waiting. Subscribe to keep syncing them.
            </p>
            <div className="mt-8 flex gap-3">
                <button
                    type="button"
                    onClick={() => onClickSubscribe("monthly")}
                    disabled={loading !== null}
                    className="rounded bg-go px-5 py-2 font-mono text-sm font-bold text-ink transition-opacity hover:opacity-85 disabled:opacity-50"
                >
                    {loading === "monthly" ? "Loading..." : "Subscribe $9/mo"}
                </button>
                <button
                    type="button"
                    onClick={() => onClickSubscribe("annual")}
                    disabled={loading !== null}
                    className="rounded border border-line px-5 py-2 font-mono text-sm text-fog transition-colors hover:bg-black disabled:opacity-50"
                >
                    {loading === "annual" ? "Loading..." : "Subscribe $90/yr"}
                </button>
            </div>
            <p className="mt-4 font-mono text-xs text-dim">$7.50/mo with annual billing · 2 months free</p>
        </main>
    );
}
