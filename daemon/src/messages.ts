import { apiGet, type DiscoveredServer } from "./server";
import { db } from "./db";
import { readState } from "./device";

interface ServerMessage {
    id: string;
    type: string;
    time?: { created?: number };
    text?: string;
    payload?: { text?: string };
    content?: { type: string; text?: string; name?: string; state?: { input?: unknown } }[];
    summary?: string;
}

interface PlainRow {
    seq: number;
    role: string;
    kind: string;
    body: string;
}

function cap(text: string, limit: number): string {
    return text.length > limit ? `${text.slice(0, limit)}…[truncated]` : text;
}

// 텍스트 항상, tool은 메타만, payload·첨부 제외.
function flatten(messages: ServerMessage[]): PlainRow[] {
    const rows: PlainRow[] = [];
    messages.forEach((m, seq) => {
        if (m.type === "user") {
            const text = m.text ?? m.payload?.text ?? "";
            if (text.length > 0) {
                rows.push({ seq, role: "user", kind: "text", body: cap(text, 8000) });
            }
            const files = (m as { files?: { name?: string; mime?: string; data?: string }[] }).files ?? [];
            for (const f of files) {
                const kb = f.data ? Math.round(f.data.length / 1024) : 0;
                rows.push({ seq, role: "user", kind: "file", body: `${f.name ?? "file"} (${f.mime ?? "?"}, ${kb}KB, on-demand)` });
            }
            return;
        }
        if (m.type === "assistant") {
            for (const part of m.content ?? []) {
                if (part.type === "text" && part.text && part.text.length > 0) {
                    rows.push({ seq, role: "assistant", kind: "text", body: cap(part.text, 8000) });
                } else if (part.type === "tool") {
                    const input = part.state?.input ? JSON.stringify(part.state.input).slice(0, 200) : "";
                    rows.push({ seq, role: "assistant", kind: "tool", body: `${part.name ?? "tool"} ${input}`.trim() });
                }
            }
            return;
        }
        if (m.type === "compaction") {
            const summary = (m as { summary?: string }).summary ?? "";
            if (summary.length > 0) {
                rows.push({ seq, role: "system", kind: "summary", body: cap(summary, 8000) });
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
    const state = readState();
    if (!state) {
        throw new Error("not registered. run `cliagent register <user-id>` first");
    }
    const messages = await fetchMessages(server, sessionID);
    const rows = flatten(messages);
    const sql = db();
    await sql`
        INSERT INTO cloud_tabs (id, user_id, device_id, provider, title, status)
        VALUES (${sessionID}, ${state.userId}, ${state.deviceId}, 'opencode', ${sessionID}, 'active')
        ON CONFLICT (id) DO NOTHING
    `;
    for (const r of rows) {
        await sql`
            INSERT INTO cloud_messages (tab_id, seq, role, kind, body)
            VALUES (${sessionID}, ${r.seq}, ${r.role}, ${r.kind}, ${r.body})
            ON CONFLICT (tab_id, seq) DO NOTHING
        `;
    }
    return { rows: rows.length };
}
