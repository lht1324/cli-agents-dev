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
    if (minutes < 60) {
        return `synced ${minutes} min ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `synced ${hours}h ago`;
    }
    return `synced ${Math.floor(hours / 24)}d ago`;
}

function statusColor(status: string): string {
    if (status === "active") {
        return "text-go";
    }
    return "text-dim";
}

export default function SessionsPageClient({ items }: { items: SessionRow[] }) {
    const rows = useMemo(() => items, [items]);
    return (
        <main className="mx-auto max-w-3xl px-4 py-10">
            <h1 className="font-mono text-xl font-bold">Sessions</h1>
            {rows.length === 0 && <p className="mt-4 text-dim">No sessions yet.</p>}
            <ul className="mt-4 space-y-2">
                {rows.map((row) => (
                    <li key={row.id} className="rounded border border-line bg-panel p-4">
                        <a href={`/sessions/${row.id}`} className="font-bold hover:underline">
                            {row.title}
                        </a>
                        <p className="mt-1 font-mono text-xs">
                            <span className={statusColor(row.status)}>{row.status}</span>
                            <span className="text-dim"> · {relativeTime(row.lastSyncAt)}</span>
                        </p>
                    </li>
                ))}
            </ul>
        </main>
    );
}
