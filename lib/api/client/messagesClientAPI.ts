import { getFetch } from "./baseFetch";
import { toFailure, type ClientResult } from "./result";
import type { ThreadRow } from "@/components/page/sessions/SessionDetailClient";

export interface LiveThread {
    messages: ThreadRow[];
    deviceLastSeenAt: string | null;
    lastSyncAt: string | null;
    lastCommand: { type: string; status: string; result: string | null; createdAt: string | null } | null;
}

interface ThreadBody {
    success?: boolean;
    error?: string;
    data?: {
        messages?: ThreadRow[];
        deviceLastSeenAt?: string | null;
        lastSyncAt?: string | null;
        lastCommand?: LiveThread["lastCommand"];
    };
}

export const messagesClientAPI = {
    // 상세 화면 5초 폴링용. 실패는 조용히 넘긴다 — 다음 틱이 잡는다.
    async getThread(tabId: string): Promise<ClientResult<LiveThread>> {
        try {
            const res = await getFetch(`/api/web/messages?tabId=${encodeURIComponent(tabId)}`);
            const body = (await res.json()) as ThreadBody;
            const messages = body.data?.messages;
            if (!body.success || !Array.isArray(messages)) {
                return { ok: false, status: res.status, error: body.error };
            }
            return {
                ok: true,
                data: {
                    messages,
                    deviceLastSeenAt: body.data?.deviceLastSeenAt ?? null,
                    lastSyncAt: body.data?.lastSyncAt ?? null,
                    lastCommand: body.data?.lastCommand ?? null,
                },
            };
        } catch (error) {
            return toFailure(error);
        }
    },
};
