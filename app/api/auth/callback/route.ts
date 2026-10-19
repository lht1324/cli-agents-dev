import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

// OAuth 리다이렉트의 고정 도착지(하나만 Neon에 노출).
// 도착지 분기: 기기 페어링 복귀 쿠키(localagents_connect)가 있으면 authorize 재개, 없으면 인박스.
// verifier 등 도착 query는 최종 화면의 NeonAuthUIProvider가 소화하므로 그대로 계승한다.
export async function GET(request: Request): Promise<Response> {
    const jar = await cookies();
    const back = jar.get("localagents_connect")?.value;
    let dest = "/sessions";
    if (back) {
        // one-shot. 재개에 사용하면 소각
        jar.delete("localagents_connect");
        dest = back;
    }
    // origin은 브라우저가 보고 있는 주소 기준. 쿠키 도메인(docker) 일치 반여.
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    const target = new URL(dest, origin);
    for (const [key, value] of new URL(request.url).searchParams) {
        target.searchParams.set(key, value);
    }
    redirect(target.toString());
}
