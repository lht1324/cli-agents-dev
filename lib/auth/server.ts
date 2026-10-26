import { createNeonAuth } from "@neondatabase/auth/next/server";

type NeonAuth = ReturnType<typeof createNeonAuth>;

let cached: NeonAuth | null = null;

// 왜 모듈 최상단에서 만들지 않는가:
// createNeonAuth는 호출 즉시 쿠키 secret을 검증하고, 없으면 throw한다. 그런데 proxy.ts는
// 워커 엔트리의 정적 import라서 런타임이 process.env를 채우기 전에 평가될 수 있다.
// 그 경우 500이 아니라 워커 부팅 자체가 죽어서 원인 파악이 어렵다.
// 첫 호출까지 미루면 요청 처리 시점(항상 env가 준비된 뒤)에만 생성된다. 동작은 동일하다.
export function getAuth(): NeonAuth {
    if (!cached) {
        const baseUrl = process.env.NEON_AUTH_BASE_URL;
        const secret = process.env.NEON_AUTH_COOKIE_SECRET;
        if (!baseUrl) {
            throw new Error("NEON_AUTH_BASE_URL is not set");
        }
        if (!secret) {
            throw new Error("NEON_AUTH_COOKIE_SECRET is not set");
        }
        cached = createNeonAuth({
            baseUrl,
            cookies: { secret },
        });
    }
    return cached;
}
