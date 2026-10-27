import { AuthView } from "@neondatabase/auth-ui";
import { headers } from "next/headers";

// 카드 카피. 랜딩 문법을 그대로 쓴다 — 모노 eyebrow → 헤드라인 → dim 보조문.
const COPY: Record<string, { eyebrow: string; title: string; body: string }> = {
    "sign-in": {
        eyebrow: "$ localagents login",
        title: "Sign in.",
        body: "Start a session on one PC. Continue it on every PC.",
    },
    "sign-up": {
        eyebrow: "$ localagents login",
        title: "Create your account.",
        body: "One account for every machine you run agents on.",
    },
    "forgot-password": {
        eyebrow: "$ localagents login",
        title: "Account recovery.",
        body: "We sign you in with Google or GitHub, so there is no password to reset.",
    },
};

const FALLBACK = {
    eyebrow: "$ localagents",
    title: "localagents",
    body: "One inbox for every machine you run agents on.",
};

// 랜딩 기조 고정: 라운드 4px·그림자 없음·1px 라인. 소셜 버튼은 칩 모양(outline + 모노).
// cn이 tailwind-merge라 카드 내부 rounded-xl/shadow-sm을 여기서 확실히 이긴다.
const CLASS_NAMES = {
    base: "rounded border-line bg-panel shadow-none",
    header: "px-6 pt-1",
    content: "gap-4 px-6",
    footer: "px-6",
    continueWith: "font-mono text-xs text-dim",
    separator: "font-mono text-xs text-dim",
    form: {
        providerButton:
            "rounded border border-line bg-black font-mono text-sm text-fog hover:bg-ink dark:border-line dark:bg-black dark:hover:bg-ink",
        input: "rounded border-line bg-ink font-mono",
        label: "text-dim",
        primaryButton: "rounded bg-go font-mono text-sm font-bold text-ink hover:opacity-90",
    },
};

export default function AuthServer({ path, callbackURL }: { path: string; callbackURL: string }) {
    const copy = COPY[path] ?? FALLBACK;
    return (
        <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl flex-col items-center justify-center px-4 py-16">
            <div className="w-full max-w-sm">
                <AuthView
                    path={path}
                    callbackURL={callbackURL}
                    cardHeader={
                        <div>
                            <p className="font-mono text-xs text-go">{copy.eyebrow}</p>
                            <h1 className="mt-2 text-xl font-bold tracking-tight">{copy.title}</h1>
                            <p className="mt-1 text-sm text-dim">{copy.body}</p>
                        </div>
                    }
                    classNames={CLASS_NAMES}
                />
            </div>
        </main>
    );
}
