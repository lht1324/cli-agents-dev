import { baseUrl, readState } from "./device";

function token(): string {
    const state = readState();
    if (!state?.token) {
        throw new Error("no device token. run `localagents login` again");
    }
    return state.token;
}

// 클라우드 API 읽기. Neon 직결 금지.
export async function cloudGet(path: string): Promise<unknown> {
    const res = await fetch(`${baseUrl()}${path}`, {
        headers: { Authorization: `Bearer ${token()}` },
        signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
        const text = await res.text();
        if (res.status === 403) {
            throw new BillingError(path);
        }
        throw new Error(`cloud rejected ${path}: ${res.status} ${text.slice(0, 200)}`);
    }
    return res.json();
}

// 클라우드 API 쓰기. Neon 직결 금지.
export async function cloudPost(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${baseUrl()}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
        const text = await res.text();
        if (res.status === 403) {
            throw new BillingError(path);
        }
        throw new Error(`cloud rejected ${path}: ${res.status} ${text.slice(0, 200)}`);
    }
    return res.json();
}

// 31일 트라이얼 종료. 재시도해도 소용없으니 안내 메시지로 끝낸다.
export class BillingError extends Error {
    constructor(path: string) {
        super(`trial ended. syncing stopped. subscribe at localagents.link (rejected ${path})`);
        this.name = "BillingError";
    }
}
