"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { messagesClientAPI, type LiveThread } from "@/lib/api/client/messagesClientAPI";
import type { ThreadRow } from "@/components/page/sessions/SessionDetailClient";

// 스레드 실시간 폴링. 5초마다 스레드·presence·마지막 명령 결과를 다시 가져온다.
// 탭이 숨겨지면 쉰다. 메모리는 타이머 1개 + 진행 중 fetch 1방뿐이다.
export function useLiveThread(
    tabId: string,
    initial: ThreadRow[],
    initialSeenAt: string | null,
    initialSyncAt: string | null,
): {
    thread: ThreadRow[];
    deviceLastSeenAt: string | null;
    lastSyncAt: string | null;
    lastCommand: LiveThread["lastCommand"];
} {
    const [thread, setThread] = useState<ThreadRow[]>(initial);
    const [deviceLastSeenAt, setDeviceLastSeenAt] = useState<string | null>(initialSeenAt);
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(initialSyncAt);
    const [lastCommand, setLastCommand] = useState<LiveThread["lastCommand"]>(null);
    const tabIdRef = useRef(tabId);
    tabIdRef.current = tabId;

    const tick = useCallback(async () => {
        if (document.hidden) {
            return;
        }
        const result = await messagesClientAPI.getThread(tabIdRef.current);
        if (!result.ok) {
            return;
        }
        setThread(result.data.messages);
        setDeviceLastSeenAt(result.data.deviceLastSeenAt);
        setLastSyncAt(result.data.lastSyncAt);
        setLastCommand(result.data.lastCommand);
    }, []);

    useEffect(() => {
        setThread(initial);
        setDeviceLastSeenAt(initialSeenAt);
        setLastSyncAt(initialSyncAt);
        const timer = setInterval(() => void tick(), 5000);
        return () => clearInterval(timer);
    }, [tabId, tick]); // eslint-disable-line react-hooks/exhaustive-deps

    return { thread, deviceLastSeenAt, lastSyncAt, lastCommand };
}
