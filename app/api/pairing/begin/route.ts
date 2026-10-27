import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getIsValidRequestC2S } from "@/lib/utils/getIsValidRequest";
import { sealConnect, unsealConnect } from "@/lib/auth/packet";
import { checkBillingGate } from "@/lib/billing";
import { linkDevice } from "@/lib/device/link";
import { devices, getDb } from "@/lib/neon";

// 로그인 전 기기 연결 진입. data(봉투) 우선, 평문 폴백.
// 로그인済み면 바로 authorize로 (봉투 URL), 미로그인이면 봉투를 들고 로그인으로.
export async function GET(request: Request): Promise<Response> {
    const params = new URL(request.url).searchParams;
    let inner = params.get("data") ?? "";
    let device = "";
    let port = "";
    let state = "";
    let label = "";
    let platform = "";
    let hostname = "";
    if (inner) {
        const p = unsealConnect(inner);
        if (!p) {
            redirect("/");
        }
        device = p.device;
        port = p.port;
        state = p.state;
        label = p.label ?? "";
        platform = p.platform ?? "";
        hostname = p.hostname ?? "";
    } else {
        device = params.get("device") ?? "";
        port = params.get("port") ?? "";
        state = params.get("state") ?? "";
        if (!device || !port || !state) {
            redirect("/");
        }
        label = params.get("label") ?? "";
        platform = params.get("platform") ?? "";
        hostname = params.get("hostname") ?? "";
        try {
            inner = sealConnect({ device, port, state, label, platform, hostname });
        } catch {
            // 키 미설정. 평문 폴백.
        }
    }
    const userId = await getIsValidRequestC2S();
    if (userId) {
        // 이미 이 계정이 승인한 기기면 승인 화면을 건너뛴다. 유저는 방금 OAuth로 계정임을
        // 증명했고, 이 기기는 그 계정이 전에 연결한 적이 있다. 다시 물으면 "새 기기 등록"처럼 보인다.
        // 명시적으로 해제(Unlink)한 기기는 예외 — 그건 다시 승인받는 게 맞다.
        if (/^\d+$/.test(port)) {
            const known = await getDb()
                .select({ id: devices.id })
                .from(devices)
                .where(and(eq(devices.id, device), eq(devices.userId, userId), isNull(devices.unlinkedAt)))
                .limit(1);
            if (known.length > 0) {
                const gate = await checkBillingGate(userId);
                if (!gate.allowed) {
                    redirect("/billing/locked");
                }
                const token = await linkDevice({
                    userId,
                    deviceId: device,
                    label: label.length > 0 ? label : "My PC",
                    platform: platform.length > 0 ? platform : null,
                    hostname: hostname.length > 0 ? hostname : null,
                });
                redirect(
                    `http://127.0.0.1:${port}/callback?token=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`,
                );
            }
        }
        if (inner) {
            redirect(`/device/authorize?data=${encodeURIComponent(inner)}`);
        }
        redirect(
            `/device/authorize?${new URLSearchParams({ device, port, state, label, platform, hostname }).toString()}`,
        );
    }
    const back = `/device/authorize?${new URLSearchParams({ device, port, state, label, platform, hostname }).toString()}`;
    const jar = await cookies();
    jar.set("localagents_connect", back, { maxAge: 600, path: "/", httpOnly: true });
    // 콜백은 고정 라우트 하나로. 도착지 분기(복귀 경로)는 쿠키가 들고 있다.
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    redirect(
        `/auth/sign-in?callbackURL=${encodeURIComponent(`${origin}/api/auth/callback`)}`,
    );
}
