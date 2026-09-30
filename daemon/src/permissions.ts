import { apiGet, apiPost, discoverServer, type DiscoveredServer } from "./server";
import { db } from "./db";
import { readState } from "./device";

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

// 로컬 pending을 클라우드 거울에 올린다. 사라진 건 resolved로 표시.
export async function pushPending(server: DiscoveredServer): Promise<{ open: number }> {
    const state = readState();
    if (!state) {
        throw new Error("not registered. run `cliagent register <user-id>` first");
    }
    const pending = await listPending(server);
    const sql = db();
    const seen = new Set<string>();
    for (const p of pending) {
        seen.add(p.id);
        await sql`
            INSERT INTO pending_approvals (id, user_id, device_id, session_id, action, resources, message, status)
            VALUES (${p.id}, ${state.userId}, ${state.deviceId}, ${p.sessionID}, ${p.action}, ${p.resources.join(",")}, ${p.message ?? null}, 'open')
            ON CONFLICT (id) DO NOTHING
        `;
    }
    if (seen.size > 0) {
        const ids = [...seen];
        await sql`
            UPDATE pending_approvals SET status = 'resolved', resolved_at = NOW()
            WHERE device_id = ${state.deviceId} AND status = 'open' AND NOT (id = ANY(${ids}))
        `;
    } else {
        await sql`
            UPDATE pending_approvals SET status = 'resolved', resolved_at = NOW()
            WHERE device_id = ${state.deviceId} AND status = 'open'
        `;
    }
    return { open: pending.length };
}
