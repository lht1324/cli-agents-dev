import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// 로그인 전 기기 연결 진입. 복귀 URL을 쿠키에 저장 후 로그인으로 보낸다.
export async function GET(request: Request): Promise<Response> {
    const incoming = new URL(request.url);
    const params = incoming.searchParams;
    const back = `/device/authorize?${new URLSearchParams(
        Object.fromEntries([...params.entries()].filter(([, v]) => v !== "")),
    ).toString()}`;
    const jar = await cookies();
    jar.set("cliagent_connect", back, { maxAge: 600, path: "/", httpOnly: true });
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent(back)}`);
}
