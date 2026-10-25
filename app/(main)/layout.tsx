import Link from "next/link";
import { UserIcon } from "lucide-react";
import { auth } from "@/lib/auth/server";
import { trialDaysLeft } from "@/lib/billing";
import UserMenuButton from "@/components/page/auth/UserMenuButton";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = await auth.getSession();
    // 트라이얼 카운트다운. 유료는 null이라 배너가 안 뜬다 (이메일 인프라 없이 앱 내 표시로 해결).
    const daysLeft = session?.user ? await trialDaysLeft(session.user.id) : null;
    return (
        <>
            <header className="border-b border-line">
                <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
                    <Link href="/" className="font-mono font-bold">
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
