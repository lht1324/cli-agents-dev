import { useCheckout, type BillingInterval } from "@/lib/billingClient";

interface Plan {
    interval: BillingInterval;
    name: string;
    price: string;
    unit: string;
    note: string;
    badge: string | null;
    button: string;
    highlight: boolean;
}

const PLANS: Plan[] = [
    {
        interval: "monthly",
        name: "Monthly",
        price: "$9",
        unit: "/mo",
        note: "Cancel anytime.",
        badge: null,
        button: "Subscribe monthly",
        highlight: false,
    },
    {
        interval: "annual",
        name: "Yearly",
        price: "$90",
        unit: "/year",
        note: "$7.50/mo · billed annually.",
        badge: "2 months free",
        button: "Subscribe yearly",
        highlight: true,
    },
];

const FEATURES = [
    "$ cross-PC push / pull",
    "$ unlimited sessions · all devices",
    "$ approve & steer from anywhere",
];

// 랜딩(#pricing)과 이용 정지 화면이 함께 쓰는 요금제 섹션.
export default function PricingSection() {
    const { busy, error, startCheckout } = useCheckout();

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
                                onClick={() => void startCheckout(plan.interval)}
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
