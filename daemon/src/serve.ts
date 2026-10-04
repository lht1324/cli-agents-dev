import { randomBytes } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { discoverServer, type DiscoveredServer } from "./server";
import { readServerState, writeServerState } from "./device";

const BASE_PORT = 4096;
const MAX_PORT_TRIES = 10;

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

// PATH의 opencode가 아니라 데스크톱 번들(2.x 확정)을 우선한다.
// 시스템 1.18은 구 스키마만 봐서 데몬 대상이 아니다.
export function locateBinary(): string {
    const bundled = bundledBinary();
    if (bundled) {
        return bundled;
    }
    try {
        const found = execSync("command -v opencode", { encoding: "utf8" }).trim().split("\n")[0] ?? "";
        if (found.length > 0) {
            return found;
        }
    } catch {
        // fall through
    }
    throw new Error("opencode binary not found. install opencode first");
}

export interface ManagedServer extends DiscoveredServer {
    child: ChildProcess | null;
}

async function probeCandidate(url: string, auth: { username: string; password: string }): Promise<{ version?: string; prefix: string } | null> {
    for (const prefix of ["/api", ""]) {
        try {
            const res = await fetch(`${url}${prefix}/session`, {
                headers: {
                    Accept: "application/json",
                    Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}`,
                },
                signal: AbortSignal.timeout(2000),
            });
            if (!res.ok) {
                continue;
            }
            const text = await res.text();
            if (!text.trimStart().startsWith("{") && !text.trimStart().startsWith("[")) {
                continue;
            }
            return { prefix };
        } catch {
            continue;
        }
    }
    return null;
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
    const binary = locateBinary();
    let url = "";
    for (let port = BASE_PORT; port < BASE_PORT + MAX_PORT_TRIES; port++) {
        const candidate = spawn(binary, ["serve", "--port", String(port)], {
            env: { ...process.env, OPENCODE_SERVER_PASSWORD: state.password },
            stdio: "ignore",
        });
        url = `http://127.0.0.1:${port}`;
        const auth = { username: "opencode", password: state.password };
        let ready: { version?: string; prefix: string } | null = null;
        for (let i = 0; i < 15; i++) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            if (candidate.exitCode !== null) {
                break;
            }
            ready = await probeCandidate(url, auth);
            if (ready) {
                break;
            }
        }
        if (ready) {
            return { url, auth, version: ready.version, prefix: ready.prefix, child: candidate };
        }
        candidate.kill();
        if (candidate.exitCode === null) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    throw new Error("opencode serve did not come up in time");
}
