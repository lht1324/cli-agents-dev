import { baseUrl, readState } from "./device";

function token(): string {
    const state = readState();
    if (!state?.token) {
        throw new Error("no device token. run `cliagent token <device-token>` first");
    }
    return state.token;
}

// 클라우드 API 호출. Neon 직결 금지.
export async function cloudPost(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${baseUrl()}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`cloud rejected ${path}: ${res.status} ${text.slice(0, 200)}`);
    }
    return res.json();
}
