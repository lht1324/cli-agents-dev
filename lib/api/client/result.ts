// ClientAPI 공통 반환형. baseFetch는 실패 시 throw하므로 각 API 객체가 여기서 결과 객체로 바꾼다.
// 컴포넌트는 ok/status만 보고 UI를 정한다 — try/catch와 응답 파싱이 컴포넌트로 새지 않게.
export type ClientResult<T> = { ok: true; data: T } | { ok: false; status: number; error?: string };

// baseFetch가 던지는 `[401] Unauthorized` 형태에서 상태코드만 뽑는다.
// 기술 메시지는 UI에 노출하지 않는다 (콘솔에만 남긴다).
export function toFailure(error: unknown): { ok: false; status: number } {
    const message = error instanceof Error ? error.message : String(error);
    const match = /^\[(\d{3})\]/.exec(message);
    console.warn("client api failed:", message);
    return { ok: false, status: match ? Number(match[1]) : 0 };
}
