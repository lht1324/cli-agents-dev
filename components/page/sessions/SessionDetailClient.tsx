"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveThread } from "@/lib/neon/live";
import { parseToolCall, toolDetail, toolSummary } from "./toolFormat";
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

export interface ThreadRow {
    id: string;
    seq: number;
    role: string;
    kind: string;
    body: string;
    createdAt: string | null;
}

export interface CatalogModel {
    id: string;
    providerID: string;
    name?: string;
    variants?: { id: string }[];
}

function parseCatalog(json: string | null): { models: CatalogModel[]; agents: CatalogAgent[] } {
    if (!json) {
        return { models: [], agents: [] };
    }
    try {
        const parsed = JSON.parse(json) as {
            models?: { data?: CatalogModel[] } | CatalogModel[];
            agents?: { data?: CatalogAgent[] } | CatalogAgent[];
        };
        const models = Array.isArray(parsed.models) ? parsed.models : (parsed.models?.data ?? []);
        const agents = (Array.isArray(parsed.agents) ? parsed.agents : (parsed.agents?.data ?? [])).filter(
            (a) => a.mode === "primary" && a.hidden !== true,
        );
        return { models, agents };
    } catch {
        return { models: [], agents: [] };
    }
}

interface CatalogAgent {
    id?: string;
    name?: string;
    mode?: string;
    hidden?: boolean;
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

export default function SessionDetailClient({
    info,
    approvals,
    messages,
    userId,
    catalogJson,
}: {
    info: SessionInfo;
    approvals: ApprovalRow[];
    messages: ThreadRow[];
    userId: string;
    catalogJson: string | null;
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
    const thread = useLiveThread(info.id, messages);
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
    const onChangeAgent = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setAgent(e.target.value);
    }, []);
    const onChangeModel = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setModelId(e.target.value);
        setVariant("");
    }, []);
    const onChangeVariant = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setVariant(e.target.value);
    }, []);
    const onClickApplyAgent = useCallback(async () => {
        if (agent.length === 0) {
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
                    payload: JSON.stringify({ sessionID: info.id, agent }),
                }),
            });
            setDone(res.ok ? `agent -> ${agent} queued.` : "failed to queue");
        } finally {
            setBusy(null);
        }
    }, [agent, info, userId]);
    const onClickApplyModel = useCallback(async () => {
        const [providerID, id] = modelId.split("/");
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
                        model: { id, providerID, variant: variant || undefined },
                    }),
                }),
            });
            setDone(res.ok ? `model -> ${modelId}${variant ? `#${variant}` : ""} queued.` : "failed to queue");
        } finally {
            setBusy(null);
        }
    }, [modelId, variant, info, userId]);
    const stampOf = useCallback((iso: string | null) => {
        if (!iso) {
            return null;
        }
        const at = new Date(iso);
        const now = new Date();
        const time = at.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
        const sameDay =
            at.getFullYear() === now.getFullYear() &&
            at.getMonth() === now.getMonth() &&
            at.getDate() === now.getDate();
        if (sameDay) {
            return time;
        }
        const date = `${at.getMonth() + 1}월 ${at.getDate()}일`;
        if (at.getFullYear() === now.getFullYear()) {
            return `${date} ${time}`;
        }
        return `${at.getFullYear()}년 ${date} ${time}`;
    }, []);
    const offlineNote = useMemo(() => {
        if (!info.deviceLastSeenAt) {
            return "Runs when the PC is back online.";
        }
        const minutes = (Date.now() - new Date(info.deviceLastSeenAt).getTime()) / 60000;
        return minutes >= 2 ? "Runs when the PC is back online." : null;
    }, [info.deviceLastSeenAt]);
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
    return (
        <main className="mx-auto flex h-dvh max-w-5xl flex-col px-6 py-4">
            <div className="order-1 shrink-0">
                <h1 className="text-2xl font-bold">{info.title}</h1>
                <p className="mt-1 font-mono text-xs text-dim">
                    {info.status} · {info.lastSyncAt ? `synced ${info.lastSyncAt}` : "never synced"}
                </p>
            </div>
            <div ref={scrollRef} className="order-4 mt-2 min-h-0 flex-1 overflow-y-auto">
            {thread.length === 0 && <p className="mt-2 text-dim">No synced messages yet.</p>}
            <ul className="mt-2 space-y-2 pb-2">
                {thread.map((m) => {
                    const stamp = stampOf(m.createdAt);
                    if (m.role === "user") {
                        return (
                            <li key={m.id} className="flex justify-end">
                                <div className="max-w-[85%]">
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
                                <li key={m.id}>
                                    <p className="whitespace-pre-wrap font-mono text-xs text-dim">{m.body}</p>
                                    {stamp && (
                                        <p className="mt-1 font-mono text-xs text-dim">{stamp}</p>
                                    )}
                                </li>
                            );
                        }
                        const detail = toolDetail(call);
                        return (
                            <li key={m.id}>
                                <details className="rounded border border-line bg-ink px-3 py-2">
                                    <summary className="cursor-pointer font-mono text-xs text-dim">
                                        ▸ {toolSummary(call)}
                                    </summary>
                                    <div className="mt-1 space-y-1">
                                        {detail.map((line, i) => (
                                            <p key={i} className="whitespace-pre-wrap font-mono text-xs text-dim">
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
                            <div className="max-w-[85%]">
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
            <details className="order-2 mt-2 shrink-0">
                <summary className="cursor-pointer font-mono text-sm font-bold text-dim">Agent & model</summary>
            <p className="mt-1 font-mono text-xs text-dim">
                current: {info.agent ?? "?"} ·{" "}
                {(() => {
                    const current = parseCurrentModel(info.model);
                    return current
                        ? `${current.providerID}/${current.id}${current.variant ? `#${current.variant}` : ""}`
                        : "?";
                })()}
            </p>
            {catalog.models.length === 0 && catalog.agents.length === 0 ? (
                <p className="mt-2 text-dim">No catalog yet. Run `localagents sync-models` on the PC.</p>
            ) : (
                <div className="mt-2 space-y-2">
                    <div className="flex gap-2">
                        <select
                            value={agent}
                            onChange={onChangeAgent}
                            className="flex-1 rounded border border-line bg-panel p-2 font-mono text-sm"
                        >
                            {agent.length === 0 && <option value="">Agent…</option>}
                            {catalog.agents.map((a, i) => (
                                <option key={a.id ?? i} value={a.id ?? ""}>
                                    {a.name ?? a.id}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={onClickApplyAgent}
                            disabled={busy !== null || agent.length === 0}
                            className="rounded bg-go px-3 py-1 font-mono text-xs font-bold text-ink disabled:opacity-50"
                        >
                            Apply
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={modelId}
                            onChange={onChangeModel}
                            className="flex-1 rounded border border-line bg-panel p-2 font-mono text-sm"
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
                        <select
                            value={variant}
                            onChange={onChangeVariant}
                            disabled={variants.length === 0}
                            className="rounded border border-line bg-panel p-2 font-mono text-sm disabled:opacity-50"
                        >
                            {variant.length === 0 && <option value="">Variant…</option>}
                            {variants.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.id}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={onClickApplyModel}
                            disabled={busy !== null || modelId.length === 0}
                            className="rounded bg-go px-3 py-1 font-mono text-xs font-bold text-ink disabled:opacity-50"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            )}
            </details>
            <details className="order-3 mt-2 max-h-56 shrink-0 overflow-y-auto" open={rows.length > 0}>
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
            <div className="order-5 shrink-0 border-t border-line pt-3">
            {done && <p className="mt-1 font-mono text-xs text-go">{done}</p>}
            <h2 className="mt-1 font-mono text-sm font-bold text-dim">Send a message</h2>
            {offlineNote && <p className="mt-1 font-mono text-xs text-warn">{offlineNote}</p>}
            <textarea
                value={draft}
                onChange={onChangeDraft}
                rows={3}
                className="mt-2 w-full rounded border border-line bg-panel p-3 font-mono text-sm"
            />
            <button
                onClick={onClickSend}
                disabled={busy !== null || draft.trim().length === 0}
                className="mt-2 rounded bg-go px-4 py-2 font-mono text-sm font-bold text-ink disabled:opacity-50"
            >
                Send
            </button>
            </div>
            {showJump && (
                <button
                    onClick={() => scrollToEnd()}
                    aria-label="Scroll to bottom"
                    className="fixed bottom-44 right-6 rounded-full border border-line bg-panel px-4 py-2 font-mono text-lg text-fog"
                >
                    ↓
                </button>
            )}
        </main>
    );
}
