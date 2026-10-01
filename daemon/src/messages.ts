import { apiGet, type DiscoveredServer } from "./server";
import { formatToolExit } from "./tools";
import { db } from "./db";
import { readState } from "./device";

interface ServerMessage {
    id: string;
    type: string;
    time?: { created?: number };
    text?: string;
    payload?: { text?: string };
    content?: {
        type: string;
        text?: string;
        name?: string;
        state?: { input?: unknown; content?: { type?: string; text?: string }[] };
    }[];
    summary?: string;
}

interface PlainRow {
    seq: number;
    role: string;
    kind: string;
    body: string;
    createdAt: number | null;
}

function cap(text: string, limit: number): string {
    return text.length > limit ? `${text.slice(0, limit)}…[truncated]` : text;
}

function at(m: ServerMessage): number | null {
    return typeof m.time?.created === "number" ? m.time.created : null;
}

// 텍스트 항상, tool은 메타만, payload·첨부 제외.
function flatten(messages: ServerMessage[]): PlainRow[] {
    const rows: PlainRow[] = [];
    messages.forEach((m, seq) => {
        const createdAt = at(m);
        if (m.type === "user") {
            const text = m.text ?? m.payload?.text ?? "";
            if (text.length > 0) {
                rows.push({ seq, role: "user", kind: "text", body: cap(text, 8000), createdAt });
            }
            const files = (m as { files?: { name?: string; mime?: string; data?: string }[] }).files ?? [];
            for (const f of files) {
                const kb = f.data ? Math.round(f.data.length / 1024) : 0;
                rows.push({ seq, role: "user", kind: "file", body: `${f.name ?? "file"} (${f.mime ?? "?"}, ${kb}KB, on-demand)`, createdAt });
            }
            return;
        }
        if (m.type === "assistant") {
            for (const part of m.content ?? []) {
                if (part.type === "text" && part.text && part.text.length > 0) {
                    rows.push({ seq, role: "assistant", kind: "text", body: cap(part.text, 8000), createdAt });
                } else if (part.type === "tool") {
                    const toolName = part.name ?? "tool";
                    const outputs = part.state?.content ?? [];
                    const texts = outputs.filter((o) => o.type === "text").map((o) => o.text ?? "");
                    const exit = formatToolExit(toolName, texts.join("\n"));
                    const hasImage = outputs.some((o) => o.type === "file");
                    const raw = ((part.state?.input ?? {}) as Record<string, unknown>);
                    const kept: Record<string, unknown> = {};
                    const stripped: string[] = [];
                    for (const [key, value] of Object.entries(raw)) {
                        if ((key === "content" || key === "data") && typeof value === "string" && value.length > 500) {
                            stripped.push(`${key}:${Math.round(value.length / 1024)}KB`);
                            continue;
                        }
                        kept[key] = value;
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
                    rows.push({ seq, role: "assistant", kind: "tool", body: cap(JSON.stringify(envelope), 4000), createdAt });
                }
            }
            return;
        }
        if (m.type === "compaction") {
            const summary = (m as { summary?: string }).summary ?? "";
            if (summary.length > 0) {
                rows.push({ seq, role: "system", kind: "summary", body: cap(summary, 8000), createdAt });
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
        if (r.createdAt !== null) {
            await sql`
                INSERT INTO cloud_messages (tab_id, seq, role, kind, body, created_at)
                VALUES (${sessionID}, ${r.seq}, ${r.role}, ${r.kind}, ${r.body}, to_timestamp(${r.createdAt / 1000.0}))
                ON CONFLICT (tab_id, seq) DO NOTHING
            `;
        } else {
            await sql`
                INSERT INTO cloud_messages (tab_id, seq, role, kind, body)
                VALUES (${sessionID}, ${r.seq}, ${r.role}, ${r.kind}, ${r.body})
                ON CONFLICT (tab_id, seq) DO NOTHING
            `;
        }
    }
    return { rows: rows.length };
}
