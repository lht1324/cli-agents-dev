import { NextResponse } from "next/server";
import { getIsValidRequestC2S } from "@/lib/utils/getIsValidRequest";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

type RouteHandler = (request: Request) => Promise<Response>;

interface RouteEntry {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    pattern: string[];
    load: () => Promise<Record<string, unknown>>;
}

// 웹(브라우저)이 호출하는 API만 둔다. 데몬 전용(기기 토큰) 라우트는 넣지 않는다.
// 전부 /api/web/** 이다 — 게이트웨이는 web 채널 전용 진입점이라는 규칙을 경로로 강제한다.
const ROUTE_ENTRIES: RouteEntry[] = [
    { method: "GET", pattern: ["api", "web", "messages"], load: () => import("@/app/api/web/messages/route") },
    { method: "POST", pattern: ["api", "web", "commands"], load: () => import("@/app/api/web/commands/route") },
    { method: "DELETE", pattern: ["api", "web", "devices"], load: () => import("@/app/api/web/devices/route") },
    { method: "POST", pattern: ["api", "web", "device", "authorize"], load: () => import("@/app/api/web/device/authorize/route") },
    { method: "POST", pattern: ["api", "web", "dodo", "checkout"], load: () => import("@/app/api/web/dodo/checkout/route") },
    { method: "POST", pattern: ["api", "web", "dodo", "cancel"], load: () => import("@/app/api/web/dodo/cancel/route") },
    { method: "POST", pattern: ["api", "web", "dodo", "resume"], load: () => import("@/app/api/web/dodo/resume/route") },
    // 웹훅은 Dodo 서버가 /api/webhook/dodo로 직접 부른다. 게이트웨이에 넣지 않는다 (세션 인증 자체가 성립 안 함).
];

// 비로그인 허용 경로. 랜딩에서 공개 데이터를 부를 때만 추가한다.
const PUBLIC_ROUTES: { method: string; path: string }[] = [];

// CORS. dev에서 브라우저(클라 3004)가 API 컨테이너(3005)를 크로스 오리진으로 부른다.
// credentials: include라 와일드카드(*)를 못 쓰고, 허용 목록에 있는 origin만 골라 반영한다.
// prod는 같은 origin이라 fetch에 CORS가 개입하지 않으므로 헤더를 안 붙인다.
function corsHeaders(request: Request): Record<string, string> | null {
    const raw = process.env.CORS_ALLOWED_ORIGINS
        ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3004");
    const allowed = raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    const origin = request.headers.get("origin");
    if (!origin || !allowed.includes(origin)) {
        return null;
    }
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        Vary: "Origin",
    };
}

// 응답에 CORS 헤더를 붙인다. NextResponse는 set이 되지만, 혹시 immutable Response가 오면 복제해서 붙인다.
function withCors(response: Response, request: Request): Response {
    const headers = corsHeaders(request);
    if (!headers) {
        return response;
    }
    for (const [key, value] of Object.entries(headers)) {
        try {
            response.headers.set(key, value);
        } catch {
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: [...response.headers.entries(), ...Object.entries(headers)],
            });
        }
    }
    return response;
}

function matchRoute(
    method: string,
    targetPath: string,
): { entry: RouteEntry; params: Record<string, string> } | null {
    const segments = targetPath.split("/").filter((s) => s.length > 0);
    for (const entry of ROUTE_ENTRIES) {
        if (entry.method !== method || entry.pattern.length !== segments.length) {
            continue;
        }
        const params: Record<string, string> = {};
        let matched = true;
        for (let i = 0; i < segments.length; i++) {
            const part = entry.pattern[i];
            if (part.startsWith(":")) {
                params[part.slice(1)] = decodeURIComponent(segments[i]);
            } else if (part !== segments[i]) {
                matched = false;
                break;
            }
        }
        if (matched) {
            return { entry, params };
        }
    }
    return null;
}

// 브라우저 → 서버 단일 진입점. 세션을 확인한 뒤 같은 프로세스 핸들러로 바로 넘긴다.
// self-fetch 금지: 워커가 자기 도메인을 다시 부르면 edge에서 non-JSON으로 죽을 수 있다.
async function dispatchGateway(request: Request): Promise<Response> {
    const method = request.method;
    const incoming = new URL(request.url);
    const targetPath = incoming.searchParams.get("path") ?? "";
    if (!targetPath) {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "missing 'path' param" });
    }
    if (!targetPath.startsWith("/api/web/")) {
        return getNextBaseResponse(400).json({
            success: false,
            status: 400,
            error: "'path' must start with /api/web/",
        });
    }

    const isPublic = PUBLIC_ROUTES.some((r) => r.method === method && r.path === targetPath);
    let userId = "";
    if (!isPublic) {
        // C2S 판정은 여기서 한 번. 이후 라우트는 S2S로만 신뢰한다.
        const c2sUser = await getIsValidRequestC2S();
        if (!c2sUser) {
            return getNextBaseResponse(401).json({ success: false, status: 401, error: "login required" });
        }
        userId = c2sUser;
    }

    const matched = matchRoute(method, targetPath);
    if (!matched) {
        return getNextBaseResponse(404).json({
            success: false,
            status: 404,
            error: `no route for ${method} ${targetPath}`,
        });
    }
    const mod = await matched.entry.load();
    const handler = mod[method];
    if (typeof handler !== "function") {
        return getNextBaseResponse(404).json({
            success: false,
            status: 404,
            error: `no ${method} handler for ${targetPath}`,
        });
    }

    // 원래 쿼리에서 path만 빼고 그대로 넘긴다.
    const query = new URLSearchParams(incoming.searchParams);
    query.delete("path");
    const search = query.toString();
    const headers = new Headers(request.headers);
    headers.set("x-internal-secret", process.env.INTERNAL_FIRE_AND_FORGET_API_SECRET ?? "");
    if (userId.length > 0) {
        headers.set("x-user-id", userId);
    }
    const internal = new Request(`http://internal${targetPath}${search ? `?${search}` : ""}`, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
    });

    try {
        return await (handler as RouteHandler)(internal);
    } catch (error) {
        console.error(`[gateway] ${method} ${targetPath}:`, error);
        return NextResponse.json(
            { success: false, status: 500, error: "gateway dispatch failed" },
            { status: 500 },
        );
    }
}

async function handleGateway(request: Request): Promise<Response> {
    return withCors(await dispatchGateway(request), request);
}

// 브라우저 preflight. 쿠키가 안 실리므로 인증 없이 통과시킨다.
// 허용 origin이 아니면 헤더 없이 204 — 브라우저가 알아서 거부한다.
export async function OPTIONS(request: Request): Promise<Response> {
    const headers = corsHeaders(request);
    return new Response(null, { status: 204, headers: headers ?? {} });
}

export const GET = handleGateway;
export const POST = handleGateway;
export const PATCH = handleGateway;
export const DELETE = handleGateway;
