import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { unsealConnect } from "@/lib/auth/packet";

// 로그인 후 복귀 1회 소비. 암호 봉투(data) 우선, 쿠키 폴백.
export async function GET(request: Request): Promise<Response> {
    const jar = await cookies();
    const data = new URL(request.url).searchParams.get("data") ?? "";
    if (data) {
        const p = unsealConnect(data);
        jar.delete("cliagent_connect");
        if (p) {
            const query = new URLSearchParams({
                device: p.device,
                port: p.port,
                state: p.state,
                label: p.label ?? "",
                platform: p.platform ?? "",
                hostname: p.hostname ?? "",
            }).toString();
            redirect(`/device/authorize?${query}`);
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
