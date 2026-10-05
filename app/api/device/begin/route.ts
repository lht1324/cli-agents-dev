import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sealConnect } from "@/lib/auth/packet";

// 로그인 전 기기 연결 진입. 파라미터를 암호 봉투(data) 1개에 담아 로그인 복귀 때 갖고 온다.
// 쿠키 폴백도 유지한다 (AuthView가 callbackURL을 무시하던 전적 때문).
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
    const back = `/device/authorize?${new URLSearchParams({ device, port, state, label, platform, hostname }).toString()}`;
    const jar = await cookies();
    jar.set("cliagent_connect", back, { maxAge: 600, path: "/", httpOnly: true });
    let callbackURL = back;
    try {
        const data = sealConnect({ device, port, state, label, platform, hostname });
        callbackURL = `/api/device/consume?data=${encodeURIComponent(data)}`;
    } catch {
        // 키 미설정 등. 쿠키 폴백으로 진행.
    }
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`);
}
