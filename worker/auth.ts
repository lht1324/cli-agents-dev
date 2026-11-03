import {
    DEFAULT_AUTH_SKIP_ROUTES,
    createAuthServer,
    extractNeonAuthCookies,
    handleAuthProxyRequest,
    processAuthMiddleware,
    serializeSetCookie,
} from "@neondatabase/auth/server";
import { requireEnv } from "../lib/env";

// Neon Auth의 프레임워크 비의존 툴킷을 직접 배선한다 (tailored-ad-vite와 동일 패턴).
// Next 어댑터는 next/headers에 의존해서 쓸 수 없다.
//
// 요청마다 인스턴스를 만드는 이유: context 팩토리가 "지금 이 요청"의 쿠키를 읽어야 하는데,
// Workers isolate는 여러 요청을 동시에 처리하므로 모듈 전역에 요청을 담으면 섞인다.

export interface AuthRequestInput {
    request: Request;
    /** 라이브러리가 심으려는 Set-Cookie 문자열을 모아둘 배열 (호출부 소유) */
    setCookies: string[];
}

function authEnv(): { baseUrl: string; cookieSecret: string } {
    return {
        baseUrl: requireEnv("NEON_AUTH_BASE_URL"),
        cookieSecret: requireEnv("NEON_AUTH_COOKIE_SECRET"),
    };
}

function resolveOrigin(headers: Headers): string {
    const origin = headers.get("origin");
    if (origin) {
        return origin;
    }
    const referer = headers.get("referer");
    if (!referer) {
        return "";
    }
    return referer.split("/").slice(0, 3).join("/");
}

/** 세션 읽기용. 쿠키는 setCookies 배열로 모아 호출부가 응답에 붙인다. */
export async function getAuthForRequest({ request, setCookies }: AuthRequestInput) {
    const { baseUrl, cookieSecret } = authEnv();
    return createAuthServer({
        baseUrl,
        cookieSecret,
        context: () => {
            const headers = request.headers;
            return {
                getCookies: () => extractNeonAuthCookies(headers),
                setCookie: (name: string, value: string, options: Record<string, unknown>) => {
                    setCookies.push(
                        serializeSetCookie({ name, value, ...options } as Parameters<typeof serializeSetCookie>[0]),
                    );
                },
                getHeader: (name: string) => headers.get(name) ?? null,
                getOrigin: () => resolveOrigin(headers),
                getFramework: () => "hono",
            };
        },
    });
}

/** /api/auth/* → Neon Auth 프록시. Set-Cookie가 브라우저로 그대로 간다. */
export async function proxyAuthRequest(request: Request, path: string): Promise<Response> {
    const { baseUrl, cookieSecret } = authEnv();
    return handleAuthProxyRequest({ request, path, baseUrl, cookieSecret });
}

/** OAuth 귀환: verifier를 세션 쿠키로 교환하고 setCookies를 돌려준다. */
export async function exchangeOAuthCallback(request: Request): Promise<{ setCookies: string[] }> {
    const { baseUrl, cookieSecret } = authEnv();
    const result = await processAuthMiddleware({
        request,
        pathname: new URL(request.url).pathname,
        skipRoutes: DEFAULT_AUTH_SKIP_ROUTES,
        loginUrl: "/",
        baseUrl,
        cookieSecret,
    });
    return { setCookies: result.cookies ?? [] };
}
