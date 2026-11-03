import { getFetch } from "./baseFetch";
import { readBaseResponse } from "./readBaseResponse";

export interface SessionRow {
    id: string;
    title: string;
    status: string;
    lastSyncAt: string | null;
    lastBodySyncAt: string | null;
    updatedAt: string;
    live: boolean;
}

export interface WaitingHandoff {
    newTabs: number;
    updatedTabs: number;
}

export interface SessionListResult {
    items: SessionRow[];
    waiting: WaitingHandoff | null;
}

export interface SubagentRow {
    id: string;
    title: string;
    synced: boolean;
}

export interface ApprovalRow {
    id: string;
    deviceId: string;
    action: string;
    resources: string;
    message: string | null;
}

export interface MessageRow {
    id: string;
    seq: number;
    role: string;
    kind: string;
    body: string;
    createdAt: string | null;
}

export interface CommandTarget {
    deviceId: string;
    label: string;
    lastSeenAt: string | null;
    active: boolean;
}

export interface SessionStats {
    cost: number | null;
    input: number | null;
    output: number | null;
    reasoning: number | null;
    cacheRead: number | null;
    cacheWrite: number | null;
    msgUser: number | null;
    msgAssistant: number | null;
    createdAt: string | null;
}

export interface SessionInfo {
    id: string;
    title: string;
    status: string;
    deviceId: string;
    agent: string | null;
    model: string | null;
    lastSyncAt: string | null;
    deviceLastSeenAt: string | null;
    parentId: string | null;
    readOnly: boolean;
}

export interface SessionDetail {
    info: SessionInfo;
    approvals: ApprovalRow[];
    messages: MessageRow[];
    stats: SessionStats;
    targets: CommandTarget[];
    defaultTarget: string | null;
    catalogJson: string | null;
    subagents: SubagentRow[];
}

export const sessionsClientAPI = {
    async getSessions(): Promise<SessionListResult | null> {
        return readBaseResponse<SessionListResult>(await getFetch("/api/web/sessions"));
    },

    async getSessionById(sessionId: string): Promise<SessionDetail | null> {
        return readBaseResponse<SessionDetail>(await getFetch(`/api/web/sessions/${encodeURIComponent(sessionId)}`));
    },
};
