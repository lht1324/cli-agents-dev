"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CreditCard, Mail, Monitor, ScrollText } from "lucide-react";
import { dodoClientAPI } from "@/lib/api/client/dodoClientAPI";

export interface ProfileData {
    email: string | null;
    name: string | null;
    image: string | null;
    memberSince: string | null;
    planId: string;
    status: string | null;
    interval: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    deviceCount: number;
    sessionCount: number;
    daysLeft: number | null;
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) {
        return "-";
    }
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

export default function ProfilePageClient({ data }: { data: ProfileData }) {
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [isCanceling, setIsCanceling] = useState(false);
    const [isResuming, setIsResuming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isPro = data.status === "active";
    const planLabel = isPro ? "Pro" : "Trial";

    const onClickCancelSubscription = useCallback(() => {
        setError(null);
        setShowCancelModal(true);
    }, []);

    const onConfirmCancel = useCallback(async () => {
        setIsCanceling(true);
        try {
            const result = await dodoClientAPI.cancelSubscription();
            if (!result.ok) {
                setError(result.error ?? "Failed to cancel subscription.");
                setShowCancelModal(false);
                return;
            }
            // 서버에서 이미 반영됐다. 최신 구독 상태로 화면을 다시 그린다.
            setShowCancelModal(false);
            window.location.reload();
        } finally {
            setIsCanceling(false);
        }
    }, []);

    const onClickResume = useCallback(async () => {
        setError(null);
        const result = await dodoClientAPI.resumeSubscription();
        if (result.ok) {
            window.location.reload();
            return;
        }
        setError(result.error ?? "Failed to resume subscription.");
    }, []);

    const onClickCloseModal = useCallback(() => {
        if (!isCanceling) {
            setShowCancelModal(false);
        }
    }, [isCanceling]);

    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <h1 className="font-mono text-xl font-bold">Profile</h1>

            {/* Account */}
            <div className="mt-6 rounded border border-line bg-panel p-4">
                <div className="flex flex-wrap items-center gap-6">
                    {data.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={data.image} alt={data.name ?? "avatar"} className="h-20 w-20 rounded-full border border-line object-cover" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                        <h2 className="truncate font-bold">{data.name ?? "-"}</h2>
                        <div className="mt-1 flex items-center gap-2 text-sm text-dim">
                            <Mail size={14} />
                            <span className="truncate">{data.email ?? "-"}</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                        <span className="flex items-center gap-1.5 font-mono text-xs text-dim">
                            <Monitor size={13} />
                            {data.deviceCount} {data.deviceCount === 1 ? "device" : "devices"}
                        </span>
                        <span className="flex items-center gap-1.5 font-mono text-xs text-dim">
                            <ScrollText size={13} />
                            {data.sessionCount} {data.sessionCount === 1 ? "session" : "sessions"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Subscription */}
            <div className="mt-4 rounded border border-line bg-panel p-4">
                <h3 className="flex items-center gap-2 font-mono text-sm font-bold">
                    <CreditCard size={14} />
                    Subscription
                </h3>
                {isPro ? (
                    <>
                        {data.cancelAtPeriodEnd && (
                            <div className="mt-4 rounded border border-warn/30 bg-warn/5 p-3">
                                <p className="text-sm font-semibold text-warn">Subscription Ending</p>
                                <p className="mt-1 text-xs text-dim">
                                    Your subscription will end on {formatDate(data.currentPeriodEnd)}. Your sessions stay safe.
                                </p>
                                <button
                                    type="button"
                                    onClick={onClickResume}
                                    disabled={isResuming}
                                    className="mt-3 rounded border border-warn/40 px-3 py-1.5 font-mono text-xs font-bold text-warn transition-colors hover:bg-warn/10 disabled:opacity-50"
                                >
                                    {isResuming ? "Working..." : "Keep subscription"}
                                </button>
                            </div>
                        )}
                        <dl className="mt-4 space-y-2 text-sm">
                            <Row label="Plan" value={data.cancelAtPeriodEnd ? "Cancels at period end" : planLabel} />
                            <Row label="Billing cycle" value={data.interval === "annual" ? "Annual" : "Monthly"} />
                            <Row label="Next billing" value={formatDate(data.currentPeriodEnd)} />
                        </dl>
                        {!data.cancelAtPeriodEnd && (
                            <button
                                type="button"
                                onClick={onClickCancelSubscription}
                                className="mt-4 w-full rounded border border-line px-4 py-2 text-sm font-medium text-dim transition-colors hover:bg-black disabled:opacity-50"
                            >
                                Cancel Subscription
                            </button>
                        )}
                    </>
                ) : (
                    <div className="mt-4 space-y-2">
                        <p className="text-sm text-dim">
                            {data.daysLeft !== null && data.daysLeft > 0
                                ? `${data.daysLeft} ${data.daysLeft === 1 ? "day" : "days"} left in your free trial.`
                                : "Your free trial has ended."}
                        </p>
                        <p className="text-xs text-dim">Subscribe to keep sessions syncing across every PC.</p>
                        <Link href="/#pricing" className="font-mono text-xs text-go underline-offset-2 hover:underline">
                            View Pricing
                        </Link>
                    </div>
                )}
            </div>

            {showCancelModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="mx-4 rounded border border-line bg-panel p-6">
                        <h3 className="font-mono text-sm font-bold">Cancel Subscription</h3>
                        <p className="mt-2 max-w-sm text-sm text-dim">
                            Your subscription stays active until the end of the current billing period. Your sessions stay safe.
                        </p>
                        <div className="mt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClickCloseModal}
                                className="rounded border border-line px-4 py-2 text-sm font-medium text-dim transition-colors hover:bg-black"
                            >
                                No, keep it
                            </button>
                            <button
                                type="button"
                                onClick={onConfirmCancel}
                                disabled={isCanceling}
                                className="rounded bg-warn px-4 py-2 text-sm font-bold text-ink transition-opacity hover:opacity-85 disabled:opacity-50"
                            >
                                {isCanceling ? "Canceling..." : "Yes, cancel"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Member since */}
            <div className="mt-4 rounded border border-line bg-panel p-4">
                <h3 className="font-mono text-sm font-bold">Member since</h3>
                <p className="mt-2 text-sm">{formatDate(data.memberSince)}</p>
            </div>
        </main>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between border-b border-line py-2">
            <dt className="text-dim">{label}</dt>
            <dd className="font-medium">{value}</dd>
        </div>
    );
}
