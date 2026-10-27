"use client";

import { useCallback, useMemo, useState } from "react";

// 첫 탭이 오기 전의 인박스. 죽은 화면이 아니라 온보딩 출발점 — 지금 할 한 가지(설치+로그인)를 크게.
// 설치 방식 탭 2개: npx(한 방이면 끝) vs npm(전역 설치, 여러 단계). 터미널 칩은 랜딩과 같은 문법.
type Method = "npx" | "npm";

const METHODS: Record<Method, { label: string; hint: string; steps: { command: string | null; title: string; body: string }[] }> = {
    npx: {
        label: "npx",
        hint: "One command. Nothing left behind.",
        steps: [
            {
                command: "npx localagents@latest login",
                title: "Connect your PC",
                body: "It installs the daemon, opens your browser to sign in, and starts syncing automatically.",
            },
            {
                command: null,
                title: "Keep working as usual",
                body: "Open tabs in OpenCode like you always do. Synced tabs appear here automatically.",
            },
        ],
    },
    npm: {
        label: "npm",
        hint: "Global install. Two steps.",
        steps: [
            {
                command: "npm install -g localagents",
                title: "Install",
                body: "Puts the localagents CLI on your PATH.",
            },
            {
                command: "localagents login",
                title: "Connect your PC",
                body: "Opens your browser to sign in and starts the daemon. Future runs pick it up from PATH.",
            },
            {
                command: null,
                title: "Keep working as usual",
                body: "Open tabs in OpenCode like you always do. Synced tabs appear here automatically.",
            },
        ],
    },
};

export default function SessionsEmptyState() {
    const [method, setMethod] = useState<Method>("npx");
    const [copied, setCopied] = useState<string | null>(null);

    const active = METHODS[method];
    const SECOND_PC_HINT = "Working on a second PC? Push a tab from there and it appears here.";

    const onClickCopy = useMemo(
        () => async (command: string) => {
            try {
                await navigator.clipboard.writeText(command);
                setCopied(command);
                setTimeout(() => setCopied((current) => (current === command ? null : current)), 1500);
            } catch {
                // 클립보드 거부 시 조용히 무시 — 명령어는 화면에 그대로 보인다.
            }
        },
        [],
    );

    const onSelectMethod = useCallback((next: Method) => {
        setMethod(next);
        setCopied(null);
    }, []);

    return (
        <div className="rounded border border-line bg-panel p-8">
            <h2 className="font-mono text-lg font-bold">No sessions yet.</h2>
            <p className="mt-2 max-w-[60ch] text-sm text-dim">
                This inbox fills itself. Connect a PC and your OpenCode tabs start appearing here.
            </p>

            {/* 설치 방식 탭. npx가 기본 — 한 방이면 끝. */}
            <div className="mt-6 inline-flex rounded border border-line" role="tablist">
                {(Object.keys(METHODS) as Method[]).map((key) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={method === key}
                        onClick={() => onSelectMethod(key)}
                        className={
                            method === key
                                ? "rounded bg-black px-4 py-1.5 font-mono text-xs font-bold text-go"
                                : "rounded px-4 py-1.5 font-mono text-xs text-dim transition-colors hover:text-fog"
                        }
                    >
                        {METHODS[key].label}
                    </button>
                ))}
            </div>
            <p className="mt-2 font-mono text-xs text-dim">{active.hint}</p>

            <ol className="mt-6 space-y-6">
                {active.steps.map((step, i) => (
                    <li key={step.title} className="flex items-start gap-4">
                        <span className="pt-1 font-mono text-sm text-go">{String(i + 1).padStart(2, "0")}</span>
                        <div className="min-w-0 flex-1">
                            {step.command ? (
                                <button
                                    type="button"
                                    onClick={() => onClickCopy(step.command ?? "")}
                                    className="inline-flex items-center gap-3 rounded border border-line bg-black px-3 py-1.5 transition-colors hover:border-fog"
                                >
                                    <span className="font-mono text-xs">
                                        <span className="text-go">$ </span>
                                        <span className="text-fog">{step.command}</span>
                                    </span>
                                    <span className="font-mono text-[10px] text-dim">
                                        {copied === step.command ? "copied" : "copy"}
                                    </span>
                                </button>
                            ) : null}
                            <h4 className="mt-3 font-bold">{step.title}</h4>
                            <p className="mt-1 max-w-[60ch] text-sm text-dim">{step.body}</p>
                        </div>
                    </li>
                ))}
            </ol>
            <p className="mt-6 font-mono text-xs text-dim">{SECOND_PC_HINT}</p>
        </div>
    );
}
