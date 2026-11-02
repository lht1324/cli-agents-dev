// API 공통 호출. 모든 엔드포인트는 { success, status, data?, error? } 형태를 따른다.
export async function getJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    const body = (await res.json()) as { success: boolean; data?: T; error?: string };
    if (!res.ok || !body.success || !body.data) {
        throw new Error(body.error ?? `${res.status}`);
    }
    return body.data;
}
