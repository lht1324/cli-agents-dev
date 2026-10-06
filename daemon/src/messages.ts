import { apiGet, type DiscoveredServer } from "./server";
import { formatToolExit } from "./tools";
import { cloudGet, cloudPost } from "./cloud";
import { isNewer, readCursor, writeCursor } from "./cursors";
import { readEpochRows } from "./localdb";
import type { PlainRow, ServerMessage } from "./types";

function cap(text: string, limit: number): string {
    return text.length > limit ? `${text.slice(0, limit)}…[truncated]` : text;
}

function at(m: ServerMessage): number | null {
    return typeof m.time?.created === "number" ? m.time.created : null;
}

// 텍스트 항상, tool은 메타만, payload·첨부 제외.
export function flatten(messages: ServerMessage[]): PlainRow[] {
    const rows: PlainRow[] = [];
    messages.forEach((m, seq) => {
        if (typeof m.id !== "string" || m.id.length === 0) {
            return;
        }
        const createdAt = at(m);
        let part = 0;
        const key = () => (part === 0 ? m.id : `${m.id}#${part}`);
        if (m.type === "user") {
            const text = m.text ?? m.payload?.text ?? "";
            if (text.length > 0) {
                rows.push({ id: key(), seq, role: "user", kind: "text", body: cap(text, 8000), createdAt });
                part++;
            }
            const files = (m as { files?: { name?: string; mime?: string; data?: string }[] }).files ?? [];
            for (const f of files) {
                const kb = f.data ? Math.round(f.data.length / 1024) : 0;
                rows.push({ id: key(), seq, role: "user", kind: "file", body: `${f.name ?? "file"} (${f.mime ?? "?"}, ${kb}KB, on-demand)`, createdAt });
                part++;
            }
            return;
        }
        if (m.type === "assistant") {
            for (const block of m.content ?? []) {
                if (block.type === "text" && block.text && block.text.length > 0) {
                    rows.push({ id: key(), seq, role: "assistant", kind: "text", body: cap(block.text, 8000), createdAt });
                    part++;
                } else if (block.type === "tool") {
                    const toolName = block.name ?? "tool";
                    const outputs = block.state?.content ?? [];
                    const texts = outputs.filter((o) => o.type === "text").map((o) => o.text ?? "");
                    const exit = formatToolExit(toolName, texts.join("\n"));
                    const hasImage = outputs.some((o) => o.type === "file");
                    const raw = ((block.state?.input ?? {}) as Record<string, unknown>);
                    const kept: Record<string, unknown> = {};
                    const stripped: string[] = [];
                    for (const [ik, value] of Object.entries(raw)) {
                        if ((ik === "content" || ik === "data") && typeof value === "string" && value.length > 500) {
                            stripped.push(`${ik}:${Math.round(value.length / 1024)}KB`);
                            continue;
                        }
                        kept[ik] = value;
                    }
                    const envelope: Record<string, unknown> = { tool: toolName, input: kept };
                    if (stripped.length > 0) {
                        envelope.stripped = stripped;
                    }
                    if (exit) {
                        envelope.exit = exit;
                    }
                    if (hasImage) {
                        envelope.hasImage = true;
                    }
                    if (toolName === "question" && texts.length > 0) {
                        envelope.answer = cap(
                            texts.join(" ").replace(/^User has answered your questions:\s*/, ""),
                            500,
                        );
                    }
                    rows.push({ id: key(), seq, role: "assistant", kind: "tool", body: cap(JSON.stringify(envelope), 4000), createdAt });
                    part++;
                }
            }
            return;
        }
        if (m.type === "compaction") {
            const summary = (m as { summary?: string }).summary ?? "";
            if (summary.length > 0) {
                rows.push({ id: key(), seq, role: "system", kind: "compaction", body: cap(summary, 8000), createdAt });
                part++;
            }
        }
    });
    return rows;
}

async function fetchMessages(server: DiscoveredServer, sessionID: string): Promise<ServerMessage[]> {
    const body = (await apiGet(server, `/session/${sessionID}/message?limit=200`)) as
        | { data?: ServerMessage[] }
        | ServerMessage[];
    const list = Array.isArray(body) ? body : (body.data ?? []);
    return [...list].reverse();
}

export async function syncMessages(server: DiscoveredServer, sessionID: string): Promise<{ rows: number }> {
    const messages = await fetchMessages(server, sessionID);
    const rows = flatten(messages);
    // 차집합: 커서보다 새로운 행만 올린다. 첫 실행은 전부(기준선), 이후는 증분.
    const cursor = readCursor(sessionID);
    const fresh = rows.filter((r) => isNewer(r.createdAt, r.id, cursor));
    if (fresh.length === 0) {
        return { rows: 0 };
    }
    const result = (await cloudPost("/api/messages", {
        messages: fresh.map((r) => ({
            sessionID,
            messageId: r.id,
            seq: r.seq,
            role: r.role,
            kind: r.kind,
            body: r.body,
            createdAt: r.createdAt,
        })),
    })) as { data?: { rows?: number } };
    // 커터는 전송한 것 중 최대값으로 전진. 실패 시 다음 주기가 재시도.
    let top = fresh[0];
    for (const r of fresh) {
        const a = r.createdAt ?? 0;
        const b = top.createdAt ?? 0;
        if (a > b || (a === b && r.id > top.id)) {
            top = r;
        }
    }
    writeCursor(sessionID, top.createdAt, top.id);
    return { rows: result.data?.rows ?? fresh.length };
}

// 첫 로그인 backfill. 로컬 DB에서 현재 세션(epoch) 전부를 올린다. 제한 없음.
// compaction 경계까지 거슬러 올라간다. 200행씩 끊어 올리며 진행률 표시. 실패하면 호출 쪽이 API 창으로 폴백.
export async function backfillSession(server: DiscoveredServer, sessionID: string, label?: string): Promise<{ rows: number }> {
    const messages = readEpochRows(sessionID);
    const rows = flatten(messages);
    const name = label ?? sessionID.slice(0, 12);
    if (rows.length === 0) {
        console.log(`backfill ${name}: empty`);
        return { rows: 0 };
    }
    for (let i = 0; i < rows.length; i += 200) {
        const part = rows.slice(i, i + 200);
        await cloudPost("/api/messages", {
            messages: part.map((r, k) => ({
                sessionID,
                messageId: r.id,
                seq: i + k,
                role: r.role,
                kind: r.kind,
                body: r.body,
                createdAt: r.createdAt,
            })),
        });
        const done = Math.min(i + part.length, rows.length);
        process.stdout.write(`\rbackfill ${name}: ${done}/${rows.length} (${Math.floor((done / rows.length) * 100)}%)`);
    }
    process.stdout.write("\n");
    let top = rows[0];
    for (const r of rows) {
        const a = r.createdAt ?? 0;
        const b = top.createdAt ?? 0;
        if (a > b || (a === b && r.id > top.id)) {
            top = r;
        }
    }
    writeCursor(sessionID, top.createdAt, top.id);
    return { rows: rows.length };
}

// 조건부 backfill. 클라우드에 없는 탭만 채운다. session_id 대조.
export async function backfillMissing(server: DiscoveredServer): Promise<{ checked: number; filled: number; rows: number }> {
    const listed = (await cloudGet("/api/sync")) as { data?: { tabIds?: string[] } };
    const have = new Set(Array.isArray(listed.data?.tabIds) ? listed.data.tabIds : []);
    const body = (await apiGet(server, "/session")) as { data?: { id: string }[] } | { id: string }[];
    const list = Array.isArray(body) ? body : (body.data ?? []);
    let filled = 0;
    let rows = 0;
    const pending = list.filter((s) => typeof s.id === "string" && !have.has(s.id));
    for (let i = 0; i < pending.length; i++) {
        const s = pending[i];
        let title: string | null = null;
        try {
            const detail = (await apiGet(server, `/session/${s.id}`)) as { data?: { title?: string } } | { title?: string };
            const row = (detail as { data?: { title?: string } }).data ?? detail;
            title = (row as { title?: string }).title ?? null;
        } catch {
            // 제목 없이 진행
        }
        console.log(`backfill [${i + 1}/${pending.length}] ${title ?? s.id}`);
        try {
            const r = await backfillSession(server, s.id, title ?? undefined);
            filled++;
            rows += r.rows;
        } catch {
            console.log("  failed, skipped");
        }
    }
    return { checked: list.length, filled, rows };
}

// 주기 안전망. 스풀 통지가 없어도 최근 활동 세션 본문을 올린다. 최대 5개, 실패는 건너뜀.
export async function syncActiveMessages(server: DiscoveredServer, maxAgeMs = 3600000): Promise<{ sessions: number; rows: number }> {
    const body = (await apiGet(server, "/session")) as
        | { data?: { id: string; time?: { updated?: number } }[] }
        | { id: string; time?: { updated?: number } }[];
    const list = Array.isArray(body) ? body : (body.data ?? []);
    const cutoff = Date.now() - maxAgeMs;
    const targets = list
        .filter((s) => typeof s.id === "string" && (s.time?.updated ?? 0) >= cutoff)
        .slice(0, 5);
    let rows = 0;
    for (const t of targets) {
        try {
            const r = await syncMessages(server, t.id);
            rows += r.rows;
        } catch {
            // 다음 주기가 잡는다
        }
    }
    return { sessions: targets.length, rows };
}
