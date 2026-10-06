import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ServerMessage } from "./types";

function dbPath(): string | null {
    const path =
        platform() === "darwin"
            ? join(homedir(), "Library", "Application Support", "opencode", "opencode.db")
            : join(homedir(), ".local", "share", "opencode", "opencode.db");
    return existsSync(path) ? path : null;
}

function toMessage(row: { id: string; type: string; createdAt: number | null; data: string }): ServerMessage | null {
    let d: Record<string, unknown>;
    try {
        d = JSON.parse(row.data) as Record<string, unknown>;
    } catch {
        return null;
    }
    const time = typeof row.createdAt === "number" ? { created: row.createdAt } : undefined;
    if (row.type === "user") {
        const meta = (d.metadata ?? {}) as Record<string, unknown>;
        return {
            id: row.id,
            type: "user",
            time,
            text: typeof meta.displayText === "string" ? meta.displayText : "",
            files: Array.isArray(meta.attachments) ? (meta.attachments as { name?: string; mime?: string }[]) : [],
        } as ServerMessage;
    }
    if (row.type === "assistant") {
        return {
            id: row.id,
            type: "assistant",
            time,
            content: Array.isArray(d.content) ? (d.content as ServerMessage["content"]) : [],
        };
    }
    if (row.type === "compaction") {
        return { id: row.id, type: "compaction", time, summary: typeof d.summary === "string" ? d.summary : "" };
    }
    return null;
}

export interface SessionUsage {
    input: number | null;
    output: number | null;
    reasoning: number | null;
    cacheRead: number | null;
    cacheWrite: number | null;
    msgUser: number;
    msgAssistant: number;
}

// 마지막 assistant 호출 토큰 + 누적 메시지 횟수. 없으면 null/0.
export function sessionUsage(sessionID: string): SessionUsage {
    const empty: SessionUsage = {
        input: null,
        output: null,
        reasoning: null,
        cacheRead: null,
        cacheWrite: null,
        msgUser: 0,
        msgAssistant: 0,
    };
    const path = dbPath();
    if (!path) {
        return empty;
    }
    const db = new DatabaseSync(path, { readOnly: true });
    try {
        const counts = db
            .prepare("SELECT type, COUNT(*) AS n FROM session_message WHERE session_id = ? GROUP BY type")
            .all(sessionID) as { type: string; n: number }[];
        for (const c of counts) {
            if (c.type === "user") {
                empty.msgUser = c.n;
            } else if (c.type === "assistant") {
                empty.msgAssistant = c.n;
            }
        }
        const last = db
            .prepare(
                "SELECT data FROM session_message WHERE session_id = ? AND type = 'assistant' AND json_extract(data, '$.tokens') IS NOT NULL ORDER BY seq DESC LIMIT 1",
            )
            .all(sessionID) as { data: string }[];
        if (last.length > 0) {
            try {
                const t = (JSON.parse(last[0].data) as { tokens?: Record<string, unknown> }).tokens ?? {};
                const cache = (t.cache ?? {}) as Record<string, unknown>;
                const num = (v: unknown) => (typeof v === "number" ? v : null);
                empty.input = num(t.input);
                empty.output = num(t.output);
                empty.reasoning = num(t.reasoning);
                empty.cacheRead = num(cache.read);
                empty.cacheWrite = num(cache.write);
            } catch {
                // 부분 실패 무시
            }
        }
        return empty;
    } finally {
        db.close();
    }
}
export function readEpochRows(sessionID: string): ServerMessage[] {
    const path = dbPath();
    if (!path) {
        throw new Error("opencode db not found");
    }
    const db = new DatabaseSync(path, { readOnly: true });
    try {
        const rows = db
            .prepare("SELECT id, type, time_created AS createdAt, data FROM session_message WHERE session_id = ? ORDER BY seq ASC")
            .all(sessionID) as { id: string; type: string; createdAt: number | null; data: string }[];
        let cut = 0;
        rows.forEach((r, i) => {
            if (r.type === "compaction") {
                cut = i;
            }
        });
        const out: ServerMessage[] = [];
        for (const r of rows.slice(cut)) {
            const m = toMessage(r);
            if (m) {
                out.push(m);
            }
        }
        return out;
    } finally {
        db.close();
    }
}
