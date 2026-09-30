"use client";

import { useMemo } from "react";

export interface SessionRow {
    id: string;
    title: string;
    status: string;
    lastSyncAt: string | null;
    updatedAt: string;
}

function relativeTime(iso: string | null): string {
    if (!iso) {
        return "never synced";
    }
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) {
        return "synced just now";
    }
    return `synced ${minutes} min ago`;
}

export default function SessionsPageClient({ items }: { items: SessionRow[] }) {
    const rows = useMemo(() => items, [items]);
    if (rows.length === 0) {
        return (
            <main>
                <h1>Sessions</h1>
                <p>No sessions yet.</p>
            </main>
        );
    }
    return (
        <main>
            <h1>Sessions</h1>
            <ul>
                {rows.map((row) => (
                    <li key={row.id}>
                        <span>{row.title}</span>
                        <span>{row.status}</span>
                        <span>{relativeTime(row.lastSyncAt)}</span>
                    </li>
                ))}
            </ul>
        </main>
    );
}
