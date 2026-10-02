import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { discoverServer, type DiscoveredServer } from "./server";

const PORT = 4096;

interface ServerState {
    password: string;
}

function stateDir(): string {
    return join(homedir(), ".config", "cliagent");
}

function serverStatePath(): string {
    return join(stateDir(), "server.json");
}

function readServerState(): ServerState | null {
    try {
        if (!existsSync(serverStatePath())) {
            return null;
        }
        return JSON.parse(readFileSync(serverStatePath(), "utf8")) as ServerState;
    } catch {
        return null;
    }
}

function writeServerState(state: ServerState): void {
    mkdirSync(stateDir(), { recursive: true });
    writeFileSync(serverStatePath(), JSON.stringify(state), { mode: 0o600 });
    chmodSync(serverStatePath(), 0o600);
}

function bundledBinary(): string | null {
    const base =
        platform() === "win32"
            ? join(homedir(), "AppData", "Roaming", "ai.opencode.desktop", "cli")
            : join(homedir(), ".config", "ai.opencode.desktop", "cli");
    let versions: string[] = [];
    try {
        versions = readdirSync(base).sort().reverse();
    } catch {
        return null;
    }
    for (const version of versions) {
        const candidate =
            platform() === "win32"
                ? join(base, version, "opencode-cli.exe")
                : join(base, version, "opencode-cli");
        if (existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

// PATH의 opencode 우선, 없으면 데스크톱 번들 최신 버전.
export function locateBinary(): string {
    try {
        const found = execSync("command -v opencode", { encoding: "utf8" }).trim().split("\n")[0] ?? "";
        if (found.length > 0) {
            return found;
        }
    } catch {
        // fall through
    }
    const bundled = bundledBinary();
    if (bundled) {
        return bundled;
    }
    throw new Error("opencode binary not found. install opencode first");
}

export interface ManagedServer extends DiscoveredServer {
    child: ChildProcess | null;
}

// 기존 서버 있으면 붙고, 없으면 직접 띄운다. 비번은 자체 생성·보관.
export async function ensureServer(): Promise<ManagedServer> {
    const found = await discoverServer();
    if (found) {
        return { ...found, child: null };
    }
    let state = readServerState();
    if (!state) {
        state = { password: randomBytes(32).toString("hex") };
        writeServerState(state);
    }
    process.env.OPENCODE_SERVER_PASSWORD = state.password;
    const child = spawn(locateBinary(), ["serve", "--port", String(PORT)], {
        env: { ...process.env, OPENCODE_SERVER_PASSWORD: state.password },
        stdio: "ignore",
    });
    const url = `http://127.0.0.1:${PORT}`;
    const auth = { username: "opencode", password: state.password };
    for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (child.exitCode !== null) {
            throw new Error("opencode serve exited during startup");
        }
        const again = await discoverServer();
        if (again) {
            return { url, auth, version: again.version, prefix: again.prefix, child };
        }
    }
    child.kill();
    throw new Error("opencode serve did not come up in time");
}
