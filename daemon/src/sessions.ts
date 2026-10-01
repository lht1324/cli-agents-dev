import { apiGet, type DiscoveredServer } from "./server";
import { db } from "./db";
import { readState } from "./device";

interface SessionListItem {
    id: string;
    agent?: string;
    model?: { id: string; providerID: string; variant?: string };
    time?: { updated?: number };
}

interface SessionDetail {
    title?: string;
}

// 전 세션 헤더를 클라우드 거울에 올린다. agent·model 현재값 포함.
export async function syncSessions(server: DiscoveredServer): Promise<{ sessions: number }> {
    const state = readState();
    if (!state) {
        throw new Error("not registered. run `cliagent register <user-id>` first");
    }
    const body = (await apiGet(server, "/session")) as { data?: SessionListItem[] } | SessionListItem[];
    const list = Array.isArray(body) ? body : (body.data ?? []);
    const sql = db();
    for (const s of list) {
        let title: string | null = null;
        try {
            const detail = (await apiGet(server, `/session/${s.id}`)) as
                | { data?: { title?: string } }
                | { title?: string };
            const row = (detail as { data?: { title?: string } }).data ?? detail;
            title = (row as { title?: string }).title ?? null;
        } catch {
            title = null;
        }
        await sql`
            INSERT INTO sessions_meta (id, device_id, provider, title, status, agent, model, updated_at)
            VALUES (
                ${s.id}, ${state.deviceId}, ${s.model?.providerID ?? "opencode"},
                ${title ?? s.id}, 'active',
                ${s.agent ?? null}, ${s.model ? JSON.stringify(s.model) : null}, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                agent = EXCLUDED.agent, model = EXCLUDED.model,
                status = EXCLUDED.status, updated_at = NOW()
        `;
    }
    return { sessions: list.length };
}
