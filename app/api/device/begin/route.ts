import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { sealConnect, sealText, unsealConnect } from "@/lib/auth/packet";

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
    const { data: session } = await auth.getSession();
    if (session?.user) {
        if (inner) {
            redirect(`/device/authorize?data=${encodeURIComponent(inner)}`);
        }
        redirect(
            `/device/authorize?${new URLSearchParams({ device, port, state, label, platform, hostname }).toString()}`,
        );
    }
    const back = `/device/authorize?${new URLSearchParams({ device, port, state, label, platform, hostname }).toString()}`;
    const jar = await cookies();
    jar.set("cliagent_connect", back, { maxAge: 600, path: "/", httpOnly: true });
    // 안쪽 봉투(기기 파라미터) → 복귀 경로 → 바깥 봉투(문자열 통째). URL엔 암호문만 남는다.
    let callbackURL = back;
    if (inner) {
        try {
            const innerPath = `/api/device/consume?data=${encodeURIComponent(inner)}`;
            callbackURL = `/r/${sealText(innerPath)}`;
        } catch {
            // 봉투 실패. 쿠키 폴백으로 진행.
        }
    }
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`);
}
