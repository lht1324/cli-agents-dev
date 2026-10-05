import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { sealConnect, sealText } from "@/lib/auth/packet";

// 로그인 전 기기 연결 진입. 파라미터를 암호 봉투(data) 1개에 담는다.
// 로그인済み면 바로 authorize로 (봉투 URL), 미로그인이면 봉투를 들고 로그인으로.
export async function GET(request: Request): Promise<Response> {
    const params = new URL(request.url).searchParams;
    const device = params.get("device") ?? "";
    const port = params.get("port") ?? "";
    const state = params.get("state") ?? "";
    if (!device || !port || !state) {
        redirect("/");
    }
    const label = params.get("label") ?? "";
    const platform = params.get("platform") ?? "";
    const hostname = params.get("hostname") ?? "";
    let data = "";
    try {
        data = sealConnect({ device, port, state, label, platform, hostname });
    } catch {
        // 키 미설정. 평문 폴백.
    }
    const { data: session } = await auth.getSession();
    if (session?.user) {
        if (data) {
            redirect(`/device/authorize?data=${encodeURIComponent(data)}`);
        }
        const back = `/device/authorize?${new URLSearchParams({ device, port, state, label, platform, hostname }).toString()}`;
        redirect(back);
    }
    const back = `/device/authorize?${new URLSearchParams({ device, port, state, label, platform, hostname }).toString()}`;
    const jar = await cookies();
    jar.set("cliagent_connect", back, { maxAge: 600, path: "/", httpOnly: true });
    // 안쪽 봉투(기기 파라미터) → 복귀 경로 → 바깥 봉투(문자열 통째). URL엔 암호문만 남는다.
    let callbackURL = back;
    if (data) {
        try {
            const innerPath = `/api/device/consume?data=${encodeURIComponent(data)}`;
            callbackURL = `/r/${sealText(innerPath)}`;
        } catch {
            // 봉투 실패. 쿠키 폴백으로 진행.
        }
    }
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`);
}
