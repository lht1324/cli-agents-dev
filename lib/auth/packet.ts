import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface ConnectPacket {
    device: string;
    port: string;
    state: string;
    label?: string;
    platform?: string;
    hostname?: string;
    exp: number;
}

// 기기 연결 파라미터 봉투. JSON → AES-256-GCM → base64url 1개 param(data).
// 키는 서버 env 1개(DEVICE_PACKET_KEY, 64 hex). 유저마다가 아니라 서버 1개면 된다.
// CSRF 바인딩은 loopback state, 유효기한 10분.
const PACKET_TTL_MS = 10 * 60 * 1000;

function packetKey(): Buffer {
    const raw = process.env.DEVICE_PACKET_KEY ?? "";
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        return Buffer.from(raw, "hex");
    }
    throw new Error("DEVICE_PACKET_KEY is not set (64 hex chars, e.g. `openssl rand -hex 32`)");
}

export function sealConnect(input: Omit<ConnectPacket, "exp">): string {
    const payload = JSON.stringify({ ...input, exp: Date.now() + PACKET_TTL_MS });
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", packetKey(), iv);
    const ct = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64url");
}

export function unsealConnect(data: string): ConnectPacket | null {
    try {
        const buf = Buffer.from(data, "base64url");
        if (buf.length < 12 + 16 + 1) {
            return null;
        }
        const decipher = createDecipheriv("aes-256-gcm", packetKey(), buf.subarray(0, 12));
        decipher.setAuthTag(buf.subarray(12, 28));
        const plain = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
        const p = JSON.parse(plain) as Partial<ConnectPacket>;
        if (typeof p.device !== "string" || !p.device) {
            return null;
        }
        if (typeof p.port !== "string" || !p.port) {
            return null;
        }
        if (typeof p.state !== "string" || !p.state) {
            return null;
        }
        if (typeof p.exp !== "number" || Date.now() > p.exp) {
            return null;
        }
        return p as ConnectPacket;
    } catch {
        return null;
    }
}
