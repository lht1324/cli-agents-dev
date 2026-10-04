import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { DiscoveredServer } from "./server";
import { syncMessages } from "./messages";
import { pushPending } from "./permissions";
import { syncSessions } from "./sessions";

export function spoolDir(): string {
    return join(homedir(), ".config", "cliagent", "spool");
}

interface SpoolEvent {
    type?: string;
    sessionID?: string | null;
}

// 스풀 비우기. 갈고리 1건당 필요한 동기화만 실행한다.
export async function drainSpool(server: DiscoveredServer): Promise<{ drained: number }> {
    mkdirSync(spoolDir(), { recursive: true });
    const files = readdirSync(spoolDir())
        .filter((f) => f.endsWith(".json"))
        .slice(0, 20);
    let drained = 0;
    const messaged = new Set<string>();
    let needPending = false;
    let needSessions = false;
    for (const file of files) {
        try {
            const raw = JSON.parse(readFileSync(join(spoolDir(), file), "utf8")) as SpoolEvent;
            const type = raw.type ?? "";
            if (type.startsWith("message.") && raw.sessionID) {
                messaged.add(raw.sessionID);
            } else if (type.startsWith("permission.")) {
                needPending = true;
            } else if (type.startsWith("session.")) {
                needSessions = true;
            }
        } catch {
            // 깨진 줄은 버린다
        } finally {
            try {
                unlinkSync(join(spoolDir(), file));
            } catch {
                // 무시
            }
        }
        drained++;
    }
    for (const sessionID of messaged) {
        try {
            await syncMessages(server, sessionID);
        } catch {
            // 다음 주기가 잡는다
        }
    }
    if (needPending) {
        try {
            await pushPending(server);
        } catch {
            // 다음 주기가 잡는다
        }
    }
    if (needSessions) {
        try {
            await syncSessions(server);
        } catch {
            // 다음 주기가 잡는다
        }
    }
    return { drained };
}
