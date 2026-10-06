"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ThreadRow } from "@/components/page/sessions/SessionDetailClient";

// 스레드 실시간 폴링. 5초마다 스레드+presence만 다시 가져온다. 탭이 숨겨지면 쉰다.
// 메모리는 타이머 1개 + 진행 중 fetch 1방뿐이다.
export function useLiveThread(tabId: string, initial: ThreadRow[], initialSeenAt: string | null, initialSyncAt: string | null): {
    thread: ThreadRow[];
    deviceLastSeenAt: string | null;
    lastSyncAt: string | null;
} {
    const [thread, setThread] = useState<ThreadRow[]>(initial);
    const [deviceLastSeenAt, setDeviceLastSeenAt] = useState<string | null>(initialSeenAt);
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(initialSyncAt);
    const tabIdRef = useRef(tabId);
    tabIdRef.current = tabId;

    const tick = useCallback(async () => {
        if (document.hidden) {
            return;
        }
        try {
            const res = await fetch(`/api/messages?tabId=${encodeURIComponent(tabIdRef.current)}`, {
                cache: "no-store",
            });
            if (!res.ok) {
                return;
            }
            const body = (await res.json()) as {
                data?: { messages?: ThreadRow[]; deviceLastSeenAt?: string | null; lastSyncAt?: string | null };
            };
            if (Array.isArray(body.data?.messages)) {
                setThread(body.data.messages);
            }
            if (body.data?.deviceLastSeenAt !== undefined) {
                setDeviceLastSeenAt(body.data.deviceLastSeenAt);
            }
            if (body.data?.lastSyncAt !== undefined) {
                setLastSyncAt(body.data.lastSyncAt);
            }
        } catch {
            // 다음 틱이 잡는다
        }
    }, []);

    useEffect(() => {
        setThread(initial);
        setDeviceLastSeenAt(initialSeenAt);
        setLastSyncAt(initialSyncAt);
        const timer = setInterval(() => void tick(), 5000);
        return () => clearInterval(timer);
    }, [tabId, tick]); // eslint-disable-line react-hooks/exhaustive-deps

    return { thread, deviceLastSeenAt, lastSyncAt };
}
