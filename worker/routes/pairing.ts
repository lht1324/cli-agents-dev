import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { and, eq, isNull } from "drizzle-orm";
import { unsealConnect, sealConnect } from "../../lib/auth/packet";
import { checkBillingGate } from "../../lib/billing";
import { linkDevice } from "../../lib/device/link";
import { getDb } from "../../lib/neon/client";
import { devices } from "../../lib/neon/schema";
import type { AppEnv } from "../../lib/env";
import { loadSessionUser } from "../middleware/auth";

// 기기 연결 공개 흐름. 로그인 전에도 호출된다.
const pairing = new Hono<{ Bindings: AppEnv }>();

interface PairingParams {
    device: string;
    port: string;
    state: string;
    label: string;
    platform: string;
    hostname: string;
}

function readParams(input: URLSearchParams): PairingParams | null {
    const data = input.get("data") ?? "";
    if (data) {
        const p = unsealConnect(data);
        if (!p) {
            return null;
        }
        return {
            device: p.device,
            port: p.port,
            state: p.state,
            label: p.label ?? "",
            platform: p.platform ?? "",
            hostname: p.hostname ?? "",
        };
    }
    const device = input.get("device") ?? "";
    const port = input.get("port") ?? "";
    const state = input.get("state") ?? "";
    if (!device || !port || !state) {
        return null;
    }
    return {
        device,
        port,
        state,
        label: input.get("label") ?? "",
        platform: input.get("platform") ?? "",
        hostname: input.get("hostname") ?? "",
    };
}

function authorizePath(p: PairingParams): string {
    return `/device/authorize?${new URLSearchParams({
        device: p.device,
        port: p.port,
        state: p.state,
        label: p.label,
        platform: p.platform,
        hostname: p.hostname,
    }).toString()}`;
}

// 로그인 전 진입. 로그인 상태면 승인 화면 또는 자동 연결로.
pairing.get("/begin", async (c) => {
    const params = readParams(new URL(c.req.url).searchParams);
    if (!params) {
        return c.redirect("/", 302);
    }

    const { user } = await loadSessionUser(c.req.raw);
    if (!user) {
        // 로그인 후 이 화면으로 돌아오게 한다.
        const back = authorizePath(params);
        setCookie(c, "localagents_connect", back, { path: "/", maxAge: 600, httpOnly: true, sameSite: "Lax" });
        const origin = new URL(c.req.url).origin;
        const signIn = new URL("/auth/sign-in", origin);
        signIn.searchParams.set("callbackURL", `${origin}/api/auth/callback`);
        return c.redirect(signIn.toString(), 302);
    }

    // 이미 이 계정에 연결된 기기면 승인 화면을 건너뛰고 토큰을 발급한다.
    if (/^\d+$/.test(params.port)) {
        const known = await getDb()
            .select({ id: devices.id })
            .from(devices)
            .where(and(eq(devices.id, params.device), eq(devices.userId, user.id), isNull(devices.unlinkedAt)))
            .limit(1);
        if (known.length > 0) {
            const gate = await checkBillingGate(user.id);
            if (!gate.allowed) {
                return c.redirect("/billing/locked", 302);
            }
            const token = await linkDevice({
                userId: user.id,
                deviceId: params.device,
                label: params.label.length > 0 ? params.label : "My PC",
                platform: params.platform.length > 0 ? params.platform : null,
                hostname: params.hostname.length > 0 ? params.hostname : null,
            });
            return c.redirect(
                `http://127.0.0.1:${params.port}/callback?token=${encodeURIComponent(token)}&state=${encodeURIComponent(params.state)}`,
                302,
            );
        }
    }

    return c.redirect(authorizePath(params), 302);
});

// 로그인 후 복귀 1회 소비.
pairing.get("/consume", async (c) => {
    const data = new URL(c.req.url).searchParams.get("data") ?? "";
    if (data) {
        deleteCookie(c, "localagents_connect", { path: "/" });
        const p = unsealConnect(data);
        if (p) {
            return c.redirect(`/device/authorize?data=${encodeURIComponent(data)}`, 302);
        }
        return c.redirect("/", 302);
    }
    const back = getCookie(c, "localagents_connect") ?? "";
    deleteCookie(c, "localagents_connect", { path: "/" });
    if (back.startsWith("/device/authorize?")) {
        return c.redirect(back, 302);
    }
    return c.redirect("/", 302);
});

// 데몬용 사전 포장 (평문을 브라우저에 노출하지 않는다).
pairing.post("/pack", async (c) => {
    let body: Record<string, unknown>;
    try {
        body = (await c.req.json()) as Record<string, unknown>;
    } catch {
        return c.json({ success: false, status: 400, error: "invalid JSON body" }, 400);
    }
    const device = typeof body.device === "string" ? body.device : "";
    const port = typeof body.port === "string" ? body.port : "";
    const state = typeof body.state === "string" ? body.state : "";
    if (!device || !port || !state) {
        return c.json({ success: false, status: 400, error: "device, port, state are required" }, 400);
    }
    try {
        const data = sealConnect({
            device,
            port,
            state,
            label: typeof body.label === "string" ? body.label : "",
            platform: typeof body.platform === "string" ? body.platform : "",
            hostname: typeof body.hostname === "string" ? body.hostname : "",
        });
        return c.json({ success: true, status: 200, data: { data } });
    } catch {
        return c.json({ success: false, status: 500, error: "packet key is not set" }, 500);
    }
});

export default pairing;
