"use client";

import { useMemo } from "react";

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
    const rows = useMemo(
        () =>
            items.map((item) => ({
                ...item,
                presence: presenceOf(item.lastSeenAt),
            })),
        [items],
    );
    return (
        <main className="mx-auto max-w-3xl px-4 py-10">
            <h1 className="font-mono text-xl font-bold">Devices</h1>
            {rows.length === 0 && (
                <p className="mt-4 text-dim">No devices yet. Run `cliagent register` on your PC.</p>
            )}
            <ul className="mt-4 space-y-2">
                {rows.map((row) => (
                    <li key={row.id} className="rounded border border-line bg-panel p-4">
                        <p className="font-bold">{row.label}</p>
                        <p className="mt-1 font-mono text-xs">
                            <span className={presenceColor(row.presence.state)}>{row.presence.label}</span>
                        </p>
                    </li>
                ))}
            </ul>
        </main>
    );
}
