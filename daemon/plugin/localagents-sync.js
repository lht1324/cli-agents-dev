// localagents sync plugin. 변경 통지를 스풀에 적재한다. 데몬이 읽어간다.
// v2 모양: default export { id, server, setup }.
// server(v1 호환) + setup(ctx.tool.hook + ctx.event.subscribe) 둘 다 둔다.

// 스트리밍 잡음 제외. 의미 있는 것만 적재한다.
// 텍스트 완성 신호(text.ended·step.ended·idle)가 순수 문답 동기화의 방아쇠다.
const KEEP = new Set([
    "tool.execute.after",
    "permission.asked",
    "permission.replied",
    "session.created",
    "session.updated",
    "session.idle",
    "session.compacted",
    "session.deleted",
    "session.error",
    "session.status",
    "session.text.ended",
    "session.step.ended",
    "message.completed",
    "message.updated",
]);

const spoolWrite = async (type, sessionID) => {
    if (!KEEP.has(type)) {
        return;
    }
    try {
        if (!type) {
            return;
        }
        const fs = await import("node:fs");
        const os = await import("node:os");
        const path = await import("node:path");
        const dir = path.join(os.homedir(), ".config", "localagents", "spool");
        fs.mkdirSync(dir, { recursive: true });
        const line = JSON.stringify({ type, sessionID: sessionID ?? null, at: Date.now() });
        const file = path.join(dir, `${Date.now()}-${Math.floor(Math.random() * 100000)}.json`);
        fs.writeFileSync(file, `${line}\n`);
    } catch {
        // 통지 실패는 무시한다. 폴링이 백업이다.
    }
};

const pickSession = (payload) => {
    if (!payload || typeof payload !== "object") {
        return null;
    }
    const seen = new Set();
    const queue = [payload];
    for (let i = 0; i < queue.length && i < 40; i++) {
        const node = queue[i];
        if (!node || typeof node !== "object" || seen.has(node)) {
            continue;
        }
        seen.add(node);
        for (const [k, v] of Object.entries(node)) {
            if ((k === "sessionID" || k === "sessionId" || k === "session_id") && typeof v === "string" && v.length > 0) {
                return v;
            }
        }
        for (const v of Object.values(node)) {
            if (v && typeof v === "object") {
                queue.push(v);
            }
        }
    }
    return null;
};

const server = async () => {
    const on = (type) => async (payload) => {
        await spoolWrite(type, pickSession(payload));
    };
    return {
        event: async ({ event }) => {
            const type = event?.type ?? "";
            if (type === "tool.execute.before" || type === "tool.execute.after") {
                return;
            }
            await spoolWrite(type, pickSession({ event }));
        },
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

const setup = async (ctx) => {
    const controller = new AbortController();
    try {
        if (ctx?.tool?.hook) {
            await ctx.tool.hook("execute.after", (event) => {
                spoolWrite("tool.execute.after", event?.sessionID ?? null);
            });
        }
    } catch {
        // 무시
    }
    (async () => {
        try {
            if (!ctx?.event?.subscribe) {
                return;
            }
            for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
                const type = event?.type ?? "";
                if (type === "tool.execute.before" || type === "tool.execute.after") {
                    continue;
                }
                await spoolWrite(type, pickSession({ event }));
            }
        } catch {
            // 구독 해제는 조용히
        }
    })();
    return () => controller.abort();
};

export default { id: "localagents-sync", server, setup };
