import { apiGet, type DiscoveredServer } from "./server";
import { cloudPost } from "./cloud";
import { sessionUsage } from "./localdb";

interface SessionListItem {
    id: string;
    agent?: string;
    model?: { id: string; providerID: string; variant?: string };
    time?: { updated?: number };
}

interface SessionDetail {
    title?: string;
    cost?: number;
    time?: { created?: number };
}

// 전 세션 헤더를 클라우드 거울에 올린다. agent·model 현재값 + 마지막 호출 토큰·횟수 포함.
export async function syncSessions(server: DiscoveredServer, progress = false): Promise<{ sessions: number }> {
    const sessions: {
        id: string;
        title?: string;
        status?: string;
        agent?: string;
        model?: unknown;
        provider?: string;
        cost?: number;
        lastInput?: number | null;
        lastOutput?: number | null;
        lastReasoning?: number | null;
        lastCacheRead?: number | null;
        lastCacheWrite?: number | null;
        msgUser?: number;
        msgAssistant?: number;
        sessionCreatedAt?: number | null;
    }[] = [];
    const body = (await apiGet(server, "/session")) as { data?: SessionListItem[] } | SessionListItem[];
    const list = Array.isArray(body) ? body : (body.data ?? []);
    for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (progress) {
            process.stdout.write(`\rFinding your tabs... ${i + 1}/${list.length}`);
        }
        let title: string | null = null;
        let cost: number | undefined;
        let created: number | null = null;
        try {
            const detail = (await apiGet(server, `/session/${s.id}`)) as { data?: SessionDetail } | SessionDetail;
            const row = (detail as { data?: SessionDetail }).data ?? (detail as SessionDetail);
            title = row.title ?? null;
            cost = typeof row.cost === "number" ? row.cost : undefined;
            created = row.time?.created ?? null;
        } catch {
            title = null;
        }
        let usage = { input: null, output: null, reasoning: null, cacheRead: null, cacheWrite: null, msgUser: 0, msgAssistant: 0 } as {
            input: number | null;
            output: number | null;
            reasoning: number | null;
            cacheRead: number | null;
            cacheWrite: number | null;
            msgUser: number;
            msgAssistant: number;
        };
        try {
            usage = sessionUsage(s.id);
        } catch {
            // 로컬 DB 없으면 null/0 유지
        }
        sessions.push({
            id: s.id,
            title: title ?? undefined,
            status: "active",
            agent: s.agent,
            model: s.model,
            provider: s.model?.providerID,
            cost,
            lastInput: usage.input,
            lastOutput: usage.output,
            lastReasoning: usage.reasoning,
            lastCacheRead: usage.cacheRead,
            lastCacheWrite: usage.cacheWrite,
            msgUser: usage.msgUser,
            msgAssistant: usage.msgAssistant,
            sessionCreatedAt: created,
        });
    }
    if (progress) {
        process.stdout.write("\n");
    }
    const result = (await cloudPost("/api/sync", { sessions })) as { data?: { sessions?: number } };
    return { sessions: result.data?.sessions ?? sessions.length };
}
