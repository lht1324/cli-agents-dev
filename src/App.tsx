import { useCallback, useEffect, useState } from "react";
import { Route, Routes, useNavigate } from "react-router";
import Header from "./components/Header";
import SessionsPage from "./pages/SessionsPage";
import SessionDetailPage from "./pages/SessionDetailPage";
import DeviceAuthorizePage from "./pages/DeviceAuthorizePage";
import DevicesPage from "./pages/DevicesPage";
import ProfilePage from "./pages/ProfilePage";
import { authClient } from "./lib/auth/client";

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Header />
            {children}
        </>
    );
}

function SignIn() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const redirectTo = new URLSearchParams(window.location.search).get("redirectTo") ?? "/sessions";

    const onSignIn = useCallback(async (provider: "google" | "github") => {
        setBusy(true);
        setError(null);
        const { error: authError } = await authClient.signIn.social({
            provider,
            callbackURL: `${window.location.origin}/api/auth/callback`,
        });
        if (authError) {
            setError(authError.message ?? "sign-in failed");
            setBusy(false);
        }
    }, []);

    return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
            <p className="font-mono text-sm text-go">$ localagents login</p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">Sign in</h1>
            <p className="mt-2 text-sm text-dim">Continue to {redirectTo}.</p>
            <div className="mt-6 flex flex-col gap-2">
                <button
                    type="button"
                    onClick={() => void onSignIn("google")}
                    disabled={busy}
                    className="rounded border border-line bg-panel px-4 py-2 font-mono text-sm text-fog transition-colors hover:border-fog disabled:opacity-50"
                >
                    Continue with Google
                </button>
                <button
                    type="button"
                    onClick={() => void onSignIn("github")}
                    disabled={busy}
                    className="rounded border border-line bg-panel px-4 py-2 font-mono text-sm text-fog transition-colors hover:border-fog disabled:opacity-50"
                >
                    Continue with GitHub
                </button>
            </div>
            {error && <p className="mt-3 font-mono text-xs text-stop">{error}</p>}
        </main>
    );
}

function Stub({ title, body }: { title: string; body: string }) {
    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <h1 className="font-mono text-xl font-bold">{title}</h1>
            <p className="mt-4 text-sm text-dim">{body}</p>
        </main>
    );
}

function Home() {
    const [email, setEmail] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        void (async () => {
            const { data } = await authClient.getSession();
            setEmail(data?.user?.email ?? null);
        })();
    }, []);

    return (
        <Shell>
            <main className="mx-auto flex min-h-[70dvh] max-w-3xl flex-col justify-center px-6">
                <p className="font-mono text-sm text-go">$ localagents</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight">Start on one PC. Continue on another.</h1>
                <p className="mt-2 text-sm text-dim">
                    {email ? `Signed in as ${email}.` : "Sign in to see your sessions."}
                </p>
                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(email ? "/sessions" : "/auth/sign-in")}
                        className="rounded bg-go px-4 py-2 font-mono text-sm font-bold text-ink"
                    >
                        {email ? "Open sessions" : "Sign in"}
                    </button>
                </div>
            </main>
        </Shell>
    );
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth/sign-in" element={<SignIn />} />
            <Route
                path="/sessions"
                element={
                    <Shell>
                        <SessionsPage />
                    </Shell>
                }
            />
            <Route
                path="/sessions/:id"
                element={
                    <Shell>
                        <SessionDetailPage />
                    </Shell>
                }
            />
            <Route
                path="/sessions/:id/:childId"
                element={
                    <Shell>
                        <SessionDetailPage />
                    </Shell>
                }
            />
            <Route
                path="/device/authorize"
                element={
                    <Shell>
                        <DeviceAuthorizePage />
                    </Shell>
                }
            />
            <Route
                path="/devices"
                element={
                    <Shell>
                        <DevicesPage />
                    </Shell>
                }
            />
            <Route
                path="/profile"
                element={
                    <Shell>
                        <ProfilePage />
                    </Shell>
                }
            />
            <Route
                path="*"
                element={
                    <Shell>
                        <Stub title="Not found" body="This page does not exist." />
                    </Shell>
                }
            />
        </Routes>
    );
}
