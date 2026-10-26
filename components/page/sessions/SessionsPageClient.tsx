"use client";

import { useMemo } from "react";
import SessionsEmptyState from "./SessionsEmptyState";

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

export default function SessionsPageClient({
    items,
    waiting,
}: {
    items: SessionRow[];
    waiting: { newTabs: number; updatedTabs: number } | null;
}) {
    const rows = useMemo(() => items, [items]);
    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <h1 className="font-mono text-xl font-bold">Sessions</h1>
            {waiting && (
                <div className="mt-4 rounded border border-line bg-panel p-4">
                    <p className="text-sm">
                        {waiting.newTabs > 0 && waiting.updatedTabs === 0
                            ? `${waiting.newTabs} new ${waiting.newTabs === 1 ? "session" : "sessions"} from your other PC.`
                            : waiting.newTabs === 0 && waiting.updatedTabs > 0
                              ? `${waiting.updatedTabs} ${waiting.updatedTabs === 1 ? "session has" : "sessions have"} newer versions from your other PC.`
                              : `Updates waiting from your other PC: ${waiting.newTabs} new, ${waiting.updatedTabs} newer versions.`}
                    </p>
                    <div className="mt-3 inline-flex items-center gap-3 rounded border border-line bg-black px-3 py-1.5">
                        <span className="font-mono text-xs">
                            <span className="text-go">$ </span>
                            <span className="text-fog">localagents pull</span>
                        </span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-dim">Run this on the PC you want the sessions on.</p>
                </div>
            )}
            {rows.length === 0 && (
                <div className="mt-4">
                    <SessionsEmptyState />
                </div>
            )}
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
