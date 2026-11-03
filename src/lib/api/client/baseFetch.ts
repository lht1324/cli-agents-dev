// 서버 요청 전송만 담당한다. 상태 코드 판정·오류 해석은 ClientAPI가 한다.
// 웹과 API가 같은 오리진이므로 base URL·게이트웨이가 필요 없다.
const FETCH_TIMEOUT_MS = 30_000;

async function request(route: string, method: string, body?: unknown): Promise<Response> {
    return fetch(route, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "include",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
}

export async function getFetch(route: string): Promise<Response> {
    return request(route, "GET");
}

export async function postFetch(route: string, body?: unknown): Promise<Response> {
    return request(route, "POST", body);
}

export async function deleteFetch(route: string): Promise<Response> {
    return request(route, "DELETE");
}
