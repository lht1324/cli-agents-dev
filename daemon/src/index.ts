import { apiGet, apiPost, discoverServer, type DiscoveredServer } from "./server";
import { hostInfo, readState, writeState, baseUrl } from "./device";
import { forkAndRegister } from "./fork";
import { ensureServer, killOwned, type ManagedServer } from "./serve";
import { syncSessions } from "./sessions";
import { setSessionAgent, setSessionModel, syncCatalog, type ModelRef } from "./catalog";
import { backfillMissing, syncActiveMessages, syncMessages } from "./messages";
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

function ago(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60) {
        return `${s}s ago`;
    }
    const m = Math.floor(s / 60);
    if (m < 60) {
        return `${m}m ago`;
    }
    const h = Math.floor(m / 60);
    if (h < 24) {
        return `${h}h ago`;
    }
    return `${Math.floor(h / 24)}d ago`;
}

async function onLogout(): Promise<void> {
    const { readState, clearState, baseUrl } = await import("./device.js");
    const state = readState();
    if (!state?.token) {
        throw new Error("not logged in. nothing to do");
    }
    // revoke 먼저. 실패하면 상태 유지 (살아있는 토큰 고아 방지).
    // 단 401은 서버에 세션이 없다는 뜻이라 로컬만 비운다.
    const res = await fetch(`${baseUrl()}/api/device/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${state.token}` },
        signal: AbortSignal.timeout(10000),
    });
    if (res.status === 401) {
        clearState();
        console.log(`already logged out (server has no session): ${state.deviceId}`);
        return;
    }
    if (!res.ok) {
        throw new Error(`revoke rejected: ${res.status}. state kept, try again online`);
    }
    clearState();
    console.log(`logged out: ${state.deviceId}`);
}

async function onWhoami(): Promise<void> {
    const state = readState();
    if (!state?.token) {
        throw new Error("not logged in. run `localagents login` first");
    }
    const res = await fetch(`${baseUrl()}/api/auth/whoami`, {
        headers: { Authorization: `Bearer ${state.token}` },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
        throw new Error(`whoami rejected: ${res.status}`);
    }
    const body = (await res.json()) as { data?: { email?: string | null; planId?: string } };
    console.log(`email: ${body.data?.email ?? "?"}`);
    console.log(`plan: ${body.data?.planId ?? "?"}`);
}

async function onStatus(): Promise<void> {
    const state = readState();
    if (!state) {
        throw new Error("not logged in. run `localagents login` first");
    }
    const host = hostInfo();
    console.log(`device: ${host.label}`);
    let server = "unreachable";
    try {
        const found = await discoverServer();
        if (found) {
            server = "ok";
        }
    } catch {
        // unreachable 유지
    }
    console.log(`server: ${server}`);
    console.log(`last sync: ${state.lastOkAt ? ago(Date.now() - state.lastOkAt) : "never"}`);
    if (!state.token) {
        console.log("pending: unknown (no token)");
        return;
    }
    try {
        const res = await fetch(`${baseUrl()}/api/commands/pending`, {
            headers: { Authorization: `Bearer ${state.token}` },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
            throw new Error(`pending rejected: ${res.status}`);
        }
        const body = (await res.json()) as { data?: { pending?: number } };
        console.log(`pending: ${body.data?.pending ?? "?"} commands`);
    } catch {
        console.log("pending: unknown (cloud unreachable)");
    }
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
    const { stableDeviceId, writeState, hostInfo, baseUrl } = await import("./device.js");
    const deviceId = stableDeviceId();
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
            const base = baseUrl().replace(/\/$/, "");
            const params = new URLSearchParams({
                device: deviceId,
                port: String(port),
                state,
                label: host.label,
                platform: host.platform,
                hostname: host.hostname,
            });
            // 사전 포장. 브라우저 주소창에 평문이 일순도 안 뜨게 한다. 실패하면 평문 폴백.
            fetch(`${base}/api/device/pack`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    device: deviceId,
                    port: String(port),
                    state,
                    label: host.label,
                    platform: host.platform,
                    hostname: host.hostname,
                }),
                signal: AbortSignal.timeout(10000),
            })
                .then(async (res) => {
                    if (!res.ok) {
                        return null;
                    }
                    const packed = (await res.json()) as { data?: { data?: string } };
                    return packed.data?.data ?? null;
                })
                .catch(() => null)
                .then((data) => {
                    const target = data
                        ? `${base}/api/device/begin?data=${encodeURIComponent(data)}`
                        : `${base}/api/device/begin?${params.toString()}`;
                    const opener =
                        platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
                    exec(`${opener} "${target}"`);
                    console.log("opened browser. approve this device, then return here.");
                    console.log(`if the browser did not open, visit:\n${target}`);
                });
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
    // 첫 동기화. 웹에 세션이 바로 뜨게 한다. 실패해도 로그인은 유효, 수동 sync로 메움.
    try {
        await onHeartbeat();
        const syncedServer = await ensureServer();
        const sessions = await syncSessions(syncedServer, true);
        // 조건부 backfill. 클라우드에 없는 탭의 현재 세션만 채운다.
        const filled = await backfillMissing(syncedServer);
        console.log(`initial sync: ${sessions.sessions} sessions, backfill ${filled.filled}/${filled.checked} tabs, ${filled.rows} rows`);
    } catch (err) {
        console.error(`initial sync failed: ${err instanceof Error ? err.message : err}`);
    }
}

async function onFork(sessionID: string | undefined): Promise<void> {
    if (!sessionID) {
        throw new Error("usage: localagents fork <session-id>");
    }
    const server = await ensureServer();
    const id = await forkAndRegister(server, sessionID);
    console.log(`forked: ${id}`);
}

async function onSyncMessages(sessionID: string | undefined): Promise<void> {
    if (!sessionID) {
        throw new Error("usage: localagents sync-messages <session-id>");
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
        throw new Error("not registered. run `localagents login` first");
    }
    if (!state.token) {
        throw new Error("no device token. run `localagents login` again");
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
    let stopping = false;
    const stop = () => {
        stopping = true;
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    // 미로그인 대기. crash-loop 대신 login을 기다린다.
    let state = readState();
    while (!stopping && (!state || !state.token)) {
        console.log("run: waiting for `localagents login`...");
        const deadline = Date.now() + 30000;
        while (!stopping && Date.now() < deadline) {
            await sleep(Math.min(1000, deadline - Date.now()));
        }
        state = readState();
    }
    if (stopping || !state?.token) {
        return;
    }
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
    const args = process.argv.slice(2).filter((a) => a !== "--jaeholee");
    const cmd = args[0];
    const advanced = new Set([
        "sessions",
        "heartbeat",
        "sync",
        "fork",
        "sync-messages",
        "sync-models",
        "sync-sessions",
        "poll",
    ]);
    // 숨김 진단 명령. 플래그 없이 치면 없는 명령으로 보인다. run은 unit이 쓰니 예외.
    if (cmd && advanced.has(cmd) && !process.argv.includes("--jaeholee")) {
        console.log(`unknown command: ${cmd}`);
        console.log("usage: localagents <login|logout|status|whoami|push>");
        process.exitCode = 1;
        return;
    }
    if (cmd === "status") {
        await onStatus();
    } else if (cmd === "logout") {
        await onLogout();
    } else if (cmd === "whoami") {
        await onWhoami();
    } else if (cmd === "sessions") {
        await onSessions();
    } else if (cmd === "login") {
        await onLogin();
    } else if (cmd === "heartbeat") {
        await onHeartbeat();
    } else if (cmd === "sync") {
        await onSync();
    } else if (cmd === "fork") {
        await onFork(args[1]);
    } else if (cmd === "sync-messages") {
        await onSyncMessages(args[1]);
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
    } else {
        if (cmd) {
            console.log(`unknown command: ${cmd}`);
        }
        console.log("usage: localagents <login|logout|status|whoami|push>");
        process.exitCode = 1;
    }
    // 1회성 명령이 띄운 서버는 함께 내린다. run은 스스로 관리한다.
    if (cmd !== "run") {
        killOwned();
    }
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
});
