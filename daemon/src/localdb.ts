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

// 커서보다 뒤에 쌓인 행 수. push 목록의 미반영 표시용.
export function countNewer(sessionID: string, createdAt: number | null, messageId: string | null): number {
    const path = dbPath();
    if (!path) {
        return 0;
    }
    const db = new DatabaseSync(path, { readOnly: true });
    try {
        const at = createdAt ?? 0;
        const row = db
            .prepare(
                "SELECT COUNT(*) AS n FROM session_message WHERE session_id = ? AND (time_created > ? OR (time_created = ? AND id > ?))",
            )
            .get(sessionID, at, at, messageId ?? "") as { n: number };
        return row.n;
    } catch {
        return 0;
    } finally {
        db.close();
    }
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

export interface TabMessage {
    id: string;
    type: string;
    seq: number;
    createdAt: number | null;
    updatedAt: number | null;
    data: string;
}

export interface TabPart {
    id: string;
    messageId: string;
    createdAt: number | null;
    updatedAt: number | null;
    data: string;
}

export interface TabPackage {
    tabId: string;
    exportedAt: number;
    messages: TabMessage[];
    parts: TabPart[];
}

// 인계용 통째 묶음. 현재 세션(epoch) 범위. id 순 정렬, 해시 검증용.
export function readTabPackage(sessionID: string): TabPackage {
    const path = dbPath();
    if (!path) {
        throw new Error("opencode db not found");
    }
    const db = new DatabaseSync(path, { readOnly: true });
    try {
        let cut = -1;
        const bounds = db
            .prepare("SELECT seq FROM session_message WHERE session_id = ? AND type = 'compaction' ORDER BY seq DESC LIMIT 1")
            .all(sessionID) as { seq: number }[];
        if (bounds.length > 0) {
            cut = bounds[0].seq;
        }
        const messages = db
            .prepare(
                "SELECT id, type, seq, time_created AS createdAt, time_updated AS updatedAt, data FROM session_message WHERE session_id = ? AND seq > ? ORDER BY id ASC",
            )
            .all(sessionID, cut) as unknown as (TabMessage & { type: string })[];
        const parts = db
            .prepare(
                "SELECT p.id, p.message_id AS messageId, p.time_created AS createdAt, p.time_updated AS updatedAt, p.data FROM part p INNER JOIN session_message m ON m.id = p.message_id WHERE m.session_id = ? AND m.seq > ? ORDER BY p.id ASC",
            )
            .all(sessionID, cut) as unknown as TabPart[];
        return {
            tabId: sessionID,
            exportedAt: Date.now(),
            messages: messages.map((m) => ({ id: m.id, type: m.type, seq: m.seq, createdAt: m.createdAt, updatedAt: m.updatedAt, data: m.data })),
            parts,
        };
    } finally {
        db.close();
    }
}

// 인계 적용. id 기준 upsert, seq는 로컬에 맞춰 새로 매김. 트랜잭션 1방.
export function applyTabPackage(localTabId: string, pkg: TabPackage): { messages: number; parts: number } {
    const path = dbPath();
    if (!path) {
        throw new Error("opencode db not found");
    }
    const db = new DatabaseSync(path);
    try {
        const maxRow = db
            .prepare("SELECT COALESCE(MAX(seq), 0) AS maxSeq FROM session_message WHERE session_id = ?")
            .get(localTabId) as { maxSeq: number };
        let seq = maxRow.maxSeq;
        let messages = 0;
        let parts = 0;
        db.exec("BEGIN");
        try {
            const putMsg = db.prepare(
                "INSERT INTO session_message (id, session_id, type, seq, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET type = excluded.type, data = excluded.data, time_updated = excluded.time_updated",
            );
            for (const m of pkg.messages) {
                seq += 1;
                putMsg.run(m.id, localTabId, m.type, seq, m.createdAt ?? Date.now(), m.updatedAt ?? Date.now(), m.data);
                messages++;
            }
            const putPart = db.prepare(
                "INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
            );
            for (const p of pkg.parts) {
                putPart.run(p.id, p.messageId, localTabId, p.createdAt ?? Date.now(), p.updatedAt ?? Date.now(), p.data);
                parts++;
            }
            db.exec("COMMIT");
        } catch (err) {
            try {
                db.exec("ROLLBACK");
            } catch {
                // 무시
            }
            throw err;
        }
        return { messages, parts };
    } finally {
        db.close();
    }
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
