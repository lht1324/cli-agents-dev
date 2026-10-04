// cliagents sync plugin. OpenCode 안에서 변경 통지를 스풀에 적재한다.
// 데몬이 읽어간다. 네트워크 호출 없음. 실패해도 조용히 넘긴다.
export const CliagentsSync = async () => {
    try {
        const fs = await import("node:fs");
        const os = await import("node:os");
        const path = await import("node:path");
        const dir = path.join(os.homedir(), ".config", "cliagent", "spool");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "plugin-loaded.json"), JSON.stringify({ at: Date.now() }));
    } catch {
        // 무시
    };
    const interesting = (type) => {
        if (!type) {
            return false;
        }
        return (
            type.startsWith("message.") ||
            type.startsWith("session.") ||
            type.startsWith("permission.") ||
            type === "todo.updated"
        );
    };
    return {
        event: async ({ event }) => {
            try {
                if (!event || !interesting(event.type)) {
                    return;
                }
                const fs = await import("node:fs");
                const os = await import("node:os");
                const path = await import("node:path");
                const dir = path.join(os.homedir(), ".config", "cliagent", "spool");
                fs.mkdirSync(dir, { recursive: true });
                const line = JSON.stringify({
                    type: event.type,
                    sessionID:
                        event.sessionID ??
                        event.sessionId ??
                        event.properties?.sessionID ??
                        null,
                    at: Date.now(),
                });
                const file = path.join(dir, `${Date.now()}-${Math.floor(Math.random() * 100000)}.json`);
                fs.writeFileSync(file, `${line}\n`);
            } catch {
                // 통지 실패는 무시한다. 폴링이 백업이다.
            }
        },
    };
};
