import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

interface SessionRow {
    id: string;
    title: string;
    status: string;
    lastSyncAt: string | null;
    lastBodySyncAt: string | null;
    updatedAt: string;
    live: boolean;
}

interface Waiting {
    newTabs: number;
    updatedTabs: number;
}

interface SessionsResponse {
    success: boolean;
    status: number;
    error?: string;
    data?: { items: SessionRow[]; waiting: Waiting | null };
}

// 절대 시각은 모든 행이 같아 의미가 없다. 마지막으로 본문이 올라온 시점을 상대 표기로 보여준다.
function relativeTime(iso: string | null): string | null {
    if (!iso) {
        return null;
    }
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) {
        return "just now";
    }
    if (minutes < 60) {
        return `${minutes} min ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    return `${Math.floor(hours / 24)}d ago`;
}

function waitingMessage(waiting: Waiting): string {
    if (waiting.newTabs > 0 && waiting.updatedTabs === 0) {
        return `${waiting.newTabs} new ${waiting.newTabs === 1 ? "session" : "sessions"} from your other PC.`;
    }
    if (waiting.newTabs === 0 && waiting.updatedTabs > 0) {
        return `${waiting.updatedTabs} ${waiting.updatedTabs === 1 ? "session has" : "sessions have"} newer versions from your other PC.`;
    }
    return `Updates waiting from your other PC: ${waiting.newTabs} new, ${waiting.updatedTabs} newer versions.`;
}

export default function SessionsPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ["sessions"],
        queryFn: async (): Promise<{ items: SessionRow[]; waiting: Waiting | null }> => {
            const res = await fetch("/api/web/sessions");
            const body = (await res.json()) as SessionsResponse;
            if (!res.ok || !body.success) {
                throw new Error(body.error ?? `sessions ${res.status}`);
            }
            return { items: body.data?.items ?? [], waiting: body.data?.waiting ?? null };
        },
    });

    const items = data?.items ?? [];
    const waiting = data?.waiting ?? null;

    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <h1 className="font-mono text-xl font-bold">Sessions</h1>

            {waiting && (
                <div className="mt-4 rounded border border-line bg-panel p-4">
                    <p className="text-sm">{waitingMessage(waiting)}</p>
                    <div className="mt-3 inline-flex items-center gap-3 rounded border border-line bg-black px-3 py-1.5">
                        <span className="font-mono text-xs">
                            <span className="text-go">$ </span>
                            <span className="text-fog">localagents pull</span>
                        </span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-dim">Run this on the PC you want the sessions on.</p>
                </div>
            )}

            {isLoading && <p className="mt-4 font-mono text-xs text-dim">loading…</p>}
            {error && <p className="mt-4 font-mono text-xs text-stop">{error.message}</p>}

            {!isLoading && !error && items.length === 0 && (
                <div className="mt-4 rounded border border-line bg-panel p-8">
                    <h2 className="font-mono text-lg font-bold">No sessions yet.</h2>
                    <p className="mt-2 text-sm text-dim">
                        Connect a PC with <span className="font-mono text-fog">npx localagents@latest login</span>. Tabs
                        appear here automatically.
                    </p>
                </div>
            )}

            {items.length > 0 && (
                <ul className="mt-4 divide-y divide-line rounded border border-line">
                    {items.map((row) => {
                        const synced = relativeTime(row.lastBodySyncAt);
                        return (
                            <li key={row.id}>
                                <Link
                                    to={`/sessions/${row.id}`}
                                    className="flex items-center justify-between px-4 py-3 hover:bg-panel"
                                >
                                    <span className="min-w-0 truncate text-sm text-fog">{row.title || row.id}</span>
                                    <span className="ml-4 flex shrink-0 items-center gap-2 font-mono text-xs text-dim">
                                        {row.live ? (
                                            <span className="text-go">● live</span>
                                        ) : row.lastBodySyncAt ? (
                                            <span className="text-dim">frozen</span>
                                        ) : (
                                            <span className="text-warn">not synced</span>
                                        )}
                                        <span>
                                            {synced ? `synced ${synced}` : "no messages"}
                                        </span>
                                        <span className="hidden sm:inline">{row.status}</span>
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </main>
    );
}
