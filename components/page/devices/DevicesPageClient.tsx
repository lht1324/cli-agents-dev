"use client";

import { useCallback, useMemo, useState } from "react";
import { Unlink } from "lucide-react";
import { devicesClientAPI } from "@/lib/api/client/devicesClientAPI";

export interface DeviceRow {
    id: string;
    label: string;
    platform: string | null;
    hostname: string | null;
    lastSeenAt: string | null;
}

type Presence = "online" | "stale" | "offline";

function relativeSeen(lastSeenAt: string | null): string {
    if (!lastSeenAt) {
        return "never seen";
    }
    const minutes = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 60000);
    if (minutes < 2) {
        return "online";
    }
    if (minutes < 60) {
        return `last seen ${minutes} min ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `last seen ${hours}h ago`;
    }
    return `last seen ${Math.floor(hours / 24)}d ago`;
}

function presenceOf(lastSeenAt: string | null): { state: Presence; label: string } {
    if (!lastSeenAt) {
        return { state: "offline", label: "never seen" };
    }
    const minutes = (Date.now() - new Date(lastSeenAt).getTime()) / 60000;
    if (minutes < 2) {
        return { state: "online", label: "online" };
    }
    if (minutes < 10) {
        return { state: "stale", label: relativeSeen(lastSeenAt) };
    }
    return { state: "offline", label: relativeSeen(lastSeenAt) };
}

function presenceColor(state: Presence): string {
    if (state === "online") {
        return "text-go";
    }
    if (state === "stale") {
        return "text-warn";
    }
    return "text-dim";
}

export default function DevicesPageClient({ items }: { items: DeviceRow[] }) {
    const [unlinkTarget, setUnlinkTarget] = useState<DeviceRow | null>(null);
    const [isUnlinking, setIsUnlinking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const rows = useMemo(
        () =>
            items.map((item) => ({
                ...item,
                presence: presenceOf(item.lastSeenAt),
            })),
        [items],
    );

    const onClickUnlink = useCallback((row: DeviceRow) => {
        setError(null);
        setUnlinkTarget(row);
    }, []);

    const onClickCloseModal = useCallback(() => {
        if (!isUnlinking) {
            setUnlinkTarget(null);
        }
    }, [isUnlinking]);

    const onConfirmUnlink = useCallback(async () => {
        if (!unlinkTarget) {
            return;
        }
        setIsUnlinking(true);
        try {
            const result = await devicesClientAPI.unlink(unlinkTarget.id);
            if (result.ok) {
                setUnlinkTarget(null);
                window.location.reload();
                return;
            }
            setError(result.error ?? "Failed to unlink device.");
        } finally {
            setIsUnlinking(false);
        }
    }, [unlinkTarget]);

    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <h1 className="font-mono text-xl font-bold">Devices</h1>
            {rows.length === 0 && (
                <p className="mt-4 text-dim">No devices yet. Run `localagents login` on your PC.</p>
            )}
            <ul className="mt-4 space-y-2">
                {rows.map((row) => (
                    <li key={row.id} className="flex items-center justify-between rounded border border-line bg-panel p-4">
                        <div>
                            <p className="font-bold">{row.label}</p>
                            <p className="mt-1 font-mono text-xs">
                                <span className={presenceColor(row.presence.state)}>{row.presence.label}</span>
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onClickUnlink(row)}
                            className="flex items-center gap-1.5 rounded border border-line px-3 py-1.5 font-mono text-xs text-dim transition-colors hover:bg-black disabled:opacity-50"
                        >
                            <Unlink size={13} />
                            Unlink
                        </button>
                    </li>
                ))}
            </ul>
            {error ? <p className="mt-3 font-mono text-xs text-warn">{error}</p> : null}

            {unlinkTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="mx-4 rounded border border-line bg-panel p-6">
                        <h3 className="font-mono text-sm font-bold">Unlink device</h3>
                        <p className="mt-2 max-w-sm text-sm text-dim">
                            <span className="font-bold">{unlinkTarget.label}</span> will stop syncing. The daemon on that PC
                            signs out and can reconnect anytime with `localagents login`.
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
                                onClick={onConfirmUnlink}
                                disabled={isUnlinking}
                                className="rounded bg-warn px-4 py-2 text-sm font-bold text-ink transition-opacity hover:opacity-85 disabled:opacity-50"
                            >
                                {isUnlinking ? "Unlinking..." : "Yes, unlink"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
