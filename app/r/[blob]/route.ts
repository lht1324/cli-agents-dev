import { redirect } from "next/navigation";
import { unsealText } from "@/lib/auth/packet";

// 로그인 후 복귀 관문. 경로에 든 암호문을 뜯어 안의 복귀 URL로 보낸다.
// 안은 /api/device/consume?data=... 로 시작해야 한다 (open redirect 방지).
export async function GET(_request: Request, { params }: { params: Promise<{ blob: string }> }): Promise<Response> {
    const { blob } = await params;
    const inner = unsealText(blob);
    if (inner && inner.startsWith("/api/device/consume?data=")) {
        redirect(inner);
    }
    redirect("/");
}
