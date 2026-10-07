import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ServerMessage } from "./types";

function dbPath(): string | null {
    // 설치 방식마다 다르다. 둘 다 찔러본다 (이 Mac은 XDG 쪽에 있음).
    const candidates = [
        join(homedir(), ".local", "share", "opencode", "opencode.db"),
        join(homedir(), "Library", "Application Support", "opencode", "opencode.db"),
    ];
    for (const path of candidates) {
        if (existsSync(path)) {
            return path;
        }
    }
    return null;
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

// 탭의 현재 epoch 번호. compaction 횟수 = 지금 세대.
export function epochOf(sessionID: string): number {
    const path = dbPath();
    if (!path) {
        return 0;
    }
    const db = new DatabaseSync(path, { readOnly: true });
    try {
        const row = db
            .prepare("SELECT COUNT(*) AS n FROM session_message WHERE session_id = ? AND type = 'compaction'")
            .get(sessionID) as { n: number };
        return row.n;
    } catch {
        return 0;
    } finally {
        db.close();
    }
}
// 메시지+파트 합산. 파트는 새 메시지에 딸린 것만 셈한다.
export function countNewer(sessionID: string, createdAt: number | null, messageId: string | null): number {
    const path = dbPath();
    if (!path) {
        return 0;
    }
    const db = new DatabaseSync(path, { readOnly: true });
    try {
        const at = createdAt ?? 0;
        const mid = messageId ?? "";
        const msgs = db
            .prepare(
                "SELECT COUNT(*) AS n FROM session_message WHERE session_id = ? AND (time_created > ? OR (time_created = ? AND id > ?))",
            )
            .get(sessionID, at, at, mid) as { n: number };
        const parts = db
            .prepare(
                "SELECT COUNT(*) AS n FROM part p INNER JOIN session_message m ON m.id = p.message_id WHERE m.session_id = ? AND (m.time_created > ? OR (m.time_created = ? AND m.id > ?))",
            )
            .get(sessionID, at, at, mid) as { n: number };
        return msgs.n + parts.n;
    } catch {
        return 0;
    } finally {
        db.close();
    }
}

// 탭 최신점. push 워터마크 기록용.
export function latestOf(sessionID: string): { at: number; id: string } | null {
    const path = dbPath();
    if (!path) {
        return null;
    }
    const db = new DatabaseSync(path, { readOnly: true });
    try {
        const row = db
            .prepare("SELECT time_created AS at, id FROM session_message WHERE session_id = ? ORDER BY time_created DESC, id DESC LIMIT 1")
            .get(sessionID) as { at: number | null; id: string } | undefined;
        if (!row) {
            return null;
        }
        return { at: row.at ?? 0, id: row.id };
    } catch {
        return null;
    } finally {
        db.close();
    }
}

// 워터마크 없으면 탭 전체 행 수 (메시지+파트). 첫 push 표시용.
export function countAll(sessionID: string): number {
    const path = dbPath();
    if (!path) {
        return 0;
    }
    const db = new DatabaseSync(path, { readOnly: true });
    try {
        const msgs = db.prepare("SELECT COUNT(*) AS n FROM session_message WHERE session_id = ?").get(sessionID) as {
            n: number;
        };
        const parts = db
            .prepare("SELECT COUNT(*) AS n FROM part p INNER JOIN session_message m ON m.id = p.message_id WHERE m.session_id = ?")
            .get(sessionID) as { n: number };
        return msgs.n + parts.n;
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
    title?: string | null;
    directory?: string | null;
    version?: string | null;
    messages: TabMessage[];
    parts: TabPart[];
}

// 로컬 DB 맛보기. session_message에 행이 있으면 v2, 없으면 v1 (message+part).
function dbFlavor(): "v1" | "v2" {
    const path = dbPath();
    if (!path) {
        return "v1";
    }
    const db = new DatabaseSync(path, { readOnly: true });
    try {
        const row = db.prepare("SELECT COUNT(*) AS n FROM session_message").get() as { n: number };
        return row.n > 0 ? "v2" : "v1";
    } catch {
        return "v1";
    } finally {
        db.close();
    }
}

export function sessionExists(sessionID: string): boolean {
    const path = dbPath();
    if (!path) {
        return false;
    }
    const db = new DatabaseSync(path, { readOnly: true });
    try {
        const row = db.prepare("SELECT id FROM session WHERE id = ?").get(sessionID) as { id: string } | undefined;
        return !!row;
    } catch {
        return false;
    } finally {
        db.close();
    }
}

// v1 읽기. message 테이블 role을 type으로, 순서를 seq로 쓴다. compaction 절단 없음.
function readTabPackageV1(db: InstanceType<typeof DatabaseSync>, sessionID: string): { messages: TabMessage[]; parts: TabPart[] } {
    const msgs = db
        .prepare("SELECT id, time_created AS createdAt, time_updated AS updatedAt, data FROM message WHERE session_id = ? ORDER BY time_created ASC, id ASC")
        .all(sessionID) as { id: string; createdAt: number | null; updatedAt: number | null; data: string }[];
    const messages: TabMessage[] = msgs.map((m, i) => {
        let role = "assistant";
        try {
            const d = JSON.parse(m.data) as { role?: unknown };
            if (typeof d.role === "string" && d.role.length > 0) {
                role = d.role;
            }
        } catch {
            // 원문 유지
        }
        return { id: m.id, type: role, seq: i, createdAt: m.createdAt, updatedAt: m.updatedAt, data: m.data };
    });
    const parts = db
        .prepare("SELECT id, message_id AS messageId, time_created AS createdAt, time_updated AS updatedAt, data FROM part WHERE session_id = ? ORDER BY time_created ASC, id ASC")
        .all(sessionID) as unknown as TabPart[];
    return { messages, parts };
}

// 인계용 통째 묶음. 현재 세션(epoch) 범위. id 순 정렬, 해시 검증용.
// v2는 session_message, v1은 message+part에서 읽는다.
export function readTabPackage(sessionID: string): TabPackage {
    const path = dbPath();
    if (!path) {
        throw new Error("opencode db not found");
    }
    const db = new DatabaseSync(path, { readOnly: true });
    try {
        const meta = db.prepare("SELECT title, directory, version FROM session WHERE id = ?").get(sessionID) as
            | { title: string; directory: string; version: string }
            | undefined;
        if (dbFlavor() === "v1") {
            const v1 = readTabPackageV1(db, sessionID);
            return {
                tabId: sessionID,
                exportedAt: Date.now(),
                title: meta?.title ?? null,
                directory: meta?.directory ?? null,
                version: meta?.version ?? null,
                messages: v1.messages,
                parts: v1.parts,
            };
        }
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
            title: meta?.title ?? null,
            directory: meta?.directory ?? null,
            version: meta?.version ?? null,
            messages: messages.map((m) => ({ id: m.id, type: m.type, seq: m.seq, createdAt: m.createdAt, updatedAt: m.updatedAt, data: m.data })),
            parts,
        };
    } finally {
        db.close();
    }
}

// 인계 적용 upsert. 탭 없으면 생성, 있으면 병합. id는 유지, 그릇은 로컬 맛보기.
// v1(message+part) ⇄ v2(session_message) 교차는 메시지+파트 행 단위 변환이다.
export function applyTabPackageUpsert(pkg: TabPackage, fallbackTitle?: string | null): { created: boolean; messages: number; parts: number } {
    const path = dbPath();
    if (!path) {
        throw new Error("opencode db not found");
    }
    const db = new DatabaseSync(path);
    try {
        const exists = db.prepare("SELECT id FROM session WHERE id = ?").get(pkg.tabId) as { id: string } | undefined;
        let created = false;
        const now = Date.now();
        if (!exists) {
            const dir = pkg.directory ?? process.cwd();
            const proj =
                (db.prepare("SELECT id FROM project WHERE worktree = ?").get(dir) as { id: string } | undefined) ??
                (db.prepare("SELECT id FROM project LIMIT 1").get() as { id: string } | undefined);
            if (!proj) {
                throw new Error("no project row to attach the tab to");
            }
            const sibling = db.prepare("SELECT version FROM session LIMIT 1").get() as { version: string } | undefined;
            db.prepare(
                "INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ).run(pkg.tabId, proj.id, pkg.tabId, dir, pkg.title ?? fallbackTitle ?? pkg.tabId, pkg.version ?? sibling?.version ?? "unknown", now, now);
            created = true;
        } else {
            db.prepare("UPDATE session SET title = ?, time_updated = ? WHERE id = ?").run(
                pkg.title ?? fallbackTitle ?? pkg.tabId,
                now,
                pkg.tabId,
            );
        }
        const flavor: "v1" | "v2" = (() => {
            try {
                const r = db.prepare("SELECT COUNT(*) AS n FROM session_message").get() as { n: number };
                return r.n > 0 ? "v2" : "v1";
            } catch {
                return "v1";
            }
        })();
        let messages = 0;
        let parts = 0;
        db.exec("BEGIN");
        try {
            if (flavor === "v2") {
                const maxRow = db.prepare("SELECT COALESCE(MAX(seq), 0) AS maxSeq FROM session_message WHERE session_id = ?").get(pkg.tabId) as {
                    maxSeq: number;
                };
                let seq = maxRow.maxSeq;
                const putMsg = db.prepare(
                    "INSERT INTO session_message (id, session_id, type, seq, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET type = excluded.type, data = excluded.data, time_updated = excluded.time_updated",
                );
                for (const m of pkg.messages) {
                    seq += 1;
                    putMsg.run(m.id, pkg.tabId, m.type, seq, m.createdAt ?? now, m.updatedAt ?? now, m.data);
                    messages++;
                }
            } else {
                const putMsg = db.prepare(
                    "INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, time_updated = excluded.time_updated",
                );
                for (const m of pkg.messages) {
                    const data = toV1MessageData(m);
                    if (!data) {
                        continue;
                    }
                    putMsg.run(m.id, pkg.tabId, m.createdAt ?? now, m.updatedAt ?? now, data);
                    messages++;
                }
            }
            const putPart = db.prepare(
                "INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
            );
            for (const p of pkg.parts) {
                putPart.run(p.id, p.messageId, pkg.tabId, p.createdAt ?? now, p.updatedAt ?? now, p.data);
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
        return { created, messages, parts };
    } finally {
        db.close();
    }
}

// v2 행 → v1 message.data. user/assistant 텍스트만 옮긴다. 모르는 모양은 버린다.
function toV1MessageData(m: TabMessage): string | null {
    try {
        const d = JSON.parse(m.data) as { role?: unknown };
        if (typeof d.role === "string") {
            return m.data;
        }
    } catch {
        // 아래에서 type으로 복원
    }
    if (m.type === "user" || m.type === "assistant") {
        return JSON.stringify({ role: m.type, time: { created: m.createdAt ?? Date.now() } });
    }
    return null;
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
