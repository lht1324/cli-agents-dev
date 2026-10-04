"use client";

import { useCallback, useState } from "react";

export default function DeviceAuthorizeClient({
    deviceId,
    port,
    state,
    label,
    platform,
    hostname,
}: {
    deviceId: string;
    port: string;
    state: string;
    label: string;
    platform: string;
    hostname: string;
}) {
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const onClickConnect = useCallback(async () => {
        setBusy(true);
        setFailed(false);
        try {
            const res = await fetch("/api/device/authorize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deviceId, label, platform, hostname }),
            });
            if (!res.ok) {
                setFailed(true);
                return;
            }
            const body = (await res.json()) as { data?: { token?: string } };
            const token = body.data?.token;
            if (!token) {
                setFailed(true);
                return;
            }
            window.location.href = `http://127.0.0.1:${port}/callback?token=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`;
        } finally {
            setBusy(false);
        }
    }, [deviceId, port, state, label, platform, hostname]);
    return (
        <main className="mx-auto max-w-3xl px-4 py-10">
            <h1 className="text-2xl font-bold">Connect this device?</h1>
            <p className="mt-2 text-dim">
                {label} ({platform}) will sync with your account.
            </p>
            <button
                onClick={onClickConnect}
                disabled={busy}
                className="mt-4 rounded bg-go px-4 py-2 font-mono text-sm font-bold text-ink disabled:opacity-50"
            >
                Connect
            </button>
            {failed && <p className="mt-2 text-stop">Failed. Try again.</p>}
        </main>
    );
}
