import Link from "next/link";
import { UserIcon } from "lucide-react";
import { getAuth } from "@/lib/auth/server";
import { trialDaysLeft } from "@/lib/billing";
import UserMenuButton from "@/components/page/auth/UserMenuButton";
import BrandMark from "@/components/public/BrandMark";

// 이 레이아웃은 세션을 읽어 헤더를 바꾼다. 그래서 하위 페이지는 전부 요청마다 렌더해야 한다.
// 명시하는 이유: 기본값에 맡기면 Next가 프리렌더를 시도하면서 빌드 시점에 env(DB·auth)를 요구하고,
// 실패하면 빌드가 통째로 죽는다. 선언해 두면 빌드가 자격증명 없이도 돌아가고
// (CI가 prod DB 키를 들고 있을 필요가 없다) 사용자별 화면이 정적 HTML로 굳을 여지도 사라진다.
export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = await getAuth().getSession();
    // 트라이얼 카운트다운. 유료는 null이라 배너가 안 뜬다 (이메일 인프라 없이 앱 내 표시로 해결).
    const daysLeft = session?.user ? await trialDaysLeft(session.user.id) : null;
    return (
        <>
            <header className="border-b border-line">
                <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
                    <Link href="/" className="flex items-center gap-2 font-mono font-bold">
                        <BrandMark size={24} />
                        localagents
                    </Link>
                    {session?.user ? (
                        <nav className="flex items-center gap-5">
                            {daysLeft !== null && (
                                <span className="font-mono text-xs text-warn">
                                    {daysLeft > 0 ? `Trial: ${daysLeft} days left` : "Trial ended"}
                                </span>
                            )}
                            <Link href="/sessions" className="text-sm text-dim hover:text-fog">
                                Sessions
                            </Link>
                            <Link href="/devices" className="text-sm text-dim hover:text-fog">
                                Devices
                            </Link>
                            <UserMenuButton
                                links={[
                                    {
                                        href: "/profile",
                                        icon: <UserIcon className="h-4 w-4" />,
                                        label: "Profile",
                                    },
                                ]}
                            />
                        </nav>
                    ) : (
                        <Link
                            href="/auth/sign-in"
                            className="rounded border border-line px-3 py-1 font-mono text-sm text-fog hover:bg-black"
                        >
                            Sign in
                        </Link>
                    )}
                </div>
            </header>
            {children}
        </>
    );
}
