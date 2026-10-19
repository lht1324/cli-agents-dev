import { auth } from "@/lib/auth/server";
import type { NextRequest } from "next/server";

const authMiddleware = auth.middleware({
    loginUrl: "/auth/sign-in",
});

export default function proxy(request: NextRequest) {
    if (request.headers.has("Next-Action")) {
        return;
    }
    return authMiddleware(request);
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
