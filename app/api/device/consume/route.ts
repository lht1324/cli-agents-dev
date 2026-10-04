import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// 로그인 후 복귀 1회 소비. 쿠키 삭제 후 기기 연결 화면으로 보낸다.
export async function GET(): Promise<Response> {
    const jar = await cookies();
    const back = jar.get("cliagent_connect")?.value;
    jar.delete("cliagent_connect");
    if (back && back.startsWith("/device/authorize?")) {
        redirect(back);
    }
    redirect("/");
}
