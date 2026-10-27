"use client";

import { useState } from "react";
import { dodoClientAPI } from "@/lib/api/client/dodoClientAPI";

type Interval = "monthly" | "annual";

const PLANS = [
    {
        interval: "monthly" as Interval,
        name: "Monthly",
        price: "$9",
        unit: "/mo",
        note: "Cancel anytime.",
        badge: null as string | null,
        button: "Subscribe monthly",
        highlight: false,
    },
    {
        interval: "annual" as Interval,
        name: "Yearly",
        price: "$90",
        unit: "/year",
        note: "$7.50/mo · billed annually.",
        badge: "2 months free" as string | null,
        button: "Subscribe yearly",
        highlight: true,
    },
];

const FEATURES = [
    "$ unlimited sessions · all devices",
    "$ approve & steer from anywhere",
    "$ cross-PC push / pull",
];

export default function PricingSection() {
    const [busy, setBusy] = useState<Interval | null>(null);
    const [error, setError] = useState<string | null>(null);

    const onClickSubscribe = async (interval: Interval) => {
        setBusy(interval);
        setError(null);
        try {
            const result = await dodoClientAPI.createCheckout(interval, window.location.origin);
            if (result.ok) {
                window.location.href = result.data.checkoutUrl;
                return;
            }
            // 로그인 전이면 401. 가입 흐름으로 보낸다.
            if (result.status === 401) {
                window.location.href = "/auth/sign-in";
                return;
            }
            setError("Could not open checkout. Try again.");
        } finally {
            setBusy(null);
        }
    };

    return (
        <section id="pricing" className="scroll-mt-14 border-t border-line">
            <div className="mx-auto w-full max-w-6xl px-4 py-16">
                <h2 className="text-2xl font-bold tracking-tight">Pricing</h2>
                <p className="mt-2 font-mono text-sm text-go">
                    30-day free trial. No card required. Nothing auto-starts after the trial.
                </p>
                <div className="mt-8 grid gap-6 md:grid-cols-2">
                    {PLANS.map((plan) => (
                        <div key={plan.interval} className="flex flex-col rounded border border-line bg-ink p-6">
                            <div className="flex items-center justify-between">
                                <h3 className="font-mono text-sm text-fog">{plan.name}</h3>
                                {plan.badge ? (
                                    <span className="rounded bg-go px-2 py-0.5 font-mono text-xs font-bold text-ink">
                                        {plan.badge}
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-4">
                                <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                                <span className="ml-1 font-mono text-sm text-dim">{plan.unit}</span>
                            </p>
                            <p className="mt-1 font-mono text-xs text-dim">{plan.note}</p>
                            <ul className="mt-5 space-y-1.5 font-mono text-xs text-dim">
                                {FEATURES.map((line) => (
                                    <li key={line}>{line}</li>
                                ))}
                            </ul>
                            <button
                                type="button"
                                onClick={() => onClickSubscribe(plan.interval)}
                                disabled={busy !== null}
                                className={
                                    plan.highlight
                                        ? "mt-6 rounded bg-go px-4 py-2 font-mono text-sm font-bold text-ink transition-opacity hover:opacity-85 disabled:opacity-60"
                                        : "mt-6 rounded border border-line px-4 py-2 font-mono text-sm text-fog transition-colors hover:bg-black disabled:opacity-60"
                                }
                            >
                                {busy === plan.interval ? "Opening checkout..." : plan.button}
                            </button>
                        </div>
                    ))}
                </div>
                {error ? <p className="mt-4 font-mono text-sm text-warn">{error}</p> : null}
            </div>
        </section>
    );
}
