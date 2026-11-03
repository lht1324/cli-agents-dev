import { getFetch } from "./baseFetch";
import { readBaseResponse } from "./readBaseResponse";
import type { MessageRow } from "./sessionsClientAPI";

export interface ThreadPayload {
    messages: MessageRow[];
    deviceLastSeenAt: string | null;
    lastSyncAt: string | null;
    lastCommand: { type: string; status: string; result: string | null; createdAt: string | null } | null;
}

// 서버 파라미터는 아직 tabId지만 화면 용어는 session이다 (파라미터 개명은 별도 작업).
export const messagesClientAPI = {
    async getMessagesBySessionId(sessionId: string): Promise<ThreadPayload | null> {
        return readBaseResponse<ThreadPayload>(await getFetch(`/api/web/messages?tabId=${encodeURIComponent(sessionId)}`));
    },
};
