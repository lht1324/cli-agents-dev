// cliagents sync plugin. 변경 통지를 스풀에 적재한다. 데몬이 읽어간다.
// generic `event` 키가 아니라 종류별 키로 구독한다 (동작 확인 패턴).
export const CliagentsSync = async () => {
    const write = async (type, payload) => {
        try {
            const fs = await import("node:fs");
            const os = await import("node:os");
            const path = await import("node:path");
            const sessionID =
                payload?.sessionID ??
                payload?.sessionId ??
                payload?.event?.properties?.sessionID ??
                payload?.event?.sessionID ??
                null;
            const dir = path.join(os.homedir(), ".config", "cliagent", "spool");
            fs.mkdirSync(dir, { recursive: true });
            const line = JSON.stringify({ type, sessionID, at: Date.now() });
            const file = path.join(dir, `${Date.now()}-${Math.floor(Math.random() * 100000)}.json`);
            fs.writeFileSync(file, `${line}\n`);
        } catch {
            // 통지 실패는 무시한다. 폴링이 백업이다.
        }
    };
    const on = (type) => async (payload) => {
        await write(type, payload);
    };
    return {
        "tool.execute.after": on("tool.execute.after"),
        "permission.asked": on("permission.asked"),
        "permission.replied": on("permission.replied"),
        "session.created": on("session.created"),
        "session.updated": on("session.updated"),
        "session.idle": on("session.idle"),
        "session.compacted": on("session.compacted"),
        "session.deleted": on("session.deleted"),
    };
};
