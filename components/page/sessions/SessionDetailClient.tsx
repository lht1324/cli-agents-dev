"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveThread } from "@/lib/neon/live";
import { editCounts, parseToolCall, toolDetail, toolSummary } from "./toolFormat";
import MarkdownText from "./MarkdownText";

export interface SessionInfo {
    id: string;
    title: string;
    status: string;
    deviceId: string;
    agent: string | null;
    model: string | null;
    lastSyncAt: string | null;
    deviceLastSeenAt: string | null;
}

export interface ApprovalRow {
    id: string;
    action: string;
    resources: string;
    message: string | null;
}

function formatStamp(iso: string | null): string | null {
    if (!iso) {
        return null;
    }
    const at = new Date(iso);
    const now = new Date();
    const time = at.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
    const sameDay = at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
    if (sameDay) {
        return time;
    }
    const date = `${at.getMonth() + 1}월 ${at.getDate()}일`;
    if (at.getFullYear() === now.getFullYear()) {
        return `${date} ${time}`;
    }
    return `${at.getFullYear()}년 ${date} ${time}`;
}

export interface ThreadRow {
    id: string;
    seq: number;
    role: string;
    kind: string;
    body: string;
    createdAt: string | null;
}

export interface SessionStats {
    session: string;
    provider: string;
    contextLimit: number | null;
    usagePct: number | null;
    outputTokens: number | null;
    cacheRead: number | null;
    cacheWrite: number | null;
    assistantMessages: number | null;
    createdAt: string | null;
    messages: number | null;
    model: string;
    totalTokens: number | null;
    inputTokens: number | null;
    reasoningTokens: number | null;
    userMessages: number | null;
    cost: number | null;
    updatedAt: string | null;
}

function SessionStatsView({ stats }: { stats: SessionStats }) {
    const num = (v: number | null) => (v === null ? "-" : v.toLocaleString("en-US"));
    const pct = stats.usagePct ?? 0;
    const groups: { title: string; rows: [string, string][] }[] = [
        {
            title: "Tokens",
            rows: [
                ["Input", num(stats.inputTokens)],
                ["Output", num(stats.outputTokens)],
                ["Reasoning", num(stats.reasoningTokens)],
                ["Cache read / write", `${num(stats.cacheRead)} / ${num(stats.cacheWrite)}`],
            ],
        },
        {
            title: "Messages",
            rows: [
                ["Total", num(stats.messages)],
                ["User", num(stats.userMessages)],
                ["Assistant", num(stats.assistantMessages)],
            ],
        },
        {
            title: "Session",
            rows: [
                ["Provider", stats.provider],
                ["Model", stats.model],
                ["Created", formatStamp(stats.createdAt) ?? "-"],
                ["Last active", formatStamp(stats.updatedAt) ?? "-"],
            ],
        },
    ];
    return (
        <div>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <p className="text-lg font-bold text-fog">
                    {stats.usagePct === null ? "-" : `${stats.usagePct}%`}
                    <span className="ml-2 font-mono text-xs font-normal text-dim">
                        {num(stats.totalTokens)} / {num(stats.contextLimit)} tokens · US$
                        {stats.cost === null ? "-" : stats.cost.toFixed(2)}
                    </span>
                </p>
            </div>
            <div
                className="mt-1 h-1.5 w-full overflow-hidden rounded bg-panel"
                role="progressbar"
                aria-valuenow={stats.usagePct ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div className="h-full rounded bg-go" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
                {groups.map((g) => (
                    <div key={g.title} className="rounded border border-line bg-ink px-3 py-2">
                        <p className="font-mono text-xs font-bold text-dim">{g.title}</p>
                        <dl className="mt-1 space-y-1">
                            {g.rows.map(([label, value]) => (
                                <div key={label} className="flex items-baseline justify-between gap-2">
                                    <dt className="shrink-0 font-mono text-xs text-dim">{label}</dt>
                                    <dd className="break-words text-right font-mono text-xs text-fog">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                ))}
            </div>
        </div>
    );
}

export interface CatalogModel {
    id: string;
    providerID: string;
    name?: string;
    variants?: { id: string }[];
    limit?: { context?: number };
}

function parseCatalog(json: string | null): { models: CatalogModel[]; agents: CatalogAgent[]; providers: CatalogProvider[] } {
    if (!json) {
        return { models: [], agents: [], providers: [] };
    }
    try {
        const parsed = JSON.parse(json) as {
            models?: { data?: CatalogModel[] } | CatalogModel[];
            agents?: { data?: CatalogAgent[] } | CatalogAgent[];
            providers?: { data?: CatalogProvider[] } | CatalogProvider[];
        };
        const models = Array.isArray(parsed.models) ? parsed.models : (parsed.models?.data ?? []);
        const agents = (Array.isArray(parsed.agents) ? parsed.agents : (parsed.agents?.data ?? [])).filter(
            (a) => a.mode === "primary" && a.hidden !== true,
        );
        const providers = Array.isArray(parsed.providers) ? parsed.providers : (parsed.providers?.data ?? []);
        return { models, agents, providers };
    } catch {
        return { models: [], agents: [], providers: [] };
    }
}

interface CatalogAgent {
    id?: string;
    name?: string;
    mode?: string;
    hidden?: boolean;
}

interface CatalogProvider {
    id?: string;
    name?: string;
}

function parseCurrentModel(json: string | null): { id: string; providerID: string; variant?: string } | null {
    if (!json) {
        return null;
    }
    try {
        const parsed = JSON.parse(json) as { id?: unknown; providerID?: unknown; variant?: unknown };
        if (typeof parsed.id !== "string" || typeof parsed.providerID !== "string") {
            return null;
        }
        return {
            id: parsed.id,
            providerID: parsed.providerID,
            variant: typeof parsed.variant === "string" ? parsed.variant : undefined,
        };
    } catch {
        return null;
    }
}

async function onDecide(
    userId: string,
    deviceId: string,
    sessionID: string,
    requestID: string,
    decision: "once" | "reject",
    setBusy: (v: string | null) => void,
    setDone: (v: string | null) => void,
): Promise<void> {
    setBusy(requestID);
    setDone(null);
    try {
        const res = await fetch("/api/commands", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId,
                deviceId,
                type: "approve",
                payload: JSON.stringify({ sessionID, requestID, decision }),
            }),
        });
        if (!res.ok) {
            setDone("failed to queue");
            return;
        }
        setDone(`${requestID} -> ${decision} queued. runs when the PC syncs.`);
    } finally {
        setBusy(null);
    }
}

export interface StatsInput {
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

export default function SessionDetailClient({
    info,
    approvals,
    messages,
    userId,
    catalogJson,
    stats,
}: {
    info: SessionInfo;
    approvals: ApprovalRow[];
    messages: ThreadRow[];
    userId: string;
    catalogJson: string | null;
    stats: StatsInput;
}) {
    const [busy, setBusy] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [showJump, setShowJump] = useState(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const scrollToEnd = useCallback((smooth = true) => {
        const el = scrollRef.current;
        if (!el) {
            return;
        }
        el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    }, []);
    const onScrollPage = useCallback(() => {
        const el = scrollRef.current;
        if (!el) {
            return;
        }
        setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 400);
    }, []);
    useEffect(() => {
        const el = scrollRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
            el.addEventListener("scroll", onScrollPage, { passive: true });
        }
        return () => el?.removeEventListener("scroll", onScrollPage);
    }, [onScrollPage]);
    const { thread, deviceLastSeenAt, lastSyncAt } = useLiveThread(info.id, messages, info.deviceLastSeenAt, info.lastSyncAt);
    // 새 메시지 추적. 바닥 근처에 있을 때만 따라간다.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) {
            return;
        }
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) {
            el.scrollTop = el.scrollHeight;
        }
    }, [thread]);
    const rows = useMemo(() => approvals, [approvals]);
    const catalog = useMemo(() => parseCatalog(catalogJson), [catalogJson]);
    const currentModel = useMemo(() => parseCurrentModel(info.model), [info.model]);
    const liveStats: SessionStats = useMemo(() => {
        const entry = currentModel
            ? catalog.models.find((m) => m.providerID === currentModel.providerID && m.id === currentModel.id)
            : undefined;
        const limit = entry?.limit?.context ?? null;
        const provider =
            catalog.providers.find((p) => p.id === currentModel?.providerID)?.name ?? currentModel?.providerID ?? "?";
        const parts = [stats.input, stats.output, stats.reasoning, stats.cacheRead, stats.cacheWrite];
        const total = parts.every((p) => p === null) ? null : parts.reduce((a, b) => (a ?? 0) + (b ?? 0), 0);
        return {
            session: info.title,
            provider,
            contextLimit: limit,
            usagePct: total !== null && limit ? Math.round((total / limit) * 100) : null,
            outputTokens: stats.output,
            cacheRead: stats.cacheRead,
            cacheWrite: stats.cacheWrite,
            assistantMessages: stats.msgAssistant,
            createdAt: stats.createdAt,
            messages:
                stats.msgUser !== null || stats.msgAssistant !== null
                    ? (stats.msgUser ?? 0) + (stats.msgAssistant ?? 0)
                    : null,
            model: entry?.name ?? currentModel?.id ?? "?",
            totalTokens: total,
            inputTokens: stats.input,
            reasoningTokens: stats.reasoning,
            userMessages: stats.msgUser,
            cost: stats.cost,
            updatedAt: lastSyncAt,
        };
    }, [catalog, currentModel, info, lastSyncAt, stats]);
    const [agent, setAgent] = useState(info.agent ?? "");
    const [modelId, setModelId] = useState(
        currentModel ? `${currentModel.providerID}/${currentModel.id}` : "",
    );
    const [variant, setVariant] = useState(currentModel?.variant ?? "");
    const providers = useMemo(() => {
        const groups = new Map<string, CatalogModel[]>();
        const sorted = [...catalog.models].sort(
            (a, b) => a.providerID.localeCompare(b.providerID) || (a.name ?? a.id).localeCompare(b.name ?? b.id),
        );
        for (const m of sorted) {
            const list = groups.get(m.providerID) ?? [];
            list.push(m);
            groups.set(m.providerID, list);
        }
        return [...groups.entries()];
    }, [catalog]);
    const variants = useMemo(() => {
        const [providerID, id] = modelId.split("/");
        const found = catalog.models.find((m) => m.providerID === providerID && m.id === id);
        return found?.variants ?? [];
    }, [catalog, modelId]);
    const queueAgent = useCallback(
        async (value: string) => {
            if (value.length === 0) {
                return;
            }
            setBusy("agent");
            setDone(null);
            try {
                const res = await fetch("/api/commands", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId,
                        deviceId: info.deviceId,
                        type: "set-agent",
                        payload: JSON.stringify({ sessionID: info.id, agent: value }),
                    }),
                });
                setDone(res.ok ? `agent -> ${value} queued.` : "failed to queue");
            } finally {
                setBusy(null);
            }
        },
        [info, userId],
    );
    const queueModel = useCallback(
        async (modelValue: string, variantValue: string) => {
            const [providerID, id] = modelValue.split("/");
            if (!providerID || !id) {
                return;
            }
            setBusy("model");
            setDone(null);
            try {
                const res = await fetch("/api/commands", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId,
                        deviceId: info.deviceId,
                        type: "set-model",
                        payload: JSON.stringify({
                            sessionID: info.id,
                            model: { id, providerID, variant: variantValue || undefined },
                        }),
                    }),
                });
                setDone(
                    res.ok ? `model -> ${modelValue}${variantValue ? `#${variantValue}` : ""} queued.` : "failed to queue",
                );
            } finally {
                setBusy(null);
            }
        },
        [info, userId],
    );
    const onSelectAgent = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            setAgent(e.target.value);
            void queueAgent(e.target.value);
        },
        [queueAgent],
    );
    const onSelectModel = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            setModelId(e.target.value);
            setVariant("");
            void queueModel(e.target.value, "");
        },
        [queueModel],
    );
    const onSelectVariant = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            setVariant(e.target.value);
            void queueModel(modelId, e.target.value);
        },
        [modelId, queueModel],
    );
    const stampOf = useCallback((iso: string | null) => formatStamp(iso), []);
    const offlineNote = useMemo(() => {
        if (!deviceLastSeenAt) {
            return "Runs when the PC is back online.";
        }
        const minutes = (Date.now() - new Date(deviceLastSeenAt).getTime()) / 60000;
        return minutes >= 2 ? "Runs when the PC is back online." : null;
    }, [deviceLastSeenAt]);
    const onClickDecide = useCallback(
        (requestID: string, decision: "once" | "reject") =>
            onDecide(userId, info.deviceId, info.id, requestID, decision, setBusy, setDone),
        [info, userId],
    );
    const onClickSend = useCallback(async () => {
        const text = draft.trim();
        if (text.length === 0) {
            return;
        }
        setBusy("send");
        setDone(null);
        try {
            const res = await fetch("/api/commands", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    deviceId: info.deviceId,
                    type: "message",
                    payload: JSON.stringify({ sessionID: info.id, text }),
                }),
            });
            if (!res.ok) {
                setDone("failed to queue");
                return;
            }
            setDraft("");
            setDone("message queued. runs when the PC syncs.");
        } finally {
            setBusy(null);
        }
    }, [draft, info, userId]);
    const onChangeDraft = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setDraft(e.target.value);
    }, []);
    const onKeyDownDraft = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onClickSend();
            }
        },
        [onClickSend],
    );
    return (
        <main className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden px-12 py-4">
            <div className="flex min-h-0 w-full flex-1 flex-col gap-3 lg:flex-row">
            <div className="order-2 flex min-h-0 min-w-0 flex-1 flex-col lg:order-1 lg:flex-[7]">
            <div ref={scrollRef} className="scroll-slim min-h-0 flex-1 overflow-y-auto overflow-x-clip pr-3">
            {thread.length === 0 && <p className="mt-2 text-dim">No synced messages yet.</p>}
            <ul className="mt-2 space-y-2 pb-2">
                {thread.map((m) => {
                    const stamp = stampOf(m.createdAt);
                    if (m.role === "user") {
                        return (
                            <li key={m.id} className="flex justify-end">
                                <div className="max-w-[85%] lg:max-w-3xl">
                                    <p className="whitespace-pre-wrap rounded-lg bg-panel px-3 py-2 text-sm">
                                        {m.body}
                                    </p>
                                    {stamp && (
                                        <p className="mt-1 text-right font-mono text-xs text-dim">{stamp}</p>
                                    )}
                                </div>
                            </li>
                        );
                    }
                    if (m.kind === "tool") {
                        const call = parseToolCall(m.body);
                        if (!call) {
                            return (
                                <li key={m.id} className="max-w-3xl">
                                    <p className="whitespace-pre-wrap font-mono text-xs text-dim">{m.body}</p>
                                    {stamp && (
                                        <p className="mt-1 font-mono text-xs text-dim">{stamp}</p>
                                    )}
                                </li>
                            );
                        }
                        const detail = toolDetail(call);
                        const counts = editCounts(call);
                        return (
                            <li key={m.id} className="max-w-3xl">
                                <details className="rounded border border-line bg-ink px-3 py-2">
                                    <summary className="cursor-pointer break-words font-mono text-xs text-dim">
                                        ▸ {toolSummary(call)}
                                        {counts && (
                                            <>
                                                {" "}
                                                <span className={counts.added === 0 ? "text-fog" : "text-go"}>
                                                    +{counts.added}
                                                </span>
                                                /
                                                <span className={counts.removed === 0 ? "text-fog" : "text-stop"}>
                                                    -{counts.removed}
                                                </span>
                                            </>
                                        )}
                                    </summary>
                                    <div className="mt-1 space-y-1">
                                        {detail.map((line, i) => (
                                            <p
                                                key={i}
                                                className={`whitespace-pre-wrap font-mono text-xs ${
                                                    call.tool === "edit" && line.startsWith("+ ")
                                                        ? "text-go"
                                                        : call.tool === "edit" && line.startsWith("- ")
                                                          ? "text-stop"
                                                          : "text-dim"
                                                }`}
                                            >
                                                {line}
                                            </p>
                                        ))}
                                        {stamp && (
                                            <p className="font-mono text-xs text-dim">{stamp}</p>
                                        )}
                                    </div>
                                </details>
                            </li>
                        );
                    }
                    if (m.kind === "compaction" || m.kind === "summary") {
                        return (
                            <li key={m.id} className="border-l-2 border-warn pl-3">
                                <details>
                                    <summary className="cursor-pointer font-mono text-xs text-dim">
                                        Session compacted. Show summary.
                                    </summary>
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-dim">{m.body}</p>
                                </details>
                            </li>
                        );
                    }
                    return (
                        <li key={m.id} className="flex justify-start">
                            <div className="max-w-[85%] lg:max-w-3xl">
                                <div className="rounded-lg border border-line bg-panel px-3 py-2">
                                    <MarkdownText body={m.body} />
                                </div>
                                {stamp && (
                                    <p className="mt-1 font-mono text-xs text-dim">{stamp}</p>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
            </div>
            <div className="shrink-0 border-t border-line pt-3">
            {done && <p className="mt-1 font-mono text-xs text-go">{done}</p>}
            {offlineNote && <p className="mt-1 font-mono text-xs text-warn">{offlineNote}</p>}
            <div className="mt-2 rounded-2xl border border-line bg-panel p-3">
                <textarea
                    value={draft}
                    onChange={onChangeDraft}
                    onKeyDown={onKeyDownDraft}
                    rows={2}
                    placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                    className="w-full resize-none bg-transparent font-mono text-sm outline-none placeholder:text-dim"
                />
                <div className="mt-1 flex items-center gap-2">
                    {catalog.models.length === 0 && catalog.agents.length === 0 ? (
                        <p className="font-mono text-xs text-dim">No catalog yet. Run `localagents sync-models` on the PC.</p>
                    ) : (
                        <>
                            <select
                                value={agent}
                                onChange={onSelectAgent}
                                disabled={busy !== null}
                                aria-label="Agent"
                                className="max-w-28 rounded border border-line bg-ink p-1.5 font-mono text-xs disabled:opacity-50"
                            >
                                {agent.length === 0 && <option value="">Agent…</option>}
                                {catalog.agents.map((a, i) => (
                                    <option key={a.id ?? i} value={a.id ?? ""}>
                                        {a.name ?? a.id}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={modelId}
                                onChange={onSelectModel}
                                disabled={busy !== null}
                                aria-label="Model"
                                className="max-w-44 rounded border border-line bg-ink p-1.5 font-mono text-xs disabled:opacity-50"
                            >
                                {modelId.length === 0 && <option value="">Model…</option>}
                                {providers.map(([providerID, models]) => (
                                    <optgroup key={providerID} label={providerID}>
                                        {models.map((m) => (
                                            <option key={`${m.providerID}/${m.id}`} value={`${m.providerID}/${m.id}`}>
                                                {m.name ?? m.id}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                            {variants.length > 0 && (
                                <select
                                    value={variant}
                                    onChange={onSelectVariant}
                                    disabled={busy !== null}
                                    aria-label="Variant"
                                    className="max-w-28 rounded border border-line bg-ink p-1.5 font-mono text-xs disabled:opacity-50"
                                >
                                    {variant.length === 0 && <option value="">Variant…</option>}
                                    {variants.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.id}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </>
                    )}
                    <div className="flex-1" />
                    <button
                        onClick={onClickSend}
                        disabled={busy !== null || draft.trim().length === 0}
                        aria-label="Send message"
                        className="rounded-full bg-go px-3.5 py-1.5 font-mono text-base font-bold text-ink disabled:opacity-50"
                    >
                        ↑
                    </button>
                </div>
            </div>
            </div>
            </div>
            <aside className="scroll-slim order-1 max-h-64 min-h-0 min-w-0 shrink-0 space-y-2 overflow-y-auto lg:order-2 lg:max-h-none lg:w-auto lg:flex-[3]">
            <div>
                <h1 className="text-xl font-bold">{info.title}</h1>
                <p className="mt-1 font-mono text-xs text-dim">
                    <span
                        className={deviceLastSeenAt && Date.now() - new Date(deviceLastSeenAt).getTime() < 120000 ? "text-go" : "text-stop"}
                    >
                        ●
                    </span>{" "}
                    {info.status} · {lastSyncAt ? `synced ${formatStamp(lastSyncAt) ?? lastSyncAt}` : "never synced"}
                </p>
            </div>
            <details open>
                <summary className="cursor-pointer font-mono text-sm font-bold text-dim">Session stats</summary>
                <div className="mt-2">
                    <SessionStatsView stats={liveStats} />
                </div>
            </details>
            <details open={rows.length > 0}>
                <summary className="cursor-pointer font-mono text-sm font-bold text-dim">
                    Pending approvals{rows.length > 0 ? ` (${rows.length})` : ""}
                </summary>
            {rows.length === 0 && <p className="mt-2 text-dim">No pending requests.</p>}
            <ul className="mt-2 space-y-2">
                {rows.map((row) => (
                    <li key={row.id} className="rounded border border-line bg-panel p-4">
                        <p className="font-mono text-sm">
                            {row.action} <span className="text-dim">{row.resources}</span>
                        </p>
                        {row.message && (
                            <p className="mt-1 text-sm text-dim">{row.message.slice(0, 200)}</p>
                        )}
                        <div className="mt-3 flex gap-2">
                            <button
                                onClick={() => onClickDecide(row.id, "once")}
                                disabled={busy === row.id}
                                className="rounded bg-go px-3 py-1 font-mono text-xs font-bold text-ink disabled:opacity-50"
                            >
                                Allow
                            </button>
                            <button
                                onClick={() => onClickDecide(row.id, "reject")}
                                disabled={busy === row.id}
                                className="rounded border border-line px-3 py-1 font-mono text-xs text-fog disabled:opacity-50"
                            >
                                Deny
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
            </details>
        </aside>
        </div>
            {showJump && (
                <button
                    onClick={() => scrollToEnd()}
                    aria-label="Scroll to bottom"
                    className="fixed bottom-44 left-1/2 -translate-x-1/2 rounded-full border border-line bg-panel px-4 py-2 font-mono text-lg text-fog lg:left-[35%]"
                >
                    ↓
                </button>
            )}
        </main>
    );
}
