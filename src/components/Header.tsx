import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { authClient } from "@/lib/auth/client";

// 공통 헤더. 유저 메뉴는 직접 만든다 (auth-ui 미사용 — lib/auth/client.ts 주석 참조).
export default function Header() {
    const [user, setUser] = useState<{ email: string | null; name: string | null; image: string | null } | null>(
        null,
    );
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        void (async () => {
            const { data } = await authClient.getSession();
            const u = data?.user;
            setUser(u ? { email: u.email ?? null, name: u.name ?? null, image: u.image ?? null } : null);
        })();
    }, []);

    const onSignOut = useCallback(async () => {
        await authClient.signOut();
        setUser(null);
        setOpen(false);
        navigate("/");
    }, [navigate]);

    const initial = (user?.name ?? user?.email ?? "?").slice(0, 1).toUpperCase();

    return (
        <header className="border-b border-line">
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
                <Link to="/" className="font-mono font-bold">
                    localagents
                </Link>
                {user ? (
                    <nav className="flex items-center gap-5">
                        <Link to="/sessions" className="text-sm text-dim hover:text-fog">
                            Sessions
                        </Link>
                        <Link to="/devices" className="text-sm text-dim hover:text-fog">
                            Devices
                        </Link>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setOpen((v) => !v)}
                                className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-line bg-panel font-mono text-xs text-fog"
                                aria-label="Account menu"
                            >
                                {user.image ? (
                                    <img src={user.image} alt={user.name ?? "avatar"} className="h-full w-full object-cover" />
                                ) : (
                                    initial
                                )}
                            </button>
                            {open && (
                                <div className="absolute right-0 top-10 z-10 w-56 rounded border border-line bg-panel p-2">
                                    <div className="px-2 py-1">
                                        <p className="truncate text-sm text-fog">{user.name ?? "-"}</p>
                                        <p className="truncate font-mono text-xs text-dim">{user.email ?? "-"}</p>
                                    </div>
                                    <Link
                                        to="/profile"
                                        className="block rounded px-2 py-1.5 text-sm text-fog hover:bg-black"
                                        onClick={() => setOpen(false)}
                                    >
                                        Profile
                                    </Link>
                                    <Link
                                        to="/devices"
                                        className="block rounded px-2 py-1.5 text-sm text-fog hover:bg-black"
                                        onClick={() => setOpen(false)}
                                    >
                                        Devices
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => void onSignOut()}
                                        className="block w-full rounded px-2 py-1.5 text-left text-sm text-fog hover:bg-black"
                                    >
                                        Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                    </nav>
                ) : (
                    <Link to="/auth/sign-in" className="text-sm text-dim hover:text-fog">
                        Sign in
                    </Link>
                )}
            </div>
        </header>
    );
}
