import { apiGet, apiPost, type DiscoveredServer } from "./server";

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
