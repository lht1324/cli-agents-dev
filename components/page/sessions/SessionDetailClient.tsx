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
    userId,
}: {
    info: SessionInfo;
    approvals: ApprovalRow[];
    userId: string;
}) {
    const [busy, setBusy] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const rows = useMemo(() => approvals, [approvals]);
    const offlineNote = useMemo(() => {
        if (!info.deviceLastSeenAt) {
            return "PC가 오프라인이면 켜질 때 실행됩니다.";
        }
        const minutes = (Date.now() - new Date(info.deviceLastSeenAt).getTime()) / 60000;
        return minutes >= 2 ? "PC가 오프라인이면 켜질 때 실행됩니다." : null;
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
        <main>
            <h1>{info.title}</h1>
            <p>
                {info.status} · {info.lastSyncAt ? `synced ${info.lastSyncAt}` : "never synced"}
            </p>
            <h2>Pending approvals</h2>
            {rows.length === 0 && <p>No pending requests.</p>}
            <ul>
                {rows.map((row) => (
                    <li key={row.id}>
                        <span>{row.action}</span>
                        <span>{row.resources}</span>
                        {row.message && <span>{row.message.slice(0, 200)}</span>}
                        <button onClick={() => onClickDecide(row.id, "once")} disabled={busy === row.id}>
                            Allow
                        </button>
                        <button onClick={() => onClickDecide(row.id, "reject")} disabled={busy === row.id}>
                            Deny
                        </button>
                    </li>
                ))}
            </ul>
            {done && <p>{done}</p>}
            <h2>Send a message</h2>
            {offlineNote && <p>{offlineNote}</p>}
            <textarea value={draft} onChange={onChangeDraft} rows={3} />
            <button onClick={onClickSend} disabled={busy !== null || draft.trim().length === 0}>
                Send
            </button>
        </main>
    );
}
