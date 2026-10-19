import Link from "next/link";
import { UserButton } from "@neondatabase/auth-ui";
import { auth } from "@/lib/auth/server";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = await auth.getSession();
    return (
        <>
            <header className="border-b border-line">
                <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
                    <Link href="/" className="font-mono font-bold">
                        localagents
                    </Link>
                    {session?.user ? (
                        <nav className="flex items-center gap-5">
                            <Link href="/sessions" className="text-sm text-dim hover:text-fog">
                                Sessions
                            </Link>
                            <Link href="/devices" className="text-sm text-dim hover:text-fog">
                                Devices
                            </Link>
                            <UserButton size={"icon"} />
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
