import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, hostname, platform, release } from "node:os";
import { join } from "node:path";

// UUIDv7: 시간 48비트 + 랜덤 74비트. 정렬 유리, 충돌 무시 수준.
export function newDeviceId(): string {
    const now = Date.now();
    const rand = randomBytes(10);
    const bytes = Buffer.alloc(16);
    bytes.writeUIntBE(now, 0, 6);
    rand.copy(bytes, 6);
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface DeviceState {
    deviceId: string;
    userId: string;
    token?: string;
    lastOkAt?: number;
}

export interface ServerState {
    password: string;
}

function stateDir(): string {
    return join(homedir(), ".config", "localagents");
}

function statePath(): string {
    return join(stateDir(), "device.json");
}

export function readState(): DeviceState | null {
    try {
        if (!existsSync(statePath())) {
            return null;
        }
        const raw = JSON.parse(readFileSync(statePath(), "utf8")) as Partial<DeviceState>;
        if (!raw.deviceId || !raw.userId) {
            return null;
        }
        return { deviceId: raw.deviceId, userId: raw.userId, token: raw.token, lastOkAt: raw.lastOkAt };
    } catch {
        return null;
    }
}

export function baseUrl(): string {
    return process.env.LOCALAGENTS_BASE_URL ?? "http://localhost:3000";
}

export function writeState(state: DeviceState): void {
    mkdirSync(stateDir(), { recursive: true });
    writeFileSync(statePath(), JSON.stringify(state, null, 4), { mode: 0o600 });
    chmodSync(statePath(), 0o600);
}

// logout용. 등록 상태만 지운다. env·서버 비번은 유지.
export function clearState(): void {
    try {
        unlinkSync(statePath());
    } catch {
        // 없어도 정상
    }
    try {
        unlinkSync(join(stateDir(), "cursors.json"));
    } catch {
        // 없어도 정상
    }
    try {
        for (const f of readdirSync(join(stateDir(), "spool"))) {
            if (f.endsWith(".json")) {
                try {
                    unlinkSync(join(stateDir(), "spool", f));
                } catch {
                    // 무시
                }
            }
        }
    } catch {
        // 없어도 정상
    }
}

function serverStatePath(): string {
    return join(stateDir(), "server.json");
}

export function readServerState(): ServerState | null {
    try {
        if (!existsSync(serverStatePath())) {
            return null;
        }
        return JSON.parse(readFileSync(serverStatePath(), "utf8")) as ServerState;
    } catch {
        return null;
    }
}

export function writeServerState(state: ServerState): void {
    mkdirSync(stateDir(), { recursive: true });
    writeFileSync(serverStatePath(), JSON.stringify(state), { mode: 0o600 });
    chmodSync(serverStatePath(), 0o600);
}

export interface HostInfo {
    platform: string;
    release: string;
    hostname: string;
    label: string;
}

// os 모듈 동기 호출. 부팅 시점에 항상 값 있음.
export function hostInfo(): HostInfo {
    const p = platform();
    const h = hostname();
    return { platform: p, release: release(), hostname: h, label: `${h} · ${p}` };
}
