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

function presenceOf(lastSeenAt: string | null): { state: Presence; label: string } {
    if (!lastSeenAt) {
        return { state: "offline", label: "never seen" };
    }
    const minutes = (Date.now() - new Date(lastSeenAt).getTime()) / 60000;
    if (minutes < 2) {
        return { state: "online", label: "online" };
    }
    if (minutes < 10) {
        return { state: "stale", label: `last seen ${Math.floor(minutes)} min ago` };
    }
    return { state: "offline", label: `last seen ${Math.floor(minutes)} min ago` };
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
    if (rows.length === 0) {
        return (
            <main>
                <h1>Devices</h1>
                <p>No devices yet. Run `cliagent register` on your PC.</p>
            </main>
        );
    }
    return (
        <main>
            <h1>Devices</h1>
            <ul>
                {rows.map((row) => (
                    <li key={row.id}>
                        <span>{row.label}</span>
                        <span>
                            {[row.platform, row.hostname].filter(Boolean).join(" · ")}
                        </span>
                        <span>{row.presence.label}</span>
                    </li>
                ))}
            </ul>
        </main>
    );
}
