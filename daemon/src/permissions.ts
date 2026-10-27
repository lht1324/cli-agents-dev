import { apiGet, apiPost, discoverServer, type DiscoveredServer } from "./server";
import { cloudPost } from "./cloud";

export interface PendingRequest {
    id: string;
    sessionID: string;
    action: string;
    resources: string[];
    message?: string;
}

export type ReplyDecision = "once" | "always" | "reject";

function unwrapList(body: unknown): PendingRequest[] {
    if (Array.isArray(body)) {
        return body as PendingRequest[];
    }
    const data = (body as { data?: unknown }).data;
    return Array.isArray(data) ? (data as PendingRequest[]) : [];
}

export async function listPending(server: DiscoveredServer): Promise<PendingRequest[]> {
    const body = await apiGet(server, "/permission/request");
    return unwrapList(body);
}

export async function reply(server: DiscoveredServer, sessionID: string, requestID: string, decision: ReplyDecision): Promise<void> {
    await apiPost(server, `/session/${sessionID}/permission/${requestID}/reply`, { decision });
}

// 로컬 pending을 클라우드 거울에 올린다. 사라진 건 서버가 resolved로 표시.
export async function pushPending(server: DiscoveredServer): Promise<{ open: number }> {
    const pending = await listPending(server);
    const result = (await cloudPost("/api/sync", {
        approvals: pending.map((p) => ({
            id: p.id,
            sessionID: p.sessionID,
            action: p.action,
            resources: p.resources,
            message: p.message ?? null,
        })),
    })) as { data?: { approvals?: number } };
    return { open: result.data?.approvals ?? pending.length };
}
