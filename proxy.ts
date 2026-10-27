import { getAuth } from "@/lib/auth/server";
import type { NextRequest } from "next/server";

// 미들웨어도 요청 시점에 만든다. proxy.ts는 워커 엔트리의 정적 import라
// 모듈 평가 시점에는 process.env가 아직 비어 있을 수 있다 (getAuth 주석 참조).
export default function proxy(request: NextRequest) {
    if (request.headers.has("Next-Action")) {
        return;
    }
    return getAuth().middleware({ loginUrl: "/auth/sign-in" })(request);
}

export const config = {
    matcher: [
        "/account/:path*",
        // 인증이 필요한 화면. matcher에 걸려야 Neon verifier 교환(exchangeOAuthToken)이
        // 프록시에서 돌고, SSR의 getSession이 세션을 볼 수 있다 (OAuth 로그인 체인 유지).
        "/sessions/:path*",
        "/devices/:path*",
        "/device/:path*",
    ],
};
