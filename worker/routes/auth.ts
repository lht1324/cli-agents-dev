import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { exchangeOAuthCallback, proxyAuthRequest } from "../auth";
import type { AppEnv } from "../../lib/env";

// Neon Auth 프록시 — /api/auth/*
// 브라우저의 authClient는 같은 오리진의 이 경로로만 통신한다.
// 인증 미들웨어보다 **앞에** 마운트한다.
const authRoutes = new Hono<{ Bindings: AppEnv }>();

// OAuth 귀환 — catch-all보다 먼저.
// 기기 연결 복귀 쿠키가 있으면 그 화면으로, 없으면 인박스로. verifier 등의 query는 계승한다.
authRoutes.get("/callback", async (c) => {
    const { setCookies } = await exchangeOAuthCallback(c.req.raw);

    const back = getCookie(c, "localagents_connect") ?? "";
    let dest = "/sessions";
    if (back) {
        deleteCookie(c, "localagents_connect", { path: "/" });
        dest = back;
    }

    const incoming = new URL(c.req.url);
    const target = new URL(dest, incoming.origin);
    for (const [key, value] of incoming.searchParams) {
        target.searchParams.set(key, value);
    }

    const headers = new Headers({ Location: target.toString() });
    for (const cookie of setCookies) {
        headers.append("Set-Cookie", cookie);
    }
    return new Response(null, { status: 302, headers });
});

authRoutes.all("/*", (c) => {
    const path = new URL(c.req.url).pathname.replace(/^\/api\/auth\/?/, "");
    return proxyAuthRequest(c.req.raw, path);
});

export default authRoutes;
