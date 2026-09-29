import { apiGet, discoverServer, type DiscoveredServer } from "./server";
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

async function main(): Promise<void> {
    const cmd = process.argv[2];
    if (cmd === "status") {
        await onStatus();
    } else if (cmd === "sessions") {
        await onSessions();
    } else if (cmd === "login") {
        await onLogin();
    } else if (cmd === "poll") {
        await pollCommands();
    } else {
        console.log("usage: cliagent <login|status|sessions|poll>");
        process.exitCode = 1;
    }
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
});
