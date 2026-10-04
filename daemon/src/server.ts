const DEFAULT_PORTS = [4096];

import { readServerState } from "./device";

function baseUrlFromEnv(): string | null {
    const url = process.env.OPENCODE_SERVER_URL;
    return url && url.length > 0 ? url : null;
}

function authFromEnv(): { username: string; password: string } | null {
    const password = process.env.OPENCODE_SERVER_PASSWORD ?? readServerState()?.password;
    if (!password) {
        return null;
    }
    return { username: process.env.OPENCODE_SERVER_USERNAME ?? "opencode", password };
}

function basicAuth(auth: { username: string; password: string }): string {
    return `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}`;
}

async function probeHealth(url: string, auth: { username: string; password: string } | null): Promise<{ version?: string; prefix: string } | null> {
    for (const prefix of ["/api", ""]) {
        const headers: Record<string, string> = { Accept: "application/json" };
        try {
            const authed = auth
                ? { ...headers, Authorization: basicAuth(auth) }
                : headers;
            const tryFetch = async (h: Record<string, string>, path: string) => {
                const res = await fetch(`${url}${path}`, { headers: h, signal: AbortSignal.timeout(2000) });
                if (res.status === 401 && auth && !h.Authorization) {
                    return null;
                }
                return res;
            };
            // 세션 목록이 v2 형태인지 확인한다. 구버전(1.x)은 여기서 탈락.
            let res = await tryFetch(headers, `${prefix}/session`);
            if (res === null) {
                res = await tryFetch(authed, `${prefix}/session`);
            }
            if (!res || !res.ok) {
                continue;
            }
            const text = await res.text();
            if (!text.trimStart().startsWith("{") && !text.trimStart().startsWith("[")) {
                continue;
            }
            const body = JSON.parse(text) as { data?: unknown } | unknown[];
            const list = Array.isArray(body) ? body : body.data;
            if (!Array.isArray(list)) {
                continue;
            }
            // v2 전용 엔드포인트로 확정. 구버전은 model이 없다.
            const modelHeaders: Record<string, string> = { Accept: "application/json" };
            if (auth) {
                modelHeaders.Authorization = basicAuth(auth);
            }
            const modelRes = await fetch(`${url}${prefix}/model`, {
                headers: modelHeaders,
                signal: AbortSignal.timeout(2000),
            }).catch(() => null);
            if (!modelRes || !modelRes.ok) {
                continue;
            }
            const modelText = await modelRes.text();
            if (!modelText.includes('"data"')) {
                continue;
            }
            return { prefix };
        } catch {
            continue;
        }
    }
    return null;
}

export interface DiscoveredServer {
    url: string;
    auth: { username: string; password: string } | null;
    version?: string;
    prefix: string;
}

// 기존 serve를 찾아 붙는다. 없으면 직접 띄우라는 안내를 위해 null을 낸다.
export async function discoverServer(): Promise<DiscoveredServer | null> {
    const auth = authFromEnv();
    const fromEnv = baseUrlFromEnv();
    if (fromEnv) {
        const found = await probeHealth(fromEnv, auth);
        if (found) {
            return { url: fromEnv, auth, version: found.version, prefix: found.prefix };
        }
        return null;
    }
    for (const port of DEFAULT_PORTS) {
        const url = `http://127.0.0.1:${port}`;
        const found = await probeHealth(url, auth);
        if (found) {
            return { url, auth, version: found.version, prefix: found.prefix };
        }
    }
    return null;
}

export async function apiPost(server: DiscoveredServer, path: string, body: unknown): Promise<unknown> {
    const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
    if (server.auth) {
        headers.Authorization = basicAuth(server.auth);
    }
    const res = await fetch(`${server.url}${server.prefix}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
    });
    if (res.status === 401) {
        throw new Error("server requires authentication. set OPENCODE_SERVER_PASSWORD");
    }
    if (res.status === 204) {
        return null;
    }
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`server responded ${res.status} for ${path}: ${text.slice(0, 200)}`);
    }
    const text = await res.text();
    return text.length > 0 ? JSON.parse(text) : null;
}
export async function apiGet(server: DiscoveredServer, path: string): Promise<unknown> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (server.auth) {
        headers.Authorization = basicAuth(server.auth);
    }
    const res = await fetch(`${server.url}${server.prefix}${path}`, { headers, signal: AbortSignal.timeout(10000) });
    if (res.status === 401) {
        throw new Error("server requires authentication. set OPENCODE_SERVER_PASSWORD");
    }
    if (!res.ok) {
        throw new Error(`server responded ${res.status} for ${path}`);
    }
    return res.json();
}
