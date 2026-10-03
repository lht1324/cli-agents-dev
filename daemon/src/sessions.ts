import { apiGet, type DiscoveredServer } from "./server";
import { cloudPost } from "./cloud";

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
    const sessions: { id: string; title?: string; status?: string; agent?: string; model?: unknown; provider?: string }[] = [];
    const body = (await apiGet(server, "/session")) as { data?: SessionListItem[] } | SessionListItem[];
    const list = Array.isArray(body) ? body : (body.data ?? []);
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
        sessions.push({
            id: s.id,
            title: title ?? undefined,
            status: "active",
            agent: s.agent,
            model: s.model,
            provider: s.model?.providerID,
        });
    }
    const result = (await cloudPost("/api/sync", { sessions })) as { data?: { sessions?: number } };
    return { sessions: result.data?.sessions ?? sessions.length };
}
