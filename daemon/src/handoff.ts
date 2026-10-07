import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { createInterface } from "node:readline";
import { apiGet, type DiscoveredServer } from "./server";
import { cloudGet, cloudPost } from "./cloud";
import { readState } from "./device";
import { applyTabPackage, readTabPackage, type TabPackage } from "./localdb";
import { getBytes, putBytes } from "./storage";

export interface HandoffVersion {
    tabId: string;
    epoch: number;
    version: string;
    storageKey: string;
    baseHash: string;
    rowCount: number;
    sha256: string;
    receivedAt?: string | null;
    createdAt?: string | null;
}

function sha256Hex(data: string): string {
    return createHash("sha256").update(data).digest("hex");
}

// 통째 스냅샷 포장. 불변 버전, 합치기 없음.
export function packTab(sessionID: string): { bytes: Uint8Array; sha256: string; rowCount: number; baseHash: string } {
    const pkg = readTabPackage(sessionID);
    const canonical = JSON.stringify(pkg);
    const baseHash = sha256Hex(
        JSON.stringify({ tabId: pkg.tabId, first: pkg.messages[0]?.id ?? null, count: pkg.messages.length }),
    );
    return { bytes: gzipSync(canonical), sha256: sha256Hex(canonical), rowCount: pkg.messages.length + pkg.parts.length, baseHash };
}

export function unpackTab(bytes: Uint8Array, sha256: string): TabPackage {
    const canonical = gunzipSync(bytes).toString("utf8");
    if (sha256Hex(canonical) !== sha256) {
        throw new Error("checksum mismatch. download again");
    }
    return JSON.parse(canonical) as TabPackage;
}

// push 본체. 함수라 자동화도 같은 걸 부른다.
export async function pushTabs(server: DiscoveredServer, sessionIDs: string[]): Promise<{ pushed: number; rows: number }> {
    const state = readState();
    if (!state) {
        throw new Error("not logged in. run `localagents login` first");
    }
    let pushed = 0;
    let rows = 0;
    for (let i = 0; i < sessionIDs.length; i++) {
        const sid = sessionIDs[i];
        let title: string | null = null;
        try {
            const detail = (await apiGet(server, `/session/${sid}`)) as { data?: { title?: string } } | { title?: string };
            const row = (detail as { data?: { title?: string } }).data ?? detail;
            title = (row as { title?: string }).title ?? null;
        } catch {
            // 제목 없이 진행
        }
        const name = title ?? sid.slice(0, 12);
        console.log(`Pushing (${i + 1}/${sessionIDs.length}) ${name}...`);
        const packed = packTab(sid);
        const version = `${Date.now()}`;
        const key = `handoffs/${sid}/0/${version}.bin.gz`;
        putProgress(name, 30);
        await putBytes(key, packed.bytes);
        putProgress(name, 70);
        await cloudPost("/api/handoffs", {
            tabId: sid,
            epoch: 0,
            version,
            storageKey: key,
            baseHash: packed.baseHash,
            rowCount: packed.rowCount,
            sha256: packed.sha256,
        });
        putProgress(name, 100);
        process.stdout.write("\n");
        pushed++;
        rows += packed.rowCount;
    }
    return { pushed, rows };
}

function putProgress(name: string, pct: number): void {
    const width = 40;
    const filled = Math.round((pct / 100) * width);
    process.stdout.write(`\r  ${name} [${"#".repeat(filled)}${"-".repeat(width - filled)}] ${pct}%`);
}

// pull 본체. 버전 고르기 → 받기 → 붙이기 → 검증. 함수라 자동화도 같은 걸 부른다.
export async function pullVersion(intoTabId: string, version: HandoffVersion): Promise<{ messages: number; parts: number }> {
    const raw = await getBytes(version.storageKey);
    const pkg = unpackTab(raw, version.sha256);
    const applied = applyTabPackage(intoTabId, pkg);
    await cloudPost("/api/handoffs", { receivedVersion: version.version });
    return applied;
}

export async function listVersions(): Promise<HandoffVersion[]> {
    const body = (await cloudGet("/api/handoffs")) as { data?: { versions?: HandoffVersion[] } };
    return body.data?.versions ?? [];
}

function ask(question: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// TTY 선택. 없으면(파이프·플래그) 묻지 않는다.
export async function pickNumbers(count: number, what: string): Promise<number[]> {
    if (!process.stdin.isTTY) {
        return [];
    }
    const answer = await ask(`Pick ${what} (e.g. 1 3, a = all, Enter = 1): `);
    if (answer.toLowerCase() === "a" || answer.toLowerCase() === "all") {
        return Array.from({ length: count }, (_, i) => i);
    }
    if (answer === "") {
        return [0];
    }
    return answer
        .split(/[\s,]+/)
        .map((n) => parseInt(n, 10) - 1)
        .filter((n) => Number.isInteger(n) && n >= 0 && n < count);
}
