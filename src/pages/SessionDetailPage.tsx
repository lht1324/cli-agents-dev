import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import MarkdownText from "@/components/MarkdownText";

interface Info {
    id: string;
    title: string;
    status: string;
    deviceId: string;
    agent: string | null;
    model: string | null;
    lastSyncAt: string | null;
    deviceLastSeenAt: string | null;
    parentId: string | null;
    readOnly: boolean;
}

interface SubagentRow {
    id: string;
    title: string;
    synced: boolean;
}

interface Approval {
    id: string;
    deviceId: string;
    action: string;
    resources: string;
    message: string | null;
}

interface Msg {
    id: string;
    seq: number;
    role: string;
    kind: string;
    body: string;
    createdAt: string | null;
}

interface Target {
    deviceId: string;
    label: string;
    lastSeenAt: string | null;
    active: boolean;
}

interface Stats {
    cost: number | null;
    input: number | null;
    output: number | null;
    reasoning: number | null;
    cacheRead: number | null;
    cacheWrite: number | null;
    msgUser: number | null;
    msgAssistant: number | null;
    createdAt: string | null;
}

interface Detail {
    info: Info;
    approvals: Approval[];
    messages: Msg[];
    stats: Stats;
    targets: Target[];
    defaultTarget: string | null;
    catalogJson: string | null;
    subagents: SubagentRow[];
}

interface ThreadPayload {
    messages: Msg[];
    deviceLastSeenAt: string | null;
    lastSyncAt: string | null;
    lastCommand: { type: string; status: string; result: string | null; createdAt: string | null } | null;
}

async function getJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    const body = (await res.json()) as { success: boolean; data?: T; error?: string };
    if (!res.ok || !body.success || !body.data) {
        throw new Error(body.error ?? `${res.status}`);
    }
    return body.data;
}

function stamp(iso: string | null): string | null {
    if (!iso) {
        return null;
    }
    return new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
}

function num(v: number | null): string {
    return v === null ? "-" : v.toLocaleString();
}

export default function SessionDetailPage() {
    const { id = "", childId } = useParams();
    // 경로가 /sessions/:parent/:child면 자식 세션을 읽기 전용으로 연다.
    const sessionId = childId ?? id;
    const readOnly = Boolean(childId);
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState("");
    const [target, setTarget] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const detail = useQuery({
        queryKey: ["session", sessionId],
        queryFn: () => getJson<Detail>(`/api/web/sessions/${encodeURIComponent(sessionId)}`),
        enabled: sessionId.length > 0,
    });

    const thread = useQuery({
        queryKey: ["thread", sessionId],
        queryFn: () => getJson<ThreadPayload>(`/api/web/messages?tabId=${encodeURIComponent(sessionId)}`),
        enabled: sessionId.length > 0,
        refetchInterval: 5000,
        refetchIntervalInBackground: false,
    });

    const messages = thread.data?.messages ?? detail.data?.messages ?? [];
    const effectiveTarget = target ?? detail.data?.defaultTarget ?? null;
    const canWrite = !readOnly && effectiveTarget !== null;
    const lastCommand = thread.data?.lastCommand ?? null;

    useEffect(() => {
        const el = scrollRef.current;
        if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 400) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages.length]);

    const queue = useCallback(
        async (deviceId: string, type: string, payload: unknown) => {
            setBusy(true);
            setNotice(null);
            try {
                const res = await fetch("/api/web/commands", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ deviceId, type, payload: JSON.stringify(payload) }),
                });
                const body = (await res.json()) as { success: boolean; error?: string };
                if (!res.ok || !body.success) {
                    setNotice(`failed: ${body.error ?? res.status}`);
                    return false;
                }
                void queryClient.invalidateQueries({ queryKey: ["thread", sessionId] });
                return true;
            } finally {
                setBusy(false);
            }
        },
        [sessionId, queryClient],
    );

    const onClickSend = useCallback(async () => {
        const text = draft.trim();
        if (text.length === 0 || !effectiveTarget) {
            return;
        }
        const ok = await queue(effectiveTarget, "message", { sessionID: sessionId, text });
        if (ok) {
            setDraft("");
            setNotice("message queued");
        }
    }, [draft, effectiveTarget, sessionId, queue]);

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onClickSend();
            }
        },
        [onClickSend],
    );

    const onClickDecide = useCallback(
        async (row: Approval, decision: "once" | "reject") => {
            const ok = await queue(row.deviceId, "approve", { sessionID: sessionId, requestID: row.id, decision });
            if (ok) {
                setNotice(`${row.id} -> ${decision} queued`);
            }
        },
        [sessionId, queue],
    );

    const stats = detail.data?.stats;
    const statRows = useMemo<[string, string][]>(() => {
        if (!stats) {
            return [];
        }
        return [
            ["Tokens", ""],
            ["Input", num(stats.input)],
            ["Output", num(stats.output)],
            ["Reasoning", num(stats.reasoning)],
            ["Cache read / write", `${num(stats.cacheRead)} / ${num(stats.cacheWrite)}`],
            ["Messages", ""],
            ["User", num(stats.msgUser)],
            ["Assistant", num(stats.msgAssistant)],
            ["Session", ""],
            ["Model", detail.data?.info.model ?? "(none)"],
            ["Created", stats.createdAt ? new Date(stats.createdAt).toLocaleString() : "-"],
            ["Cost", stats.cost === null ? "-" : `$${stats.cost.toFixed(2)}`],
        ];
    }, [stats, detail.data?.info.model]);

    if (detail.isLoading) {
        return <main className="px-6 py-10 font-mono text-xs text-dim">loading…</main>;
    }
    if (detail.error) {
        return <main className="px-6 py-10 font-mono text-xs text-stop">{detail.error.message}</main>;
    }
    const info = detail.data!.info;

    return (
        <main className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-6xl gap-4 px-4 py-4">
            <section className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-baseline justify-between">
                    <div className="flex min-w-0 items-baseline gap-2">
                        {readOnly && (
                            <Link to={`/sessions/${encodeURIComponent(id)}`} className="shrink-0 font-mono text-xs text-dim hover:text-fog">
                                ← parent
                            </Link>
                        )}
                        <h1 className="truncate text-lg font-bold">{info.title}</h1>
                    </div>
                    <span className="ml-3 shrink-0 font-mono text-xs text-dim">{info.status}</span>
                </div>
                {readOnly && (
                    <p className="mt-1 font-mono text-[11px] text-warn">
                        Subagent session · read only. Open the parent to send instructions.
                    </p>
                )}

                <div ref={scrollRef} className="scroll-slim mt-3 min-h-0 flex-1 overflow-y-auto pr-2">
                    {messages.length === 0 && <p className="text-sm text-dim">No synced messages yet.</p>}
                    <ul className="space-y-2">
                        {messages.map((m) => (
                            <li key={`${m.id}-${m.seq}`} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                                <div className="max-w-[85%]">
                                    <div
                                        className={
                                            m.role === "user"
                                                ? "rounded-lg bg-panel px-3 py-2 text-sm whitespace-pre-wrap"
                                                : "rounded-lg border border-line bg-panel px-3 py-2"
                                        }
                                    >
                                        {m.role === "user" ? m.body : <MarkdownText body={m.body} />}
                                    </div>
                                    <p className="mt-1 font-mono text-[10px] text-dim">{stamp(m.createdAt)}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {!readOnly && (
                    <div className="shrink-0 border-t border-line pt-3">
                        {notice && <p className="font-mono text-xs text-go">{notice}</p>}
                        {!canWrite && (
                            <p className="font-mono text-xs text-warn">No active device. Turn the PC on to send instructions.</p>
                        )}
                        {lastCommand && (
                            <p className="font-mono text-xs text-dim">
                                last {lastCommand.type}: {lastCommand.status}
                                {lastCommand.result ? ` · ${lastCommand.result.slice(0, 120)}` : ""}
                            </p>
                        )}
                        <div className="mt-2 rounded border border-line bg-panel p-3">
                            {(detail.data?.targets.length ?? 0) > 0 && (
                                <div className="mb-2 flex items-center gap-2">
                                    <label htmlFor="target" className="font-mono text-xs text-dim">
                                        Send to
                                    </label>
                                    <select
                                        id="target"
                                        value={effectiveTarget ?? ""}
                                        onChange={(e) => setTarget(e.target.value)}
                                        disabled={busy}
                                        className="rounded border border-line bg-ink p-1 font-mono text-xs"
                                    >
                                        {detail.data?.targets.map((t) => (
                                            <option key={t.deviceId} value={t.deviceId}>
                                                {t.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={onKeyDown}
                                rows={2}
                                disabled={!canWrite || busy}
                                placeholder={canWrite ? "Type a message... (Enter to send)" : "No active device"}
                                className="w-full resize-none bg-transparent font-mono text-sm outline-none placeholder:text-dim disabled:opacity-50"
                            />
                            <div className="mt-1 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => void onClickSend()}
                                    disabled={!canWrite || busy || draft.trim().length === 0}
                                    className="rounded-full bg-go px-3 py-1 font-mono text-sm font-bold text-ink disabled:opacity-50"
                                    aria-label="Send message"
                                >
                                    ↑
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <aside className="scroll-slim hidden w-72 shrink-0 space-y-3 overflow-y-auto lg:block">
                {!readOnly && (detail.data?.subagents.length ?? 0) > 0 && (
                    <details open>
                        <summary className="cursor-pointer font-mono text-sm font-bold text-dim">
                            Subagents ({detail.data?.subagents.length})
                        </summary>
                        <ul className="mt-2 space-y-1">
                            {detail.data?.subagents.map((agent) => (
                                <li key={agent.id}>
                                    <Link
                                        to={`/sessions/${encodeURIComponent(id)}/${encodeURIComponent(agent.id)}`}
                                        className="flex items-baseline justify-between gap-2 rounded border border-line bg-panel px-2 py-1 hover:border-fog"
                                    >
                                        <span className="truncate text-xs text-fog">{agent.title}</span>
                                        <span className="shrink-0 font-mono text-[10px] text-dim">
                                            {agent.synced ? "read →" : "not synced"}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </details>
                )}
                {!readOnly && (
                    <details open>
                        <summary className="cursor-pointer font-mono text-sm font-bold text-dim">
                            Pending approvals{(detail.data?.approvals.length ?? 0) > 0 ? ` (${detail.data?.approvals.length})` : ""}
                        </summary>
                        {(detail.data?.approvals.length ?? 0) === 0 ? (
                            <p className="mt-2 text-sm text-dim">No pending requests.</p>
                        ) : (
                            <ul className="mt-2 space-y-2">
                                {detail.data?.approvals.map((row) => (
                                    <li key={row.id} className="rounded border border-line bg-panel p-2">
                                        <p className="font-mono text-xs text-warn">{row.action}</p>
                                        <p className="mt-1 break-all font-mono text-[11px] text-dim">{row.resources}</p>
                                        {row.message && <p className="mt-1 text-xs text-dim">{row.message.slice(0, 200)}</p>}
                                        <div className="mt-2 flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void onClickDecide(row, "once")}
                                                disabled={busy}
                                                className="rounded bg-go px-2 py-0.5 font-mono text-xs font-bold text-ink disabled:opacity-50"
                                            >
                                                Allow
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void onClickDecide(row, "reject")}
                                                disabled={busy}
                                                className="rounded border border-line px-2 py-0.5 font-mono text-xs text-fog disabled:opacity-50"
                                            >
                                                Deny
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </details>
                )}

                <details open>
                    <summary className="cursor-pointer font-mono text-sm font-bold text-dim">Session stats</summary>
                    <dl className="mt-2 space-y-1 font-mono text-xs">
                        {statRows.map(([label, value]) =>
                            value === "" ? (
                                <dt key={label} className="pt-2 text-dim">
                                    {label}
                                </dt>
                            ) : (
                                <div key={label} className="flex justify-between gap-2">
                                    <dt className="text-dim">{label}</dt>
                                    <dd className="truncate text-fog">{value}</dd>
                                </div>
                            ),
                        )}
                    </dl>
                </details>
            </aside>
        </main>
    );
}
