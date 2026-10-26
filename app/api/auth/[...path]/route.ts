import { getAuth } from "@/lib/auth/server";

// 핸들러는 모듈 평가 시점이 아니라 요청 시점에 만든다 (getAuth와 같은 이유).
export async function GET(
    request: Request,
    ctx: { params: Promise<{ path: string[] }> },
) {
    return getAuth().handler().GET(request, ctx);
}

export async function POST(
    request: Request,
    ctx: { params: Promise<{ path: string[] }> },
) {
    return getAuth().handler().POST(request, ctx);
}
