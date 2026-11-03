import { useCallback, useState } from "react";
import { authClient } from "@/lib/auth/client";
import BrandMark from "@/components/BrandMark";

// 로그인 화면. 원본(Neon AuthView 카드)의 구성만 그대로 옮기고, 스타일은
// 랜딩 문법(라운드 4px·1px 라인·모노 eyebrow)을 유지한다.
const COPY = {
    eyebrow: "$ localagents login",
    title: "Sign in.",
    body: "Start a session on one PC. Continue it on every PC.",
} as const;

const PROVIDERS = [
    { id: "google", label: "Continue with Google" },
    { id: "github", label: "Continue with GitHub" },
] as const;

export default function SignInPage() {
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const onSignIn = useCallback(async (provider: "google" | "github") => {
        setBusy(provider);
        setError(null);
        const { error: authError } = await authClient.signIn.social({
            provider,
            callbackURL: `${window.location.origin}/api/auth/callback`,
        });
        if (authError) {
            setError(authError.message ?? "sign-in failed");
            setBusy(null);
        }
    }, []);

    return (
        <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl flex-col items-center justify-center px-4 py-16">
            <div className="w-full max-w-sm">
                <div className="rounded border border-line bg-panel p-6">
                    <div aria-hidden="true" className="mb-4 flex items-center gap-2">
                        <BrandMark size={20} />
                    </div>
                    <p className="font-mono text-xs text-go">{COPY.eyebrow}</p>
                    <h1 className="mt-2 text-xl font-bold tracking-tight">{COPY.title}</h1>
                    <p className="mt-1 text-sm text-dim">{COPY.body}</p>

                    <div className="mt-5 space-y-2">
                        <p className="text-center font-mono text-xs text-dim">Continue with</p>
                        {PROVIDERS.map((provider) => (
                            <button
                                key={provider.id}
                                type="button"
                                onClick={() => void onSignIn(provider.id)}
                                disabled={busy !== null}
                                className="w-full rounded border border-line bg-black px-4 py-2 font-mono text-sm text-fog transition-colors hover:bg-ink disabled:opacity-50"
                            >
                                {busy === provider.id ? "Opening..." : provider.label}
                            </button>
                        ))}
                    </div>

                    {error && <p className="mt-3 font-mono text-xs text-stop">{error}</p>}

                    <p className="mt-5 text-center font-mono text-xs text-dim">
                        By continuing you agree to the{" "}
                        <a href="/legal/terms" className="text-fog underline-offset-2 hover:underline">
                            Terms
                        </a>{" "}
                        and{" "}
                        <a href="/legal/privacy" className="text-fog underline-offset-2 hover:underline">
                            Privacy Policy
                        </a>
                        .
                    </p>
                </div>
            </div>
        </main>
    );
}
