"use client";

import { useCallback, useState } from "react";
import { deviceClientAPI } from "@/lib/api/client/deviceClientAPI";

function platformLabel(platform: string): string {
    if (platform === "darwin") {
        return "macOS";
    }
    if (platform === "linux") {
        return "Linux";
    }
    if (platform === "win32") {
        return "Windows";
    }
    return platform || "-";
}

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
            const result = await deviceClientAPI.authorize({ deviceId, label, platform, hostname });
            if (!result.ok) {
                setFailed(true);
                return;
            }
            window.location.href = `http://127.0.0.1:${port}/callback?token=${encodeURIComponent(result.data.token)}&state=${encodeURIComponent(state)}`;
        } finally {
            setBusy(false);
        }
    }, [deviceId, port, state, label, platform, hostname]);

    return (
        <main className="mx-auto max-w-3xl px-4 py-10">
            <p className="font-mono text-sm text-go">$ localagents login</p>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Connect this device?</h1>
            <p className="mt-2 max-w-[60ch] text-sm text-dim">
                The device below will sync its OpenCode tabs with your account.
            </p>

            <dl className="mt-6 rounded border border-line bg-panel p-4 text-sm">
                <Row label="Name" value={label || hostname || deviceId} />
                <Row label="Platform" value={platformLabel(platform)} />
                <Row label="Hostname" value={hostname || "-"} />
            </dl>

            <div className="mt-6 flex gap-3">
                <button
                    type="button"
                    onClick={onClickConnect}
                    disabled={busy}
                    className="rounded bg-go px-4 py-2 font-mono text-sm font-bold text-ink transition-opacity hover:opacity-85 disabled:opacity-50"
                >
                    {busy ? "Connecting..." : "Connect"}
                </button>
                <a
                    href="/sessions"
                    className="rounded border border-line px-4 py-2 font-mono text-sm text-fog transition-colors hover:bg-black"
                >
                    Cancel
                </a>
            </div>
            {failed && <p className="mt-3 font-mono text-sm text-stop">Failed. Try again.</p>}
        </main>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between border-b border-line py-2 last:border-b-0">
            <dt className="text-dim">{label}</dt>
            <dd className="truncate font-mono text-xs">{value}</dd>
        </div>
    );
}
