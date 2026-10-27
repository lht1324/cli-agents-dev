const isProd = process.env.NODE_ENV === "production";
const FETCH_TIMEOUT_MS = 30_000;

// 웹과 API가 같은 origin이면 빈 문자열(상대 경로). 분리 배포할 때만 NEXT_PUBLIC_BASE_URL을 준다.
function getRootPath(route: string): string {
    if (isProd || route.includes("http")) {
        return "";
    }
    return process.env.NEXT_PUBLIC_BASE_URL ?? "";
}

// /api/x → /api/client-gateway?path=/api/x. 게이트웨이를 안 거치는 경로는 그대로.
function getGatewayRoute(route: string): string {
    if (route.startsWith("/api/") && !route.startsWith("/api/client-gateway")) {
        const [path, query] = route.split("?");
        return `/api/client-gateway?path=${encodeURIComponent(path)}${query ? `&${query}` : ""}`;
    }
    return route;
}

async function request(route: string, method: string, body?: unknown): Promise<Response> {
    const response = await fetch(`${getRootPath(route)}${getGatewayRoute(route)}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "include",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
        console.error("HTTP error:", response.status, response.statusText);
        throw new Error(`[${response.status}] ${response.statusText}`);
    }
    return response;
}

export async function getFetch(route: string): Promise<Response> {
    return request(route, "GET");
}

export async function postFetch(route: string, body?: unknown): Promise<Response> {
    return request(route, "POST", body);
}

export async function patchFetch(route: string, body?: unknown): Promise<Response> {
    return request(route, "PATCH", body);
}

export async function deleteFetch(route: string): Promise<Response> {
    return request(route, "DELETE");
}
