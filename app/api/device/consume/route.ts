import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { unsealConnect } from "@/lib/auth/packet";

// 로그인 후 복귀 1회 소비. 봉투(data)는 뜯어보지만 다시 봉해서 authorize로 넘긴다.
// URL에는 암호문만 보인다. 쿠키 폴백(평문)은 최후 수단.
export async function GET(request: Request): Promise<Response> {
    const jar = await cookies();
    const data = new URL(request.url).searchParams.get("data") ?? "";
    if (data) {
        const p = unsealConnect(data);
        jar.delete("cliagent_connect");
        if (p) {
            redirect(`/device/authorize?data=${encodeURIComponent(data)}`);
        }
        redirect("/");
    }
    const back = jar.get("cliagent_connect")?.value;
    jar.delete("cliagent_connect");
    if (back && back.startsWith("/device/authorize?")) {
        redirect(back);
    }
    redirect("/");
}
