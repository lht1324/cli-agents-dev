import { headers } from "next/headers";
import { authViewPaths } from "@neondatabase/auth-ui/server";
import AuthServer from "@/components/page/auth/AuthServer";

export const dynamicParams = false;

export function generateStaticParams() {
    return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({
    params,
}: {
    params: Promise<{ path: string }>;
}) {
    const { path } = await params;

    // Neon에 노출되는 콜백은 고정 라우트 하나(/api/auth/callback)뿐.
    // 도착지 분기(인박스/기기 승인)는 그 라우트가 쿠키로 판단한다. 절대 경로 필수
    // — Neon은 앱과 별개 호스트에서 돌기 때문에 상대 callbackURL은 앱으로 옮겨지지 않는다.
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    return <AuthServer path={path} callbackURL={`${origin}/api/auth/callback`} />;
}
