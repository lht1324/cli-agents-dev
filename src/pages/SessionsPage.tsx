import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

interface SessionRow {
    id: string;
    title: string;
    status: string;
    lastSyncAt: string | null;
    updatedAt: string;
    live: boolean;
}

interface SessionsResponse {
    success: boolean;
    status: number;
    error?: string;
    data?: { items: SessionRow[] };
}

export default function SessionsPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ["sessions"],
        queryFn: async (): Promise<SessionRow[]> => {
            const res = await fetch("/api/web/sessions");
            const body = (await res.json()) as SessionsResponse;
            if (!res.ok || !body.success) {
                throw new Error(body.error ?? `sessions ${res.status}`);
            }
            return body.data?.items ?? [];
        },
    });

    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <h1 className="font-mono text-xl font-bold">Sessions</h1>
            {isLoading && <p className="mt-4 font-mono text-xs text-dim">loading…</p>}
            {error && <p className="mt-4 font-mono text-xs text-stop">{error.message}</p>}
            {!isLoading && !error && (data ?? []).length === 0 && (
                <div className="mt-4 rounded border border-line bg-panel p-8">
                    <h2 className="font-mono text-lg font-bold">No sessions yet.</h2>
                    <p className="mt-2 text-sm text-dim">
                        Connect a PC with <span className="font-mono text-fog">npx localagents@latest login</span>. Tabs
                        appear here automatically.
                    </p>
                </div>
            )}
            {(data ?? []).length > 0 && (
                <ul className="mt-4 divide-y divide-line rounded border border-line">
                    {data?.map((row) => (
                        <li key={row.id}>
                            <Link
                                to={`/sessions/${row.id}`}
                                className="flex items-center justify-between px-4 py-3 hover:bg-panel"
                            >
                                <span className="min-w-0 truncate text-sm text-fog">{row.title || row.id}</span>
                                <span className="ml-4 flex shrink-0 items-center gap-2 font-mono text-xs text-dim">
                                    {row.live ? (
                                        <span className="text-go">● live</span>
                                    ) : row.lastSyncAt ? (
                                        <span className="text-dim">frozen</span>
                                    ) : (
                                        <span className="text-warn">not synced</span>
                                    )}
                                    <span>{row.status}</span>
                                    <span>{row.lastSyncAt ? new Date(row.lastSyncAt).toLocaleString() : "-"}</span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
