import { Hono, type Context } from "hono";
import { loadSessionUser } from "./middleware/auth";
import { appendSetCookies, redirectWithCookies } from "./utils/response";
import type { AppEnv } from "../lib/env";

// 페이지 가드 — Next의 proxy.ts + 서버 컴포넌트 redirect()를 대체한다.
// 보호 경로를 wrangler.jsonc의 run_worker_first에 등록해야 워커가 먼저 받는다
// (최상위 내비게이션은 자산과 매칭되지 않으면 not_found_handling으로 간다).
const pageRoutes = new Hono<{ Bindings: AppEnv }>();

type PageContext = Context<{ Bindings: AppEnv }>;

const SIGN_IN_PATH = "/auth/sign-in";
const DEFAULT_AFTER_SIGN_IN = "/sessions";
const GUARDED_PATHS = ["/sessions", "/devices", "/profile", "/billing", "/device"];

pageRoutes.get(SIGN_IN_PATH, handleSignInPage);

for (const basePath of GUARDED_PATHS) {
    pageRoutes.get(basePath, handleGuardedPage);
    pageRoutes.get(`${basePath}/*`, handleGuardedPage);
}

async function handleSignInPage(c: PageContext): Promise<Response> {
    const { user, setCookies } = await loadSessionUser(c.req.raw);
    if (user) {
        return redirectWithCookies(DEFAULT_AFTER_SIGN_IN, setCookies);
    }
    return appendSetCookies(await serveSpa(c), setCookies);
}

async function handleGuardedPage(c: PageContext): Promise<Response> {
    const { user, setCookies } = await loadSessionUser(c.req.raw);
    if (!user) {
        const url = new URL(c.req.url);
        const signIn = new URL(SIGN_IN_PATH, url);
        signIn.searchParams.set("redirectTo", `${url.pathname}${url.search}`);
        return redirectWithCookies(`${signIn.pathname}${signIn.search}`, setCookies);
    }
    return appendSetCookies(await serveSpa(c), setCookies);
}

async function serveSpa(c: PageContext): Promise<Response> {
    return c.env.ASSETS.fetch(c.req.raw);
}

export default pageRoutes;
