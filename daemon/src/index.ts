import { apiGet, discoverServer, type DiscoveredServer } from "./server";

interface SessionRow {
    id: string;
    title?: string;
    time_updated?: number;
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
    const health = (await apiGet(server, "/global/health")) as { healthy: boolean; version: string };
    console.log(`server: ${server.url} (v${health.version}, healthy=${health.healthy})`);
}

async function onSessions(): Promise<void> {
    const server = await requireServer();
    const sessions = (await apiGet(server, "/session")) as SessionRow[];
    for (const s of sessions) {
        console.log(`${s.id}\t${s.title ?? "(untitled)"}`);
    }
    console.log(`total: ${sessions.length}`);
}

async function onLogin(): Promise<void> {
    console.log("pairing is not implemented yet. run `cliagent status` to verify local discovery first.");
}

async function main(): Promise<void> {
    const cmd = process.argv[2];
    if (cmd === "status") {
        await onStatus();
    } else if (cmd === "sessions") {
        await onSessions();
    } else if (cmd === "login") {
        await onLogin();
    } else {
        console.log("usage: cliagent <login|status|sessions>");
        process.exitCode = 1;
    }
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
});
