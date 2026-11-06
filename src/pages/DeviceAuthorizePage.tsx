import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { pairingClientAPI, type PairingInfo } from "@/lib/api/client/pairingClientAPI";

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

export default function DeviceAuthorizePage() {
    const navigate = useNavigate();
    const [info, setInfo] = useState<PairingInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const data = params.get("data");
        if (data) {
            void (async () => {
                const pairing = await pairingClientAPI.inspectPairing(data);
                if (!pairing) {
                    setError("invalid link");
                    return;
                }
                setInfo(pairing);
            })();
            return;
        }
        setInfo({
            device: params.get("device") ?? "",
            port: params.get("port") ?? "",
            state: params.get("state") ?? "",
            label: params.get("label") ?? "",
            platform: params.get("platform") ?? "",
            hostname: params.get("hostname") ?? "",
        });
    }, []);

    const onClickConnect = useCallback(async () => {
        if (!info) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const authorized = await pairingClientAPI.authorizeDevice({
                deviceId: info.device,
                label: info.label,
                platform: info.platform,
                hostname: info.hostname,
            });
            if (!authorized) {
                setError("Could not connect. Make sure you are signed in, then try again.");
                return;
            }
            window.location.href = `http://127.0.0.1:${info.port}/callback?token=${encodeURIComponent(authorized.token)}&state=${encodeURIComponent(info.state)}`;
        } finally {
            setBusy(false);
        }
    }, [info]);

    return (
        <main className="mx-auto max-w-3xl px-4 py-10">
            <p className="font-mono text-sm text-go">$ localagents login</p>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Connect this device?</h1>
            <p className="mt-2 max-w-[60ch] text-sm text-dim">
                The device below will sync its OpenCode tabs with your account.
            </p>

            {info && (
                <dl className="mt-6 rounded border border-line bg-panel p-4 text-sm">
                    <Row label="Name" value={info.label || info.hostname || info.device} />
                    <Row label="Platform" value={platformLabel(info.platform)} />
                    <Row label="Hostname" value={info.hostname || "-"} />
                </dl>
            )}

            <div className="mt-6 flex gap-3">
                <button
                    type="button"
                    onClick={() => void onClickConnect()}
                    disabled={busy || !info}
                    className="rounded bg-go px-4 py-2 font-mono text-sm font-bold text-ink transition-opacity hover:opacity-85 disabled:opacity-50"
                >
                    {busy ? "Connecting..." : "Connect"}
                </button>
                <button
                    type="button"
                    onClick={() => navigate("/sessions")}
                    className="rounded border border-line px-4 py-2 font-mono text-sm text-fog transition-colors hover:bg-black"
                >
                    Cancel
                </button>
            </div>
            {error && <p className="mt-3 font-mono text-sm text-stop">{error}</p>}
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
