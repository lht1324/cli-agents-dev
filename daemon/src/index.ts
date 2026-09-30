import { apiGet, apiPost, discoverServer, type DiscoveredServer } from "./server";
import { hostInfo, newDeviceId, readState, writeState } from "./device";
import { listPending, reply, pushPending, type ReplyDecision } from "./permissions";
import { db } from "./db";
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
    const server = await requireServer();
    console.log(`server: ${server.url}${server.version ? ` (v${server.version})` : ""}`);
}

async function onSessions(): Promise<void> {
    const server = await requireServer();
    const body = (await apiGet(server, "/session")) as { data?: SessionRow[] } | SessionRow[];
    const sessions = Array.isArray(body) ? body : (body.data ?? []);
    for (const s of sessions) {
        console.log(`${s.id}\t${s.title ?? s.outcome ?? "(untitled)"}`);
    }
    console.log(`total: ${sessions.length}`);
}

async function onLogin(): Promise<void> {
    console.log("pairing is not implemented yet. run `cliagent status` to verify local discovery first.");
}

async function onRegister(userId: string | undefined, deviceId: string | undefined): Promise<void> {
    if (!userId) {
        throw new Error("usage: cliagent register <user-id> [device-id]");
    }
    const id = deviceId ?? newDeviceId();
    writeState({ deviceId: id, userId });
    const host = hostInfo();
    const sql = db();
    await sql`
        INSERT INTO devices (id, user_id, label, platform, hostname, last_seen_at)
        VALUES (${id}, ${userId}, ${host.label}, ${host.platform}, ${host.hostname}, NOW())
        ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, last_seen_at = NOW()
    `;
    console.log(`registered: ${id} (${host.label})`);
}

async function onApprove(requestID: string | undefined, decision: string | undefined): Promise<void> {
    const server = await requireServer();
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

async function onSync(): Promise<void> {
    const server = await requireServer();
    const result = await pushPending(server);
    console.log(`pushed: ${result.open} open`);
}

async function onHeartbeat(): Promise<void> {
    const state = readState();
    if (!state) {
        throw new Error("not registered. run `cliagent register <user-id>` first");
    }
    const host = hostInfo();
    const sql = db();
    await sql`
        UPDATE devices
        SET last_seen_at = NOW(), platform = ${host.platform}, hostname = ${host.hostname}
        WHERE id = ${state.deviceId}
    `;
    const found = (await sql`SELECT id FROM devices WHERE id = ${state.deviceId}`) as { id: string }[];
    if (found.length === 0) {
        throw new Error("device row missing. run `cliagent register` again");
    }
    console.log(`heartbeat: ${state.deviceId} (${host.label})`);
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
    } else if (cmd === "sync") {
        await onSync();
    } else if (cmd === "poll") {
        await pollCommands();
    } else if (cmd === "approve") {
        await onApprove(process.argv[3], process.argv[4]);
    } else {
        console.log("usage: cliagent <login|register|status|sessions|poll|heartbeat|approve|sync>");
        process.exitCode = 1;
    }
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
});
