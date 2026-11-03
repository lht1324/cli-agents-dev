import { createMiddleware } from "hono/factory";
import { getAuthForRequest } from "../auth";
import type { AppEnv } from "../../lib/env";
import { getBaseResponse } from "../utils/getBaseResponse";

// 세션 인증을 한 곳에서 처리한다.
//   requireSession — API(/api/*). 실패하면 JSON 401
//   loadSessionUser — 페이지 가드. 실패하면 리다이렉트

export interface SessionUser {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
}

export interface SessionResolution {
    user: SessionUser | null;
    /** 세션 갱신 시 라이브러리가 심으려는 Set-Cookie — 호출부가 응답에 붙인다. */
    setCookies: string[];
    /** 세션 조회 자체가 실패했는지 (네트워크·설정 오류) */
    failed: boolean;
}

export async function loadSessionUser(request: Request): Promise<SessionResolution> {
    const setCookies: string[] = [];
    try {
        const auth = await getAuthForRequest({ request, setCookies });
        const { data } = await auth.getSession();
        const user = data?.user;
        if (!user?.id) {
            return { user: null, setCookies, failed: false };
        }
        return {
            user: {
                id: user.id,
                email: user.email ?? null,
                name: user.name ?? null,
                image: user.image ?? null,
            },
            setCookies,
            failed: false,
        };
    } catch (error) {
        console.error("[auth] session check failed:", error);
        return { user: null, setCookies, failed: true };
    }
}

export type AuthVariables = {
    userId: string;
};

/** API용 — 인증 실패 시 즉시 JSON 401 */
export const requireSession = createMiddleware<{
    Bindings: AppEnv;
    Variables: AuthVariables;
}>(async (c, next) => {
    const { user, setCookies, failed } = await loadSessionUser(c.req.raw);
    for (const cookie of setCookies) {
        c.header("Set-Cookie", cookie, { append: true });
    }
    if (failed) {
        return getBaseResponse({ success: false, status: 401, error: "unauthorized: session check failed" });
    }
    if (!user) {
        return getBaseResponse({ success: false, status: 401, error: "unauthorized" });
    }
    c.set("userId", user.id);
    await next();
});
