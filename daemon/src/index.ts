import { apiGet, apiPost, discoverServer, type DiscoveredServer } from "./server";
import { cloudGet } from "./cloud";
import { hostInfo, readState, writeState, baseUrl } from "./device";
import { forkAndRegister } from "./fork";
import { ensureServer, killOwned, type ManagedServer } from "./serve";
import { syncSessions } from "./sessions";
import { setSessionAgent, setSessionModel, syncCatalog, type ModelRef } from "./catalog";
import { backfillMissing, syncActiveMessages, syncMessages } from "./messages";
import { checkboxPick, listVersions, pickNumbers, pullVersion, pushTabs, type HandoffVersion } from "./handoff";
import { countAll, countNewer, epochOf, findLocalDirByRemote, localRoleCounts, repoForDirectory, sessionExists, setTabDirectory } from "./localdb";
import { askTyped, isDir, pickDirectory } from "./sysdialog";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { readPushMark } from "./pushstate";
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
        console.log("already logged out.");
        return;
    }
    if (!res.ok) {
        throw new Error(`revoke rejected: ${res.status}. state kept, try again online`);
    }
    clearState();
    console.log("logged out.");
}

// 토큰 사전 검증. 죽은 토큰이면 작업 전에 로그인 메시지로 끝낸다.
async function ensureAuth(): Promise<{ deviceId: string; userId: string; token: string }> {
    const { readState, baseUrl } = await import("./device.js");
    const state = readState();
    if (!state?.token) {
        throw new Error("not logged in. run `localagents login` first");
    }
    let res: Response;
    try {
        res = await fetch(`${baseUrl()}/api/auth/whoami`, {
            headers: { Authorization: `Bearer ${state.token}` },
            signal: AbortSignal.timeout(10000),
        });
    } catch {
        throw new Error("cloud unreachable. check your connection");
    }
    if (res.status === 401) {
        throw new Error("not logged in. run `localagents login` first");
    }
    if (!res.ok) {
        throw new Error(`cloud rejected auth check: ${res.status}`);
    }
    return { deviceId: state.deviceId, userId: state.userId, token: state.token };
}

async function onPush(ids: string[]): Promise<void> {
    await ensureAuth();
    const server = await ensureServer();
    const clean = ids.filter((a) => a !== "--all" && a !== "--jaeholee");
    const all = ids.includes("--all");
    let targets = clean;
    if (targets.length === 0 && !all) {
        const body = (await apiGet(server, "/session")) as
            | { data?: { id: string; time?: { updated?: number } }[] }
            | { id: string; time?: { updated?: number } }[];
        const list = (Array.isArray(body) ? body : (body.data ?? [])).filter((s) => typeof s.id === "string");
        const sorted = [...list].sort((a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0));
        if (sorted.length === 0) {
            console.log("no tabs.");
            return;
        }
        const titles: string[] = [];
        const dirties: number[] = [];
        for (const s of sorted) {
            let title: string | null = null;
            try {
                const detail = (await apiGet(server, `/session/${s.id}`)) as { data?: { title?: string } } | { title?: string };
                const row = (detail as { data?: { title?: string } }).data ?? detail;
                title = (row as { title?: string }).title ?? null;
            } catch {
                // id로 표시
            }
            titles.push(title ?? s.id);
            let dirty = 0;
            try {
                const mark = readPushMark(s.id);
                dirty = mark ? countNewer(s.id, mark.at, mark.id) : countAll(s.id);
            } catch {
                // 0으로 표시
            }
            dirties.push(dirty);
        }
        console.log("Pick tabs to push (space: toggle, a: all, n: none, Esc: cancel, Enter: confirm):");
        const picked = await checkboxPick(
            [...titles.map((t, i) => `${t} (${dirties[i]} new)`), "Not now"],
            titles.map(() => false),
        );
        targets = picked.filter((i) => i < sorted.length).map((i) => sorted[i].id);
        if (picked.includes(titles.length) || targets.length === 0) {
            console.log("Nothing picked.");
            return;
        }
    } else if (all) {
        const body = (await apiGet(server, "/session")) as { data?: { id: string }[] } | { id: string }[];
        const list = Array.isArray(body) ? body : (body.data ?? []);
        targets = list.map((s) => s.id).filter((id) => typeof id === "string");
    }
    const result = await pushTabs(server, targets);
    console.log(`Done: ${result.pushed} tabs pushed.`);
}

async function onPull(): Promise<void> {
    await ensureAuth();
    const versions = await listVersions();
    // 탭별 최신 1건으로 묶어 수정일 내림차순. 받은 건(내 기기) 숨김.
    const state = readState();
    const mine = state?.deviceId ?? "";
    const latest = new Map<string, (typeof versions)[number]>();
    for (const v of versions) {
        if (v.receivedBy === mine) {
            continue;
        }
        const cur = latest.get(v.tabId);
        if (!cur || (v.createdAt ?? "") > (cur.createdAt ?? "")) {
            latest.set(v.tabId, v);
        }
    }
    const tabs = [...latest.values()].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    if (tabs.length === 0) {
        console.log("Nothing to pull.");
        return;
    }
    console.log("Pick tabs to pull (space: toggle, a: all, n: none, Esc: cancel, Enter: confirm):");
    const labels = tabs.map((v) => {
        const name = v.title ?? v.tabId.slice(0, 12);
        if (v.userMsgs == null && v.aiMsgs == null) {
            return `${name} (${v.rowCount} rows)`;
        }
        const local = sessionExists(v.tabId) ? localRoleCounts(v.tabId) : null;
        const du = Math.max(0, (v.userMsgs ?? 0) - (local?.user ?? 0));
        const da = Math.max(0, (v.aiMsgs ?? 0) - (local?.ai ?? 0));
        return `${name} (AI +${da} · User +${du})`;
    });
    const picked = await checkboxPick(
        labels,
        tabs.map((_, i) => i === 0),
    );
    if (picked.length === 0) {
        console.log("Nothing picked.");
        return;
    }
    for (const n of picked) {
        const version = tabs[n] ?? tabs[0];
        const localEpoch = sessionExists(version.tabId) ? epochOf(version.tabId) : 0;
        if (version.epoch < localEpoch) {
            console.log(`Skipped ${version.title ?? version.tabId}: version is epoch ${version.epoch}, local tab is epoch ${localEpoch}.`);
            continue;
        }
        const dir = await resolveTabDir(version.remote ?? null, version.title ?? version.tabId);
        if (!dir) {
            console.log(`Skipped ${version.title ?? version.tabId}: no folder.`);
            continue;
        }
        const applied = await pullVersion(version);
        try {
            setTabDirectory(version.tabId, dir);
        } catch {
            // 폴더 지정 실패해도 내용은 들어감
        }
        console.log(applied.created ? `Created new tab ${applied.title} in ${dir}.` : `Updated local tab ${applied.title} (${dir}).`);
        console.log(`Done: ${applied.messages} messages, ${applied.parts} parts applied.`);
    }
}

// 작업폴더 확정. 자동 매칭 → 새로/기존 → 선택기/clone/검증.
async function resolveTabDir(remote: string | null, label: string): Promise<string | null> {
    if (remote) {
        const match = findLocalDirByRemote(remote);
        if (match) {
            console.log(`Matched folder: ${match}`);
            return match;
        }
    }
    console.log(`No local folder for ${label}${remote ? ` (${remote})` : ""}.`);
    const choice = (await askTyped("New clone or existing folder? [new/existing]: ")).toLowerCase();
    if (choice.startsWith("e")) {
        const dir = await pickDirectory();
        if (!dir || !isDir(dir)) {
            return null;
        }
        if (remote) {
            const got = repoForDirectory(dir).remote;
            if (got !== remote) {
                console.log(`Stopped: folder remote is ${got ?? "none"}, expected ${remote}.`);
                return null;
            }
        }
        return dir;
    }
    if (!remote) {
        return null;
    }
    const parent = await pickDirectory();
    if (!parent || !isDir(parent)) {
        return null;
    }
    const name = remote.split("/").pop()?.replace(/\.git$/, "") ?? "repo";
    const target = join(parent, name);
    console.log(`Cloning into ${target}...`);
    try {
        execSync(`git clone "${remote}" "${target}"`, { timeout: 300000, stdio: "inherit" });
    } catch {
        console.log("Clone failed.");
        return null;
    }
    return target;
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
        // 조건부 backfill. 전부 보여주고 없는 것만 기본 체크. DB 유무는 표시만.
        const listed = (await cloudGet("/api/sync")) as { data?: { tabIds?: string[] } };
        const have = new Set(Array.isArray(listed.data?.tabIds) ? listed.data.tabIds : []);
        const body = (await apiGet(syncedServer, "/session")) as { data?: { id: string }[] } | { id: string }[];
        const all = (Array.isArray(body) ? body : (body.data ?? [])).filter((s) => typeof s.id === "string");
        let picked: string[] | null = null;
        if (all.length > 0 && process.stdin.isTTY) {
            const titles: string[] = [];
            for (const s of all) {
                let title: string | null = null;
                try {
                    const detail = (await apiGet(syncedServer, `/session/${s.id}`)) as
                        | { data?: { title?: string } }
                        | { title?: string };
                    const row = (detail as { data?: { title?: string } }).data ?? detail;
                    title = (row as { title?: string }).title ?? null;
                } catch {
                    // id로 표시
                }
                titles.push(have.has(s.id) ? `${title ?? s.id} (synced)` : (title ?? s.id));
            }
            console.log("Pick sessions to sync (space: toggle, a: all, n: none, Esc: cancel, Enter: confirm):");
            const nums = await checkboxPick(
                [...titles, "Not now"],
                titles.map((_, i) => !have.has(all[i].id)),
            );
            if (nums.includes(titles.length)) {
                console.log("Nothing picked.");
                picked = [];
            } else {
                picked = nums.filter((i) => i < all.length).map((i) => all[i].id);
                if (picked.length === 0) {
                    console.log("Nothing picked.");
                }
            }
        }
        if (picked === null || picked.length > 0) {
            const filled = await backfillMissing(syncedServer, picked ?? undefined);
            console.log(`Done: ${filled.filled} sessions synced.`);
        } else {
            console.log(`Done: ${sessions.sessions} sessions found.`);
        }
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
async function onHeartbeat(quiet = false): Promise<number> {
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
    if (!quiet) {
        console.log(`heartbeat: ${state.deviceId} (${host.label}) via api`);
    }
    return typeof intervalSec === "number" && intervalSec > 0 ? intervalSec : 1800;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
        // 빠른 층: 10초. 하트비트·스풀 비우기 + 명령 가져오기. presence는 플랜 주기와 분리한다.
        // (동기화 30분마다만 뛰면 2분 기준 온라인 표시가 항상 꺼진다.)
        try {
            intervalSec = await onHeartbeat(true);
        } catch (err) {
            console.error(`heartbeat failed: ${err instanceof Error ? err.message : err}`);
        }
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
    // 항시 서버는 죽이지 않는다. 다음 run이 이어쓴다.
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
        console.log("usage: localagents <login|logout|status|whoami|push|pull>");
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
        await onPush(args.slice(1));
    } else if (cmd === "pull") {
        await onPull();
    } else if (cmd === "run") {
        await onRun();
    } else if (cmd === "poll") {
        await pollCommands();
    } else {
        if (cmd) {
            console.log(`unknown command: ${cmd}`);
        }
        console.log("usage: localagents <login|logout|status|whoami|push|pull>");
        process.exitCode = 1;
    }
    // 1회성 명령이 띄운 서버는 함께 내린다. run은 스스로 관리한다.
    if (cmd !== "run") {
        killOwned();
    }
}

main().catch((err: unknown) => {
    console.error(`\n${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
});
