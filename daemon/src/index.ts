import { apiGet, apiPost, discoverServer, type DiscoveredServer } from "./server";
import { hostInfo, newDeviceId, readState, writeState, baseUrl } from "./device";
import { forkAndRegister } from "./fork";
import { ensureServer, type ManagedServer } from "./serve";
import { syncSessions } from "./sessions";
import { setSessionAgent, setSessionModel, syncCatalog, type ModelRef } from "./catalog";
import { syncActiveMessages, syncMessages } from "./messages";
import { listPending, reply, pushPending, type ReplyDecision } from "./permissions";
import { pollCommands } from "./commands";

interface SessionRow {
    id: string;
    title?: string;
    outcome?: string;
    time?: { updated?: number };
}

async function requireServer(): Promise<DiscoveredServer> {
    const server = await discoverServer();
    if (!server) {
        throw new Error("no running opencode server found. start `opencode serve` or open the desktop app first");
    }
    return server;
}

async function onStatus(): Promise<void> {
    const server = await ensureServer();
    console.log(`server: ${server.url}${server.version ? ` (v${server.version})` : ""}`);
}

async function onSessions(): Promise<void> {
    const server = await ensureServer();
    const body = (await apiGet(server, "/session")) as { data?: SessionRow[] } | SessionRow[];
    const sessions = Array.isArray(body) ? body : (body.data ?? []);
    for (const s of sessions) {
        console.log(`${s.id}\t${s.title ?? s.outcome ?? "(untitled)"}`);
    }
    console.log(`total: ${sessions.length}`);
}

async function onLogin(): Promise<void> {
    const { createServer } = await import("node:http");
    const { exec } = await import("node:child_process");
    const { platform } = await import("node:os");
    const { newDeviceId, writeState, hostInfo, baseUrl } = await import("./device.js");
    const deviceId = newDeviceId();
    const host = hostInfo();
    const state = Math.random().toString(36).slice(2, 10);
    const received = await new Promise<{ token: string }>((resolve, reject) => {
        const server = createServer((req, res) => {
            const url = new URL(req.url ?? "/", "http://127.0.0.1");
            if (url.pathname !== "/callback") {
                res.writeHead(404);
                res.end();
                return;
            }
            const token = url.searchParams.get("token") ?? "";
            const returned = url.searchParams.get("state") ?? "";
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("Connected. You can close this tab and return to the terminal.");
            server.close();
            if (returned !== state || token.length === 0) {
                reject(new Error("invalid callback. try again"));
                return;
            }
            resolve({ token });
        });
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            const port = typeof address === "object" && address ? address.port : 0;
            const params = new URLSearchParams({
                device: deviceId,
                port: String(port),
                state,
                label: host.label,
                platform: host.platform,
                hostname: host.hostname,
            });
            const target = `${baseUrl().replace(/\/$/, "")}/api/device/begin?${params.toString()}`;
            const opener =
                platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
            exec(`${opener} "${target}"`);
            console.log("opened browser. approve this device, then return here.");
            console.log(`if the browser did not open, visit:\n${target}`);
        });
        setTimeout(() => {
            server.close();
            reject(new Error("timed out waiting for browser. try again"));
        }, 5 * 60 * 1000).unref?.();
    }).catch((err: unknown) => {
        throw err;
    });
    const who = await fetch(`${baseUrl()}/api/auth/whoami`, {
        headers: { Authorization: `Bearer ${received.token}` },
        signal: AbortSignal.timeout(10000),
    });
    if (!who.ok) {
        throw new Error(`whoami rejected: ${who.status}`);
    }
    const body = (await who.json()) as { data?: { userId?: string } };
    const userId = body.data?.userId;
    if (!userId) {
        throw new Error("whoami returned no user");
    }
    writeState({ deviceId, userId, token: received.token });
    console.log(`logged in: ${deviceId} (${host.label})`);
}

async function onRegister(userId: string | undefined, deviceId: string | undefined): Promise<void> {
    if (!userId) {
        throw new Error("usage: cliagent register <user-id> [device-id]");
    }
    const id = deviceId ?? newDeviceId();
    writeState({ deviceId: id, userId });
    const host = hostInfo();
    console.log(`registered: ${id} (${host.label})`);
}

async function onApprove(requestID: string | undefined, decision: string | undefined): Promise<void> {
    const server = await ensureServer();
    if (!requestID) {
        const pending = await listPending(server);
        if (pending.length === 0) {
            console.log("no pending requests");
            return;
        }
        for (const p of pending) {
            console.log(`${p.id}\tsession=${p.sessionID}\taction=${p.action}\tresources=${p.resources.join(",")}${p.message ? `\t${p.message.slice(0, 120)}` : ""}`);
        }
        return;
    }
    if (decision !== "once" && decision !== "always" && decision !== "reject") {
        throw new Error("usage: cliagent approve <request-id> <once|always|reject>");
    }
    const pending = await listPending(server);
    const target = pending.find((p) => p.id === requestID);
    if (!target) {
        throw new Error(`request not found or already resolved: ${requestID}`);
    }
    await reply(server, target.sessionID, requestID, decision as ReplyDecision);
    console.log(`replied: ${requestID} -> ${decision}`);
}

async function onFork(sessionID: string | undefined): Promise<void> {
    if (!sessionID) {
        throw new Error("usage: cliagent fork <session-id>");
    }
    const server = await ensureServer();
    const id = await forkAndRegister(server, sessionID);
    console.log(`forked: ${id}`);
}

async function onSyncMessages(sessionID: string | undefined): Promise<void> {
    if (!sessionID) {
        throw new Error("usage: cliagent sync-messages <session-id>");
    }
    const server = await ensureServer();
    const result = await syncMessages(server, sessionID);
    console.log(`synced: ${result.rows} rows`);
}

async function onSync(): Promise<void> {
    const server = await ensureServer();
    const result = await pushPending(server);
    console.log(`pushed: ${result.open} open`);
}

async function onSyncModels(): Promise<void> {
    const server = await ensureServer();
    const result = await syncCatalog(server);
    console.log(`catalog: ${result.models} models, ${result.agents} agents`);
}

async function onSyncSessions(): Promise<void> {
    const server = await ensureServer();
    const result = await syncSessions(server);
    console.log(`sessions: ${result.sessions}`);
}

async function onToken(token: string | undefined): Promise<void> {
    if (!token) {
        throw new Error("usage: cliagent token <device-token>");
    }
    const state = readState();
    if (!state) {
        throw new Error("not registered. run `cliagent register <user-id>` first");
    }
    writeState({ ...state, token });
    console.log("token saved");
}

async function onDoctor(): Promise<void> {
    const lines: string[] = [];
    try {
        const server = await requireServer();
        lines.push(`server: ok (${server.url}${server.version ? ` v${server.version}` : ""})`);
        try {
            const sessions = (await apiGet(server, "/session")) as { data?: unknown[] } | unknown[];
            const count = Array.isArray(sessions) ? sessions.length : (sessions.data?.length ?? 0);
            lines.push(`sessions: ok (${count})`);
        } catch (err) {
            lines.push(`sessions: FAIL (${err instanceof Error ? err.message : err})`);
        }
    } catch (err) {
        lines.push(`server: FAIL (${err instanceof Error ? err.message : err})`);
    }
    try {
        const state = readState();
        lines.push(state ? `state: ok (${state.deviceId})` : "state: FAIL (not registered)");
    } catch (err) {
        lines.push(`state: FAIL (${err instanceof Error ? err.message : err})`);
    }
    try {
        const state = readState();
        if (!state?.token) {
            lines.push("cloud: FAIL (no device token)");
        } else {
            const res = await fetch(`${baseUrl()}/api/heartbeat`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
                body: JSON.stringify({}),
                signal: AbortSignal.timeout(10000),
            });
            lines.push(res.ok ? "cloud: ok (api)" : `cloud: FAIL (${res.status})`);
        }
    } catch (err) {
        lines.push(`cloud: FAIL (${err instanceof Error ? err.message : err})`);
    }
    for (const line of lines) {
        console.log(line);
    }
}
async function onHeartbeat(): Promise<number> {
    const state = readState();
    if (!state) {
        throw new Error("not registered. run `cliagent register <user-id>` first");
    }
    if (!state.token) {
        throw new Error("no device token. run `cliagent token <device-token>` first");
    }
    const host = hostInfo();
    const res = await fetch(`${baseUrl()}/api/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
        body: JSON.stringify({ platform: host.platform, hostname: host.hostname, label: host.label }),
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
        throw new Error(`heartbeat rejected: ${res.status}`);
    }
    const body = (await res.json()) as { data?: { intervalSec?: number } };
    const intervalSec = body.data?.intervalSec;
    console.log(`heartbeat: ${state.deviceId} (${host.label}) via api`);
    return typeof intervalSec === "number" && intervalSec > 0 ? intervalSec : 1800;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// 묶음 동기화 1회: heartbeat·승인거울·세션헤더·카탈로그.
async function onPush(): Promise<void> {
    const server = await ensureServer();
    const intervalSec = await onHeartbeat();
    const pending = await pushPending(server);
    console.log(`pushed: ${pending.open} open`);
    const sessions = await syncSessions(server);
    console.log(`sessions: ${sessions.sessions}`);
    const catalog = await syncCatalog(server);
    console.log(`catalog: ${catalog.models} models, ${catalog.agents} agents`);
    console.log(`interval: ${intervalSec}s`);
}

// 상주 루프. heartbeat·sync·poll을 주기마다 순서대로. 1개 실패해도 계속.
async function onRun(): Promise<void> {
    const state = readState();
    if (!state) {
        throw new Error("not registered. run `cliagent register <user-id>` first");
    }
    let stopping = false;
    const stop = () => {
        stopping = true;
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    console.log(`run: device=${state.deviceId}`);
    let intervalSec = 1800;
    let lastSlow = 0;
    let owned: ManagedServer | null = null;
    try {
        owned = await ensureServer();
        if (owned.child) {
            console.log(`run: spawned server at ${owned.url}`);
        }
    } catch (err) {
        console.error(`server ensure failed: ${err instanceof Error ? err.message : err}`);
    }
    while (!stopping) {
        const now = Date.now();
        // 느린 층: 플랜 주기. heartbeat·거울·카탈로그·안전망. 무겁다.
        if (now - lastSlow >= intervalSec * 1000) {
            lastSlow = now;
            try {
                intervalSec = await onHeartbeat();
            } catch (err) {
                console.error(`heartbeat failed: ${err instanceof Error ? err.message : err}`);
            }
            try {
                const server = await ensureServer();
                await pushPending(server);
                await syncSessions(server);
                await syncCatalog(server);
                const active = await syncActiveMessages(server);
                if (active.sessions > 0) {
                    console.log(`active-messages: ${active.sessions} sessions, ${active.rows} rows`);
                }
            } catch (err) {
                console.error(`sync failed: ${err instanceof Error ? err.message : err}`);
            }
            console.log(`run: slow done, next in ${intervalSec}s`);
        }
        // 빠른 층: 10초. 스풀 비우기 + 명령 가져오기. 둘 다 싸다. 플러그인 통지의 즉시 반영이 여기다.
        try {
            await pollCommands();
        } catch (err) {
            console.error(`poll failed: ${err instanceof Error ? err.message : err}`);
        }
        const deadline = Date.now() + 10000;
        while (!stopping && Date.now() < deadline) {
            await sleep(Math.min(1000, deadline - Date.now()));
        }
    }
    try {
        await onHeartbeat();
    } catch {
        // best-effort flush only
    }
    owned?.child?.kill();
    console.log("run: stopped");
}

async function main(): Promise<void> {
    const cmd = process.argv[2];
    if (cmd === "status") {
        await onStatus();
    } else if (cmd === "sessions") {
        await onSessions();
    } else if (cmd === "login") {
        await onLogin();
    } else if (cmd === "register") {
        await onRegister(process.argv[3], process.argv[4]);
    } else if (cmd === "heartbeat") {
        await onHeartbeat();
    } else if (cmd === "token") {
        await onToken(process.argv[3]);
    } else if (cmd === "sync") {
        await onSync();
    } else if (cmd === "fork") {
        await onFork(process.argv[3]);
    } else if (cmd === "sync-messages") {
        await onSyncMessages(process.argv[3]);
    } else if (cmd === "sync-models") {
        await onSyncModels();
    } else if (cmd === "sync-sessions") {
        await onSyncSessions();
    } else if (cmd === "push") {
        const server = await ensureServer();
        const intervalSec = await onHeartbeat();
        const pending = await pushPending(server);
        console.log(`pushed: ${pending.open} open`);
        const sessions = await syncSessions(server);
        console.log(`sessions: ${sessions.sessions}`);
        const catalog = await syncCatalog(server);
        console.log(`catalog: ${catalog.models} models, ${catalog.agents} agents`);
        console.log(`interval: ${intervalSec}s`);
    } else if (cmd === "run") {
        await onRun();
    } else if (cmd === "poll") {
        await pollCommands();
    } else if (cmd === "approve") {
        await onApprove(process.argv[3], process.argv[4]);
    } else {
        console.log("usage: cliagent <login|register|token|status|sessions|poll|heartbeat|approve|sync|fork|sync-messages|sync-models|sync-sessions|push|run>");
        process.exitCode = 1;
    }
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
});
