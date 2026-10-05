import { apiGet, type DiscoveredServer } from "./server";
import { formatToolExit } from "./tools";
import { cloudPost } from "./cloud";

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
    id: string;
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
                rows.push({ id: key(), seq, role: "system", kind: "summary", body: cap(summary, 8000), createdAt });
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
    const result = (await cloudPost("/api/messages", {
        messages: rows.map((r) => ({
            sessionID,
            messageId: r.id,
            seq: r.seq,
            role: r.role,
            kind: r.kind,
            body: r.body,
            createdAt: r.createdAt,
        })),
    })) as { data?: { rows?: number } };
    return { rows: result.data?.rows ?? rows.length };
}
