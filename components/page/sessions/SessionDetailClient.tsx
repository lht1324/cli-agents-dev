"use client";

import { useCallback, useMemo, useState } from "react";

export interface SessionInfo {
    id: string;
    title: string;
    status: string;
    deviceId: string;
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
    seq: number;
    role: string;
    kind: string;
    body: string;
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
}: {
    info: SessionInfo;
    approvals: ApprovalRow[];
    messages: ThreadRow[];
    userId: string;
}) {
    const [busy, setBusy] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const rows = useMemo(() => approvals, [approvals]);
    const thread = useMemo(() => messages, [messages]);
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
        <main className="mx-auto max-w-3xl px-4 py-10">
            <h1 className="text-2xl font-bold">{info.title}</h1>
            <p className="mt-1 font-mono text-xs text-dim">
                {info.status} · {info.lastSyncAt ? `synced ${info.lastSyncAt}` : "never synced"}
            </p>
            <h2 className="mt-8 font-mono text-sm font-bold text-dim">Conversation</h2>
            {thread.length === 0 && <p className="mt-2 text-dim">No synced messages yet.</p>}
            <ul className="mt-2 space-y-2">
                {thread.map((m) => {
                    if (m.role === "user") {
                        return (
                            <li key={m.seq} className="flex justify-end">
                                <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-panel px-3 py-2 text-sm">
                                    {m.body}
                                </p>
                            </li>
                        );
                    }
                    if (m.kind === "tool") {
                        return (
                            <li key={m.seq}>
                                <details className="rounded border border-line bg-ink px-3 py-2">
                                    <summary className="cursor-pointer font-mono text-xs text-dim">
                                        $ {m.body.slice(0, 100)}
                                    </summary>
                                    <p className="mt-1 whitespace-pre-wrap font-mono text-xs text-dim">
                                        {m.body}
                                    </p>
                                </details>
                            </li>
                        );
                    }
                    if (m.kind === "summary") {
                        return (
                            <li key={m.seq} className="border-l-2 border-warn pl-3">
                                <p className="whitespace-pre-wrap text-sm text-dim">{m.body}</p>
                            </li>
                        );
                    }
                    return (
                        <li key={m.seq} className="flex justify-start">
                            <p className="max-w-[85%] whitespace-pre-wrap rounded-lg border border-line bg-panel px-3 py-2 text-sm">
                                {m.body}
                            </p>
                        </li>
                    );
                })}
            </ul>
            <h2 className="mt-8 font-mono text-sm font-bold text-dim">Pending approvals</h2>
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
            {done && <p className="mt-2 font-mono text-xs text-go">{done}</p>}
            <h2 className="mt-8 font-mono text-sm font-bold text-dim">Send a message</h2>
            {offlineNote && <p className="mt-2 font-mono text-xs text-warn">{offlineNote}</p>}
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
        </main>
    );
}
