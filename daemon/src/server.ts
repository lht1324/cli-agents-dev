const DEFAULT_PORTS = [4096];

function baseUrlFromEnv(): string | null {
    const url = process.env.OPENCODE_SERVER_URL;
    return url && url.length > 0 ? url : null;
}

function authFromEnv(): { username: string; password: string } | null {
    const password = process.env.OPENCODE_SERVER_PASSWORD;
    if (!password) {
        return null;
    }
    return { username: process.env.OPENCODE_SERVER_USERNAME ?? "opencode", password };
}

async function probe(url: string, auth: { username: string; password: string } | null): Promise<boolean> {
    const headers: Record<string, string> = {};
    if (auth) {
        headers.Authorization = `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}`;
    }
    try {
        const res = await fetch(`${url}/global/health`, { headers, signal: AbortSignal.timeout(2000) });
        if (!res.ok) {
            return false;
        }
        const body = (await res.json()) as { healthy?: boolean };
        return body.healthy === true;
    } catch {
        return false;
    }
}

export interface DiscoveredServer {
    url: string;
    auth: { username: string; password: string } | null;
}

// 기존 serve를 찾아 붙는다. 없으면 직접 띄우라는 안내를 위해 null을 낸다.
export async function discoverServer(): Promise<DiscoveredServer | null> {
    const auth = authFromEnv();
    const fromEnv = baseUrlFromEnv();
    if (fromEnv && (await probe(fromEnv, auth))) {
        return { url: fromEnv, auth };
    }
    for (const port of DEFAULT_PORTS) {
        const url = `http://127.0.0.1:${port}`;
        if (await probe(url, auth)) {
            return { url, auth };
        }
    }
    return null;
}

export async function apiGet(server: DiscoveredServer, path: string): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (server.auth) {
        headers.Authorization = `Basic ${Buffer.from(`${server.auth.username}:${server.auth.password}`).toString("base64")}`;
    }
    const res = await fetch(`${server.url}${path}`, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
        throw new Error(`server responded ${res.status} for ${path}`);
    }
    return res.json();
}
