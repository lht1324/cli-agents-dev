import { getFetch } from "./baseFetch";
import type { ThreadRow } from "@/components/page/sessions/SessionDetailClient";

export interface LiveThread {
    messages: ThreadRow[];
    deviceLastSeenAt: string | null;
    lastSyncAt: string | null;
}

export const messagesClientAPI = {
    async getThread(tabId: string): Promise<LiveThread | null> {
        try {
            const response = await getFetch(`/api/messages?tabId=${encodeURIComponent(tabId)}`);
            const result = (await response.json()) as {
                success?: boolean;
                data?: { messages?: ThreadRow[]; deviceLastSeenAt?: string | null; lastSyncAt?: string | null };
            };
            if (!result.success || !Array.isArray(result.data?.messages)) {
                return null;
            }
            return {
                messages: result.data.messages,
                deviceLastSeenAt: result.data.deviceLastSeenAt ?? null,
                lastSyncAt: result.data.lastSyncAt ?? null,
            };
        } catch (error) {
            // 5초 폴링이라 실패는 조용히 넘긴다. 다음 틱이 잡는다.
            console.warn("getThread failed:", error instanceof Error ? error.message : error);
            return null;
        }
    },
};
