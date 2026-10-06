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

// 현재 세션(epoch) 행만. 마지막 compaction 뒤 전부, 제한 없음. 경계 compaction은 포함(접기 표시).
// idle·system 등은 제외. 읽기 전용. 실패하면 호출 쪽이 API 창으로 폴백.
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
